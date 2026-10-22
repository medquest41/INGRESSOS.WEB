-- CAMAROTES: incremental sobre GitHub e268760. Aplicação manual após auditoria dos pré-requisitos.
begin;

-- Audited 22/10/2026: production has 012 and participant routines, but lacks
-- ticket holder columns, shares/outbox and atomic payment reconciliation 014.
-- Add only dependencies of this feature; do not replay historical migrations.
set local lock_timeout='5s';
set local statement_timeout='60s';
create schema if not exists ingressos_migration_audit;
revoke all on schema ingressos_migration_audit from public,anon,authenticated;
create table if not exists ingressos_migration_audit.function_snapshots(
 version text not null,signature text not null,definition text not null,acl text,captured_at timestamptz not null default now(),primary key(version,signature));
alter table ingressos_migration_audit.function_snapshots enable row level security;
revoke all on ingressos_migration_audit.function_snapshots from public,anon,authenticated;
insert into ingressos_migration_audit.function_snapshots(version,signature,definition,acl)
select '027_camarotes',p.oid::regprocedure::text,pg_get_functiondef(p.oid),p.proacl::text
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and
p.proname in ('create_order','quote_order','issue_tickets','validate_order_participants','claim_inline_creation','reject_inline_creation','reset_inline_creation','reconcile_inline_payment','verified_customer_email','create_ticket_share','read_ticket_share') on conflict do nothing;
do $$begin
 if to_regprocedure('public.record_verified_inline_payment(uuid,text,uuid,text,integer,text,timestamptz)') is null
 or to_regclass('public.inline_payment_history') is null then raise exception 'Auditoria divergente: pré-requisito 012 ausente';end if;
end$$;
alter table public.tickets add column if not exists holder jsonb;
alter table public.tickets add column if not exists ticket_number integer;
alter table public.orders add column if not exists email_delivery_status text not null default 'not_configured';
create table if not exists public.ticket_shares(secret text primary key,ticket_id uuid not null references public.tickets(id),expires_at timestamptz not null,created_by uuid not null references auth.users(id),created_at timestamptz not null default now());
alter table public.ticket_shares enable row level security;
revoke all on public.ticket_shares from public,anon,authenticated;
create table if not exists public.ticket_email_outbox(order_id uuid primary key references public.orders(id),status text not null default 'pending' check(status in ('pending','sending','sent','failed')),attempts integer not null default 0,locked_at timestamptz,sent_at timestamptz,provider_id text,last_error text);
alter table public.ticket_email_outbox enable row level security;
revoke all on public.ticket_email_outbox from public,anon,authenticated;
grant all on public.ticket_shares,public.ticket_email_outbox to service_role;
-- Keep any existing verified-email helper; do not replace unrelated access policy.
do $outer$begin if to_regprocedure('public.verified_customer_email()') is null then
execute $ddl$create function public.verified_customer_email() returns text language sql stable security definer set search_path='' as $fn$select lower(u.email) from auth.users u join public.profiles p on p.id=u.id where u.id=auth.uid() and p.active and u.email_confirmed_at is not null and not u.is_anonymous$fn$$ddl$;
revoke all on function public.verified_customer_email() from public,anon;
grant execute on function public.verified_customer_email() to authenticated;
end if;end$outer$;
create or replace function public.create_ticket_share(ticket_code uuid) returns text language plpgsql security definer set search_path='' as $$declare t public.tickets;o public.orders;token text;begin
 select * into t from public.tickets where code=ticket_code;
 select * into o from public.orders where id=t.order_id;
 if not public.active_customer() or auth.uid() is null or o.id is null or (o.user_id=auth.uid() or lower(o.buyer->>'email')=public.verified_customer_email()) is not true or o.status<>'approved' or o.payment_review or t.cancelled or t.used_at is not null then raise exception 'Ingresso indisponível';end if;
 token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
 delete from public.ticket_shares where ticket_id=t.id;insert into public.ticket_shares(secret,ticket_id,expires_at,created_by) values(token,t.id,now()+interval '24 hours',auth.uid());return token;
end$$;

create or replace function public.read_ticket_share(secret text) returns jsonb language plpgsql security definer set search_path='' as $$declare payload jsonb;begin
 if secret is null or secret !~ '^[a-f0-9]{64}$' then raise exception 'Link inválido';end if;
 select o.snapshot||jsonb_build_object('code',t.code,'holderName',coalesce(t.holder->>'name',o.buyer->>'name')) into payload from public.ticket_shares s join public.tickets t on t.id=s.ticket_id join public.orders o on o.id=t.order_id where s.secret=read_ticket_share.secret and s.expires_at>now() and o.status='approved' and not o.payment_review and not t.cancelled and t.used_at is null;
 if payload is null then raise exception 'Link expirado ou ingresso indisponível';end if;return payload;
end$$;

revoke all on function public.create_ticket_share(uuid),public.read_ticket_share(text) from public,anon,authenticated;
grant execute on function public.create_ticket_share(uuid) to authenticated;
grant execute on function public.read_ticket_share(text) to anon,authenticated;
alter table public.inline_payment_attempts add column if not exists creation_lease uuid;
alter table public.inline_payment_attempts add column if not exists creation_lease_until timestamptz;
alter table public.inline_payment_attempts add column if not exists creation_count integer not null default 0;
-- Serialize HTTP submissions too; a lease outlives the provider request timeout.
create or replace function public.claim_inline_creation(purchase_id uuid,attempt_id uuid,lease_id uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare a public.inline_payment_attempts;begin
 select * into a from public.inline_payment_attempts where order_id=purchase_id for update;
 if a.order_id is null or a.attempt_key<>attempt_id or a.provider_id is not null
 or a.creation_lease_until>now() then return 0;end if;
 update public.inline_payment_attempts set creation_lease=lease_id,creation_lease_until=now()+interval '60 seconds',
 creation_count=case when a.creation_lease is null then 1 else a.creation_count+1 end where order_id=purchase_id;
 return case when a.creation_lease is null then 1 else a.creation_count+1 end;
end$$;
-- Only a definitive rejection of the very first leased request permits a new key.
create or replace function public.reject_inline_creation(purchase_id uuid,attempt_id uuid,lease_id uuid)
returns void language plpgsql security definer set search_path='' as $$begin
 update public.inline_payment_attempts set status='rejected',creation_lease_until=null
 where order_id=purchase_id and attempt_key=attempt_id and creation_lease=lease_id
 and creation_count=1 and provider_id is null and status='creating';
end$$;
revoke all on function public.claim_inline_creation(uuid,uuid,uuid),public.reject_inline_creation(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_inline_creation(uuid,uuid,uuid),public.reject_inline_creation(uuid,uuid,uuid) to service_role;

-- Reset transport fields when the existing 011 routine rotates an attempt key.
create or replace function public.reset_inline_creation() returns trigger language plpgsql set search_path='' as $$begin
 if old.attempt_key<>new.attempt_key then new.creation_lease:=null;new.creation_lease_until:=null;new.creation_count:=0;end if;
 return new;
end$$;
revoke all on function public.reset_inline_creation() from public,anon,authenticated;
drop trigger if exists reset_inline_creation on public.inline_payment_attempts;
create trigger reset_inline_creation before update on public.inline_payment_attempts for each row execute function public.reset_inline_creation();

-- One transaction holds the event/order locks through verification, reversal and issuance.
create or replace function public.reconcile_inline_payment(
 purchase_id uuid,external_payment_id text,attempt_id uuid,provider_status text,
 paid_cents integer,payment_method text,provider_updated timestamptz,provider_fee integer,refunded_cents integer
) returns text language plpgsql security definer set search_path='' as $$
declare result text;o public.orders;begin
 if refunded_cents is null or refunded_cents<0 or refunded_cents>paid_cents
 or provider_fee<0 or provider_fee>paid_cents then raise exception 'Tarifa/estorno inválido';end if;
 result:=public.record_verified_inline_payment(purchase_id,external_payment_id,attempt_id,provider_status,paid_cents,payment_method,provider_updated);
 if result in ('review','stale') then return result;end if;
 select * into o from public.orders where id=purchase_id for update;
 -- A refund seen before the first approval must never subsequently issue tickets.
 if provider_status in ('refunded','charged_back') or refunded_cents>0 then
  update public.orders set payment_review=true,payment_status=provider_status where id=o.id;
  if o.payment_id=external_payment_id then
   perform public.record_payment_reversal(o.id,external_payment_id,provider_status,provider_status in ('refunded','charged_back'));
  end if;
  return 'review';
 end if;
 if o.payment_review then return 'review';end if;
 if provider_status='approved' then
  -- Also recover a previous verified approval where settlement was never completed.
  perform public.settle_marketplace_payment(o.id,external_payment_id,paid_cents,'BRL',provider_fee,payment_method);
  return 'approved';
 end if;
 return result;
end$$;
revoke all on function public.reconcile_inline_payment(uuid,text,uuid,text,integer,text,timestamptz,integer,integer) from public,anon,authenticated;
grant execute on function public.reconcile_inline_payment(uuid,text,uuid,text,integer,text,timestamptz,integer,integer) to service_role;


do $$begin
 if to_regprocedure('public.reconcile_inline_payment(uuid,text,uuid,text,integer,text,timestamptz,integer,integer)') is null
 or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='tickets' and column_name='holder')
 then raise exception 'Pré-requisitos de pagamento/participantes ausentes. Audite 012,013,014; não aplique migrações antigas cegamente';end if;
end$$;
alter table public.ticket_types drop constraint ticket_kind;
alter table public.ticket_types add constraint ticket_kind check(type in ('individual','table','camarote'));
create unique index camarote_event_name_unique on public.ticket_types(event_id,lower(trim(name))) where type='camarote';
-- One ticket_type represents exactly one numbered room. Existing table/individual unchanged.
create function public.guard_camarote() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.type='camarote' then
  if new.capacity<>1 or coalesce((new.details->>'wristbands')::integer,0) not between 1 and 100 then raise exception 'Camarote: estoque 1 e entre 1 e 100 pulseiras';end if;
  if coalesce((new.details->>'mapX')::numeric,50) not between 0 and 100 or coalesce((new.details->>'mapY')::numeric,50) not between 0 and 100 then raise exception 'Posição do camarote inválida';end if;
 end if;
 if tg_op='UPDATE' and (old.type='camarote' or new.type='camarote') and
 (old.type<>new.type or old.details->>'wristbands' is distinct from new.details->>'wristbands') and exists(select 1 from public.orders where ticket_type_id=old.id) then raise exception 'Preserve modalidade e pulseiras dos camarotes com histórico';end if;
 return new;
end$$;
revoke all on function public.guard_camarote() from public,anon,authenticated;
create trigger guard_camarote before insert or update on public.ticket_types for each row execute function public.guard_camarote();
create or replace function public.validate_order_participants(details jsonb,units integer,buyer jsonb) returns jsonb language plpgsql set search_path='' as $$
declare holders jsonb;p jsonb;birth date;rating integer;need boolean;seen text[]:='{}';cpf text;begin
 if units is null or units not between 1 and 100 then raise exception 'Quantidade inválida';end if;
 rating:=case coalesce(details->>'ageRating','Livre') when 'Livre' then 0 when '12+' then 12 when '14+' then 14 when '16+' then 16 when '18+' then 18 else 99 end;
 need:=rating=18 or coalesce((details->>'requireAgeConfirmation')::boolean,false);
 if need and coalesce((buyer->>'ageConfirmed')::boolean,false)=false then raise exception 'Confirmação de maioridade obrigatória';end if;
 birth:=nullif(buyer->>'birthDate','')::date;
 if birth is null or birth>current_date or birth<'1900-01-01' or extract(year from age(current_date,birth))<greatest(rating,case when need then 18 else 0 end) then raise exception 'Idade inferior à classificação ou nascimento inválido';end if;
 if coalesce(buyer->>'participantMode','same') not in ('same','individual') then raise exception 'Modo de participantes inválido';end if;
 if coalesce(buyer->>'participantMode','same')='same' then
  if units>1 and coalesce((details->>'allowSameCpf')::boolean,true)=false then raise exception 'Participantes individuais obrigatórios';end if;
  select jsonb_agg(jsonb_build_object('name',buyer->>'name','cpf',buyer->>'cpf','birthDate',buyer->>'birthDate')) into holders from generate_series(1,units);
 else holders:=buyer->'participants';end if;
 if holders is null or jsonb_typeof(holders)<>'array' or jsonb_array_length(holders)<>units then raise exception 'Informe um participante por ingresso';end if;
 for p in select value from jsonb_array_elements(holders) loop
  cpf:=regexp_replace(coalesce(p->>'cpf',''),'[^0-9]','','g');
  if not public.valid_cpf(cpf) or coalesce(length(trim(p->>'name')),0) not between 1 and 120 then raise exception 'Nome ou CPF inválido';end if;
  birth:=nullif(p->>'birthDate','')::date;
  if birth is null or birth>current_date or birth<'1900-01-01' or extract(year from age(current_date,birth))<greatest(rating,case when need then 18 else 0 end) then raise exception 'Idade inferior à classificação';end if;
  if coalesce((details->>'allowSameCpf')::boolean,true)=false and cpf=any(seen) then raise exception 'CPF repetido';end if;
  seen:=array_append(seen,cpf);
 end loop;
 return holders;
end$$;

create or replace function public.quote_order(batch_id uuid,units integer,coupon_code text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.ticket_types;e public.events;c public.coupons;subtotal integer;discount integer:=0;fee integer;uses integer;own_uses integer;begin
 if not public.active_customer() then raise exception 'Conta ativa obrigatória';end if;
 if units is null or units not between 1 and 10 then raise exception 'Escolha entre 1 e 10 unidades';end if;
 select * into t from public.ticket_types where id=batch_id;
 select * into e from public.events where id=t.event_id;
 if e.id is null or not e.published or e.archived or not exists(select 1 from public.organizations where id=e.organization_id and active) or not public.batch_open(t.id) then raise exception 'Ingresso indisponível';end if;
 if public.batch_remaining(t.id)<units then raise exception 'Estoque insuficiente';end if;
 if t.type='camarote' and units<>1 then raise exception 'Compre um camarote inteiro por pedido';end if;
 subtotal:=t.price_cents*units;
 if trim(coalesce(coupon_code,''))<>'' then
  select * into c from public.coupons where (event_id=e.id or event_id is null) and code=upper(trim(coupon_code)) order by event_id nulls last limit 1;
  if c.id is null or not c.active or c.starts_at>now() or c.expires_at<=now() or c.ticket_type_id is not null and c.ticket_type_id<>t.id then raise exception 'Cupom inválido ou expirado';end if;
  select count(*),count(*) filter(where user_id=auth.uid()) into uses,own_uses from public.orders where coupon_id=c.id and (status='approved' or status='pending' and expires_at>now());
  if c.max_uses>0 and uses>=c.max_uses or c.max_per_user>0 and own_uses>=c.max_per_user then raise exception 'Limite do cupom atingido';end if;
  discount:=least(subtotal,case when c.kind='fixed' then round(c.amount*100)::integer else round(subtotal*c.amount/100)::integer end);
 end if;
 fee:=round((subtotal-discount)*e.fee_rate)::integer;
 return jsonb_build_object('subtotal',subtotal/100.0,'discount',discount/100.0,'fee',case when coalesce(e.details->>'feePayer','buyer')='organizer' then 0 else fee/100.0 end,'platformFee',fee/100.0,'feePayer',coalesce(e.details->>'feePayer','buyer'),'feeRate',e.fee_rate,'total',(subtotal-discount+case when coalesce(e.details->>'feePayer','buyer')='organizer' then 0 else fee end)/100.0,'coupon',upper(trim(coalesce(coupon_code,''))),'couponId',c.id);
end$$;

create or replace function public.create_order(batch_id uuid,units integer,buyer_data jsonb,coupon_code text,request_id uuid,referral text default null,campaign_name text default null) returns uuid language plpgsql security definer set search_path='' as $$
declare t public.ticket_types;e public.events;q jsonb;existing public.orders;target uuid:=gen_random_uuid();email text;birth date;holders jsonb;vip jsonb;begin
 if not public.active_customer() then raise exception 'Conta ativa obrigatória';end if;
 if request_id is null then raise exception 'Identificador obrigatório';end if;
 perform pg_advisory_xact_lock(hashtextextended(request_id::text,0));
 select * into existing from public.orders where idempotency_key=request_id;
 if found then
  if existing.user_id<>auth.uid() or existing.ticket_type_id<>batch_id or existing.quantity<>units then raise exception 'Requisição incompatível';end if;
  return existing.id;
 end if;
 perform pg_advisory_xact_lock(hashtextextended('buyer:'||auth.uid()::text,0));
 if (select count(*) from public.orders where user_id=auth.uid() and status='pending' and expires_at>now())>=5 then raise exception 'Limite de reservas ativas atingido. Cancele ou conclua os pedidos anteriores';end if;
 select * into t from public.ticket_types where id=batch_id;
 -- Serialize stock operations per event, including sequential batches and event edits.
 select * into e from public.events where id=t.event_id for update;
 if e.id is null then raise exception 'Evento não encontrado';end if;
 perform 1 from public.ticket_types where id=batch_id for update;
 perform 1 from public.coupons where (event_id=e.id or event_id is null) and code=upper(trim(coupon_code)) order by event_id nulls last for update;
 select * into t from public.ticket_types where id=batch_id;
 if t.type='camarote' and units<>1 then raise exception 'Compre um camarote inteiro por pedido';end if;
 q:=public.quote_order(batch_id,units,coupon_code);
 if not public.valid_cpf(buyer_data->>'cpf') or coalesce(length(trim(buyer_data->>'name')),0) not between 1 and 120 or regexp_replace(coalesce(buyer_data->>'phone',''),'[^0-9]','','g') !~ '^[0-9]{10,13}$' then raise exception 'Confira nome, CPF e telefone';end if;
 birth:=nullif(buyer_data->>'birthDate','')::date;
 if birth is null or birth>current_date or birth<'1900-01-01' then raise exception 'Data de nascimento inválida';end if;
 select u.email into email from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null;
 if email is null and exists(select 1 from auth.users where id=auth.uid() and is_anonymous) then email:=lower(trim(buyer_data->>'email'));end if;
 if email is null or email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Informe ou confirme seu e-mail';end if;
 holders:=public.validate_order_participants(e.details,case when t.type='camarote' then (t.details->>'wristbands')::integer else units end,buyer_data);
 if nullif(buyer_data->>'vipListId','') is not null then
  select value into vip from jsonb_array_elements(coalesce(e.details->'vipLists','[]')) where value->>'id'=buyer_data->>'vipListId';
  if vip is null or units<>1 or coalesce((vip->>'active')::boolean,true)=false or coalesce((vip->>'visible')::boolean,true)=false or nullif(vip->>'deadline','')::timestamptz<=now() or vip->>'ticketTypeId'<>batch_id::text or round((vip->>'price')::numeric*100)::integer<>t.price_cents then raise exception 'Lista VIP indisponível';end if;
  update public.vip_entries set status='cancelled' where event_id=e.id and status='pending' and order_id in(select id from public.orders where expires_at<=now() and status='pending');
  if exists(select 1 from public.vip_entries where event_id=e.id and list_id=vip->>'id' and cpf=regexp_replace(buyer_data->>'cpf','[^0-9]','','g') and status<>'cancelled') then raise exception 'CPF já inscrito';end if;

  if (select count(*) from public.vip_entries v left join public.orders vo on vo.id=v.order_id where v.event_id=e.id and v.list_id=vip->>'id' and (v.status in ('confirmed','used') or v.status='pending' and vo.expires_at>now()))>=(vip->>'limit')::integer then raise exception 'Lista VIP esgotada';end if;
 end if;
 insert into public.orders(id,user_id,event_id,ticket_type_id,quantity,total_cents,buyer,idempotency_key,source,campaign,subtotal_cents,discount_cents,fee_cents,coupon_id,expires_at,status,snapshot)
 values(target,auth.uid(),e.id,t.id,units,round((q->>'total')::numeric*100)::integer,jsonb_build_object('name',trim(buyer_data->>'name'),'email',email,'cpf',regexp_replace(buyer_data->>'cpf','[^0-9]','','g'),'phone',left(buyer_data->>'phone',25),'birthDate',birth,'participants',holders,'participantMode',coalesce(buyer_data->>'participantMode','same'),'ageConfirmed',coalesce((buyer_data->>'ageConfirmed')::boolean,false)),request_id,left(referral,120),left(campaign_name,120),round((q->>'subtotal')::numeric*100)::integer,round((q->>'discount')::numeric*100)::integer,round((q->>'platformFee')::numeric*100)::integer,(q->>'couponId')::uuid,now()+interval '15 minutes',case when (q->>'total')::numeric=0 then 'approved' else 'pending' end,jsonb_build_object('feePayer',q->>'feePayer','feeRate',q->'feeRate','eventTitle',e.title,'eventImage',e.details->>'image','eventDate',e.details->>'date','eventTime',e.details->>'time','ticketName',t.name,'batch',t.batch,'sector',t.sector,'wristbands',case when t.type='camarote' then (t.details->>'wristbands')::integer end,'unitLabel',case when t.type='camarote' then 'Pulseira individual do camarote' when t.type='table' then 'Mesa/camarote — entrada única do grupo' else 'Individual' end));
 insert into public.order_items(order_id,ticket_type_id,quantity,unit_price_cents) values(target,t.id,units,t.price_cents);
 if (q->>'couponId') is not null then insert into public.coupon_uses(coupon_id,order_id,user_id) values((q->>'couponId')::uuid,target,auth.uid());end if;
 if vip is not null then insert into public.vip_entries(event_id,list_id,user_id,name,cpf,phone,birth_date,status,order_id) values(e.id,vip->>'id',auth.uid(),buyer_data->>'name',regexp_replace(buyer_data->>'cpf','[^0-9]','','g'),buyer_data->>'phone',birth,case when (q->>'total')::numeric=0 then 'confirmed' else 'pending' end,target);end if;
 if (q->>'total')::numeric=0 then perform public.issue_tickets(target);end if;
 insert into public.audit_log(event_id,actor,action) values(e.id,auth.uid(),'order.created:'||target);
 return target;
end$$;

create or replace function public.issue_tickets(purchase_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare o public.orders;emitted integer;begin
 select * into o from public.orders where id=purchase_id for update;
 if o.id is null or o.status<>'approved' or o.payment_review then raise exception 'Pedido não aprovado';end if;
 if o.snapshot->>'wristbands' is null and exists(select 1 from public.tickets where order_id=o.id) then return;end if;
 insert into public.tickets(order_id,holder,ticket_number) select o.id,coalesce(o.buyer->'participants'->(n-1),jsonb_build_object('name',o.buyer->>'name','cpf',o.buyer->>'cpf')),n from generate_series(1,coalesce((o.snapshot->>'wristbands')::integer,o.quantity)) n where not exists(select 1 from public.tickets t where t.order_id=o.id and t.ticket_number=n);
 get diagnostics emitted=row_count;
 if emitted=0 then return;end if;
 insert into public.ticket_email_outbox(order_id) values(o.id) on conflict do nothing;
 update public.orders set email_delivery_status='pending' where id=o.id;
end$$;


-- Public status contains no buyers, prices, payment IDs or QR codes.
create function public.camarote_availability(target uuid) returns table(id uuid,status text) language sql stable security definer set search_path='' as $$
 select t.id,case when not t.active then 'blocked'
 when exists(select 1 from public.orders o where o.ticket_type_id=t.id and o.status='approved') then 'sold'
 when exists(select 1 from public.orders o where o.ticket_type_id=t.id and o.status='pending' and o.expires_at>now()) then 'reserved'
 when not public.batch_open(t.id) then 'unavailable' else 'available' end
 from public.ticket_types t join public.events e on e.id=t.event_id join public.organizations org on org.id=e.organization_id
 where t.event_id=target and t.type='camarote' and ((e.published and not e.archived and org.active) or public.can_access_event(e.id,array['admin','organizador']));
$$;
revoke all on function public.camarote_availability(uuid) from public;
grant execute on function public.camarote_availability(uuid) to anon,authenticated;
-- Only definitive provider cancellation/rejection releases early. Network failures keep the reservation.
create function public.release_rejected_camarote() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.status in ('rejected','cancelled') and old.status is distinct from new.status then
  update public.orders o set status='cancelled',expires_at=least(o.expires_at,now())
  where o.id=new.order_id and o.status='pending' and o.snapshot->>'wristbands' is not null;
 end if;return new;
end$$;
revoke all on function public.release_rejected_camarote() from public,anon,authenticated;
create trigger release_rejected_camarote after update on public.inline_payment_attempts for each row execute function public.release_rejected_camarote();

-- No new browser payment authority. All replaced functions retain their existing grants.
-- Included atomically by 027_camarotes.sql; not a standalone activation file.
alter table public.orders add column if not exists camarote_payment_started_at timestamptz;
create or replace function public.prepare_camarote_payment(purchase_id uuid,buyer_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.orders;event uuid;begin
 select event_id into event from public.orders where id=purchase_id;
 perform 1 from public.events where id=event for update;
 select * into o from public.orders where id=purchase_id for update;
 if o.id is null or o.user_id is distinct from buyer_id or o.snapshot->>'wristbands' is null or o.status<>'pending' or o.payment_review or o.expires_at<=now() then raise exception 'Reserva indisponível';end if;
 if o.camarote_payment_started_at is null and o.payment_id is null then
  update public.orders set expires_at=now()+interval '32 minutes',camarote_payment_started_at=now() where id=o.id returning * into o;
 end if;
 return to_jsonb(o);
end$$;
revoke all on function public.prepare_camarote_payment(uuid,uuid) from public,anon,authenticated;
grant execute on function public.prepare_camarote_payment(uuid,uuid) to service_role;

create or replace function public.reconcile_camarote_payment(purchase_id uuid,provider_payment jsonb) returns text language plpgsql security definer set search_path='' as $$
declare o public.orders;event uuid;provider_status text;external_id text;paid integer;refund integer;fee integer;method text;begin
 select event_id into event from public.orders where id=purchase_id;
 perform 1 from public.events where id=event for update;
 select * into o from public.orders where id=purchase_id for update;
 provider_status:=provider_payment->>'status';external_id:=provider_payment->>'id';
 paid:=round((provider_payment->>'transaction_amount')::numeric*100)::integer;
 refund:=round(coalesce((provider_payment->>'transaction_amount_refunded')::numeric,0)*100)::integer;
 select coalesce(sum(round((v->>'amount')::numeric*100)),0)::integer into fee from jsonb_array_elements(coalesce(provider_payment->'fee_details','[]')) v;
 method:=case when provider_payment->>'payment_method_id'='pix' then 'pix' else 'card' end;
 if o.id is null or o.snapshot->>'wristbands' is null or external_id !~ '^[0-9]+$' or external_id is null
 or provider_payment->>'external_reference' is distinct from o.id::text or provider_payment->>'currency_id' is distinct from 'BRL'
 or paid is distinct from o.total_cents or paid<=0 or refund<0 or refund>paid or fee<0 or fee>paid
 or provider_status is null or provider_status not in ('pending','in_process','authorized','approved','rejected','cancelled','refunded','charged_back') then raise exception 'Pagamento incompatível';end if;
 if provider_status in ('refunded','charged_back') or refund>0 then
  update public.orders set payment_review=true,payment_status=provider_status where id=o.id;
  if o.payment_id=external_id then perform public.record_payment_reversal(o.id,external_id,provider_status,provider_status in ('refunded','charged_back') or refund=paid);end if;
  return 'review';
 end if;
 if o.payment_review then return 'review';end if;
 if o.status='approved' then
  if o.payment_id=external_id then return 'approved';end if;
  if provider_status='approved' then update public.orders set payment_review=true,payment_status='review' where id=o.id;return 'review';end if;
  return 'approved';
 end if;
 if provider_status='approved' then
  if o.status<>'pending' or o.expires_at<=now() then
   update public.orders set payment_review=true,payment_status='review' where id=o.id;
   insert into public.audit_log(event_id,action) values(o.event_id,'camarote.late_payment_review:'||o.id||':'||external_id);
   return 'review';
  end if;
  perform public.settle_marketplace_payment(o.id,external_id,paid,'BRL',fee,method);
  update public.orders set payment_status='approved' where id=o.id;
  return 'approved';
 end if;
 if o.status<>'pending' then return o.status;end if;
 if provider_status in ('rejected','cancelled') then
  update public.orders set status='cancelled',payment_status=provider_status,expires_at=least(expires_at,now()) where id=o.id;return 'cancelled';
 end if;
 update public.orders set payment_status=provider_status,payment_id=coalesce(payment_id,external_id) where id=o.id;
 return case when o.expires_at<=now() then 'expired' else 'pending' end;
end$$;
revoke all on function public.reconcile_camarote_payment(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.reconcile_camarote_payment(uuid,jsonb) to service_role;

notify pgrst,'reload schema';
commit;
