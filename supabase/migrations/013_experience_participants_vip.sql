-- Atualização 16. Não executar antes das migrations 001–012 (incluindo ambas 011).
-- Aplicação manual; nenhum segredo ou credencial é incluído.
begin;
do $$begin if to_regprocedure('public.record_verified_inline_payment(uuid,text,uuid,text,integer,text,timestamptz)') is null then raise exception 'Instale os pré-requisitos até 012';end if;end$$;
alter table public.organizations add column if not exists whatsapp text;
create or replace function public.set_organization_contact(organization uuid,phone text) returns void language plpgsql security definer set search_path='' as $$begin
 if not public.is_admin() and not exists(select 1 from public.profiles where id=auth.uid() and active and role='organizador' and organization_id=organization) then raise exception 'Sem permissão';end if;
 if phone<>'' and regexp_replace(phone,'[^0-9]','','g') !~ '^[0-9]{10,15}$' then raise exception 'Telefone inválido';end if;
 update public.organizations set whatsapp=regexp_replace(phone,'[^0-9]','','g') where id=organization;
end$$;
revoke all on function public.set_organization_contact(uuid,text) from public,anon;
grant execute on function public.set_organization_contact(uuid,text) to authenticated;
alter table public.tickets add column if not exists holder jsonb;
alter table public.tickets add column if not exists ticket_number integer;
alter table public.orders add column if not exists email_delivery_status text not null default 'not_configured';
create table if not exists public.vip_entries(id uuid primary key default gen_random_uuid(),event_id uuid not null references public.events(id),list_id text not null,user_id uuid not null references auth.users(id),name text not null,cpf text not null,phone text not null,birth_date date not null,status text not null check(status in ('pending','confirmed','used','cancelled')),order_id uuid references public.orders(id),created_at timestamptz not null default now(),used_at timestamptz,used_by uuid references auth.users(id));
create unique index if not exists vip_unique_active on public.vip_entries(event_id,list_id,cpf) where status<>'cancelled';
alter table public.vip_entries enable row level security;
revoke all on public.vip_entries from public,anon,authenticated;
create table if not exists public.ticket_shares(secret text primary key,ticket_id uuid not null references public.tickets(id),expires_at timestamptz not null,created_by uuid not null references auth.users(id),created_at timestamptz not null default now());
alter table public.ticket_shares enable row level security;
revoke all on public.ticket_shares from public,anon,authenticated;
create table if not exists public.event_activity(event_id uuid not null references public.events(id),visitor uuid not null,kind text not null check(kind in ('view','checkout','share')),bucket timestamptz not null,last_seen timestamptz not null default now(),primary key(event_id,visitor,kind,bucket));
alter table public.event_activity enable row level security;
revoke all on public.event_activity from public,anon,authenticated;
create table if not exists public.ticket_email_outbox(order_id uuid primary key references public.orders(id),status text not null default 'pending' check(status in ('pending','sending','sent','failed')),attempts integer not null default 0,locked_at timestamptz,sent_at timestamptz,provider_id text,last_error text);
alter table public.ticket_email_outbox enable row level security;
revoke all on public.ticket_email_outbox from public,anon,authenticated;
grant all on public.ticket_email_outbox,public.ticket_shares to service_role;

create or replace function public.validate_order_participants(details jsonb,units integer,buyer jsonb) returns jsonb language plpgsql set search_path='' as $$
declare holders jsonb;p jsonb;birth date;rating integer;need boolean;seen text[]:='{}';cpf text;begin
 if units is null or units not between 1 and 10 then raise exception 'Quantidade inválida';end if;
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
  if not public.valid_cpf(cpf) or coalesce(length(trim(p->>'name')),0) not between 3 and 120 or trim(p->>'name') not like '% %' then raise exception 'Nome ou CPF inválido';end if;
  birth:=nullif(p->>'birthDate','')::date;
  if birth is null or birth>current_date or birth<'1900-01-01' or extract(year from age(current_date,birth))<greatest(rating,case when need then 18 else 0 end) then raise exception 'Idade inferior à classificação';end if;
  if coalesce((details->>'allowSameCpf')::boolean,true)=false and cpf=any(seen) then raise exception 'CPF repetido';end if;
  seen:=array_append(seen,cpf);
 end loop;
 return holders;
end$$;
revoke all on function public.validate_order_participants(jsonb,integer,jsonb) from public,anon,authenticated;

create or replace function public.issue_tickets(purchase_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare o public.orders;begin
 select * into o from public.orders where id=purchase_id for update;
 if o.id is null or o.status<>'approved' or o.payment_review then raise exception 'Pedido não aprovado';end if;
 if exists(select 1 from public.tickets where order_id=o.id) then return;end if;
 insert into public.tickets(order_id,holder,ticket_number) select o.id,coalesce(o.buyer->'participants'->(n-1),jsonb_build_object('name',o.buyer->>'name','cpf',o.buyer->>'cpf')),n from generate_series(1,o.quantity) n;
 insert into public.ticket_email_outbox(order_id) values(o.id) on conflict do nothing;
 update public.orders set email_delivery_status='pending' where id=o.id;
end$$;
revoke all on function public.issue_tickets(uuid) from public,anon,authenticated;
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
 q:=public.quote_order(batch_id,units,coupon_code);
 if not public.valid_cpf(buyer_data->>'cpf') or coalesce(length(trim(buyer_data->>'name')),0) not between 3 and 120 or trim(buyer_data->>'name') not like '% %' or regexp_replace(coalesce(buyer_data->>'phone',''),'[^0-9]','','g') !~ '^[0-9]{10,13}$' then raise exception 'Confira nome completo, CPF e telefone';end if;
 birth:=nullif(buyer_data->>'birthDate','')::date;
 if birth is null or birth>current_date or birth<'1900-01-01' then raise exception 'Data de nascimento inválida';end if;
 select u.email into email from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null;
 if email is null and exists(select 1 from auth.users where id=auth.uid() and is_anonymous) then email:=lower(trim(buyer_data->>'email'));end if;
 if email is null or email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Informe ou confirme seu e-mail';end if;
 holders:=public.validate_order_participants(e.details,units,buyer_data);
 if nullif(buyer_data->>'vipListId','') is not null then
  select value into vip from jsonb_array_elements(coalesce(e.details->'vipLists','[]')) where value->>'id'=buyer_data->>'vipListId';
  if vip is null or units<>1 or coalesce((vip->>'active')::boolean,true)=false or coalesce((vip->>'visible')::boolean,true)=false or nullif(vip->>'deadline','')::timestamptz<=now() or vip->>'ticketTypeId'<>batch_id::text or round((vip->>'price')::numeric*100)::integer<>t.price_cents then raise exception 'Lista VIP indisponível';end if;
  update public.vip_entries set status='cancelled' where event_id=e.id and status='pending' and order_id in(select id from public.orders where expires_at<=now() and status='pending');
  if exists(select 1 from public.vip_entries where event_id=e.id and list_id=vip->>'id' and cpf=regexp_replace(buyer_data->>'cpf','[^0-9]','','g') and status<>'cancelled') then raise exception 'CPF já inscrito';end if;
  
  if (select count(*) from public.vip_entries v left join public.orders vo on vo.id=v.order_id where v.event_id=e.id and v.list_id=vip->>'id' and (v.status in ('confirmed','used') or v.status='pending' and vo.expires_at>now()))>=(vip->>'limit')::integer then raise exception 'Lista VIP esgotada';end if;
 end if;
 insert into public.orders(id,user_id,event_id,ticket_type_id,quantity,total_cents,buyer,idempotency_key,source,campaign,subtotal_cents,discount_cents,fee_cents,coupon_id,expires_at,status,snapshot)
 values(target,auth.uid(),e.id,t.id,units,round((q->>'total')::numeric*100)::integer,jsonb_build_object('name',trim(buyer_data->>'name'),'email',email,'cpf',regexp_replace(buyer_data->>'cpf','[^0-9]','','g'),'phone',left(buyer_data->>'phone',25),'birthDate',birth,'participants',holders,'participantMode',coalesce(buyer_data->>'participantMode','same'),'ageConfirmed',coalesce((buyer_data->>'ageConfirmed')::boolean,false)),request_id,left(referral,120),left(campaign_name,120),round((q->>'subtotal')::numeric*100)::integer,round((q->>'discount')::numeric*100)::integer,round((q->>'platformFee')::numeric*100)::integer,(q->>'couponId')::uuid,now()+interval '15 minutes',case when (q->>'total')::numeric=0 then 'approved' else 'pending' end,jsonb_build_object('feePayer',q->>'feePayer','feeRate',q->'feeRate','eventTitle',e.title,'eventImage',e.details->>'image','eventDate',e.details->>'date','eventTime',e.details->>'time','ticketName',t.name,'batch',t.batch,'sector',t.sector,'unitLabel',case when t.type='table' then 'Mesa/camarote — entrada única do grupo' else 'Individual' end));
 insert into public.order_items(order_id,ticket_type_id,quantity,unit_price_cents) values(target,t.id,units,t.price_cents);
 if (q->>'couponId') is not null then insert into public.coupon_uses(coupon_id,order_id,user_id) values((q->>'couponId')::uuid,target,auth.uid());end if;
 if vip is not null then insert into public.vip_entries(event_id,list_id,user_id,name,cpf,phone,birth_date,status,order_id) values(e.id,vip->>'id',auth.uid(),buyer_data->>'name',regexp_replace(buyer_data->>'cpf','[^0-9]','','g'),buyer_data->>'phone',birth,case when (q->>'total')::numeric=0 then 'confirmed' else 'pending' end,target);end if;
 if (q->>'total')::numeric=0 then perform public.issue_tickets(target);end if;
 insert into public.audit_log(event_id,actor,action) values(e.id,auth.uid(),'order.created:'||target);
 return target;
end$$;

revoke all on function public.create_order(uuid,integer,jsonb,text,uuid,text,text) from public,anon;
grant execute on function public.create_order(uuid,integer,jsonb,text,uuid,text,text) to authenticated;

-- Guard fields on the database, including writes made outside the UI.
create or replace function public.guard_experience_event() returns trigger language plpgsql security definer set search_path='' as $$
declare l jsonb;ids text[]:='{}';begin
 if coalesce(new.details->>'ageRating','Livre') not in ('Livre','12+','14+','16+','18+') then raise exception 'Classificação inválida';end if;
 if not public.is_primary_admin() then new.details:=new.details-array['activityMode','activityMin','activityMax'];if tg_op='UPDATE' then new.details:=new.details||jsonb_strip_nulls(jsonb_build_object('activityMode',old.details->'activityMode','activityMin',old.details->'activityMin','activityMax',old.details->'activityMax'));end if;
 else
  if coalesce(new.details->>'activityMode','real') not in ('real','initial','off') or coalesce((new.details->>'activityMin')::integer,0)<0 or coalesce((new.details->>'activityMax')::integer,0)>200 or coalesce((new.details->>'activityMin')::integer,0)>coalesce((new.details->>'activityMax')::integer,0) then raise exception 'Faixa de interesse inválida';end if;
 end if;
 if jsonb_typeof(coalesce(new.details->'vipLists','[]'))<>'array' then raise exception 'Listas inválidas';end if;
 for l in select value from jsonb_array_elements(coalesce(new.details->'vipLists','[]')) loop
  if coalesce(l->>'id','')='' or l->>'id'=any(ids) or coalesce(length(trim(l->>'name')),0) not between 2 and 120 or coalesce((l->>'limit')::integer,0) not between 1 and 100000 or coalesce((l->>'price')::numeric,0)<0 or coalesce(l->>'audience','todos') not in ('feminino','masculino','todos','personalizado') then raise exception 'Confira a lista VIP';end if;
  if (select count(*) from public.vip_entries where event_id=new.id and list_id=l->>'id' and status in ('confirmed','used'))>(l->>'limit')::integer then raise exception 'Limite inferior aos inscritos';end if;
  ids:=array_append(ids,l->>'id');
 end loop;
 if exists(select 1 from public.vip_entries where event_id=new.id and not(list_id=any(ids))) then raise exception 'Preserve as listas com inscritos; encerre e oculte';end if;
 return new;
end$$;
drop trigger if exists guard_experience_event on public.events;
create trigger guard_experience_event before insert or update on public.events for each row execute function public.guard_experience_event();
revoke all on function public.guard_experience_event() from public,anon,authenticated;

create or replace function public.join_vip(target uuid,list_id text,person jsonb) returns text language plpgsql security definer set search_path='' as $$
declare e public.events;l jsonb;cpf text;begin
 if not public.active_customer() then raise exception 'Inicie a compra rápida ou entre';end if;
 select * into e from public.events where id=target for update;
 select value into l from jsonb_array_elements(coalesce(e.details->'vipLists','[]')) where value->>'id'=list_id;
 if e.id is null or not e.published or e.archived or l is null or coalesce((l->>'active')::boolean,true)=false or coalesce((l->>'visible')::boolean,true)=false or nullif(l->>'deadline','')::timestamptz<=now() or coalesce((l->>'price')::numeric,0)>0 then raise exception 'Lista indisponível; listas pagas usam checkout';end if;
 perform public.validate_order_participants(e.details,1,person);
 if regexp_replace(coalesce(person->>'phone',''),'[^0-9]','','g') !~ '^[0-9]{10,13}$' then raise exception 'Telefone inválido';end if;
 cpf:=regexp_replace(person->>'cpf','[^0-9]','','g');
 update public.vip_entries set status='cancelled' where event_id=target and status='pending' and order_id in(select id from public.orders where expires_at<=now() and status='pending');
 if (select count(*) from public.vip_entries v left join public.orders o on o.id=v.order_id where v.event_id=target and v.list_id=join_vip.list_id and (v.status in ('confirmed','used') or v.status='pending' and o.expires_at>now()))>=(l->>'limit')::integer then raise exception 'Lista esgotada';end if;
 insert into public.vip_entries(event_id,list_id,user_id,name,cpf,phone,birth_date,status) values(target,list_id,auth.uid(),trim(person->>'name'),cpf,person->>'phone',(person->>'birthDate')::date,'confirmed');return 'confirmed';
end$$;
create or replace function public.vip_entries_for_event(target uuid) returns jsonb language plpgsql security definer set search_path='' as $$begin
 if not public.can_access_event(target,array['admin','organizador','checkin']) then raise exception 'Sem permissão';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'list_id',list_id,'name',name,'cpf',right(cpf,4),'status',case when status='pending' and order_id in(select id from public.orders where expires_at<=now()) then 'expired' else status end,'createdAt',created_at,'usedAt',used_at,'orderId',order_id)),'[]') from public.vip_entries where event_id=target);
end$$;
create or replace function public.check_in_vip(entry_id uuid,target uuid) returns text language plpgsql security definer set search_path='' as $$declare r public.vip_entries;o public.orders;begin
 if not public.can_access_event(target,array['admin','organizador','checkin']) then raise exception 'Sem permissão';end if;
 perform 1 from public.events where id=target for update;
 select * into r from public.vip_entries where id=entry_id and event_id=target for update;
 if r.id is null or r.status<>'confirmed' then raise exception 'Entrada indisponível';end if;
 if r.order_id is not null then raise exception 'Lista paga: valide o QR do ingresso na portaria';end if;
 update public.vip_entries set status='used',used_at=now(),used_by=auth.uid() where id=r.id;
 insert into public.audit_log(event_id,actor,action) values(target,auth.uid(),'vip.checkin:'||r.id);return 'used';
end$$;
create or replace function public.sync_vip_ticket_checkin() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.used_at is not null then update public.vip_entries set status='used',used_at=new.used_at,used_by=new.used_by where order_id=new.order_id;end if;return new;
end$$;
drop trigger if exists sync_vip_ticket_checkin on public.tickets;
create trigger sync_vip_ticket_checkin after update of used_at on public.tickets for each row execute function public.sync_vip_ticket_checkin();
revoke all on function public.sync_vip_ticket_checkin() from public,anon,authenticated;
create or replace function public.sync_paid_vip() returns trigger language plpgsql security definer set search_path='' as $$begin
 update public.vip_entries set status=case when new.status='approved' and not new.payment_review then 'confirmed' when new.status in ('cancelled','refunded') or new.payment_review then 'cancelled' else 'pending' end where order_id=new.id and status<>'used';return new;
end$$;
drop trigger if exists sync_paid_vip on public.orders;
create trigger sync_paid_vip after update of status,payment_review on public.orders for each row execute function public.sync_paid_vip();

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

create or replace function public.record_event_activity(target uuid,visitor uuid,kind text) returns void language plpgsql security definer set search_path='' as $$begin
 if visitor is null or kind not in ('view','checkout','share') or not exists(select 1 from public.events where id=target and published and not archived) then return;end if;
 insert into public.event_activity(event_id,visitor,kind,bucket) values(target,visitor,kind,date_trunc('hour',now())) on conflict(event_id,visitor,kind,bucket) do update set last_seen=now();
 delete from public.event_activity where event_id=target and bucket<now()-interval '2 days';
end$$;
create or replace function public.event_activity_summary(target uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('looking',count(distinct visitor) filter(where kind='view' and last_seen>now()-interval '2 minutes'),'today',count(*) filter(where bucket>=date_trunc('day',now()))) from public.event_activity where event_id=target and exists(select 1 from public.events where id=target and published and not archived);
$$;
-- Verified owner email can recover approved guest purchases on another device.
create or replace function public.verified_customer_email() returns text language sql stable security definer set search_path='' as $$select lower(u.email) from auth.users u join public.profiles p on p.id=u.id where u.id=auth.uid() and p.active and u.email_confirmed_at is not null and not u.is_anonymous$$;
revoke all on function public.verified_customer_email() from public,anon;
grant execute on function public.verified_customer_email() to authenticated;
drop policy if exists guest_order_recovery on public.orders;
create policy guest_order_recovery on public.orders for select to authenticated using(status='approved' and not payment_review and lower(buyer->>'email')=public.verified_customer_email());

create or replace function public.claim_ticket_email() returns jsonb language plpgsql security definer set search_path='' as $$declare r public.ticket_email_outbox;o public.orders;begin
 select b.* into r from public.ticket_email_outbox b join public.orders p on p.id=b.order_id where (b.status in ('pending','failed') or b.status='sending' and b.locked_at<now()-interval '10 minutes') and b.attempts<5 and p.status='approved' and not p.payment_review order by p.created_at for update of b skip locked limit 1;
 if r.order_id is null then return null;end if;
 update public.ticket_email_outbox set status='sending',attempts=attempts+1,locked_at=now() where order_id=r.order_id;
 select * into o from public.orders where id=r.order_id;
 return jsonb_build_object('orderId',o.id,'email',o.buyer->>'email','eventTitle',o.snapshot->>'eventTitle','quantity',o.quantity);
end$$;
revoke all on function public.claim_ticket_email() from public,anon,authenticated;
grant execute on function public.claim_ticket_email() to service_role;
do $$declare fn text;begin foreach fn in array array['join_vip(uuid,text,jsonb)','vip_entries_for_event(uuid)','check_in_vip(uuid,uuid)','create_ticket_share(uuid)'] loop execute 'revoke all on function public.'||fn||' from public,anon';execute 'grant execute on function public.'||fn||' to authenticated';end loop;end$$;
revoke all on function public.sync_paid_vip() from public,anon,authenticated;
revoke all on function public.read_ticket_share(text),public.record_event_activity(uuid,uuid,text),public.event_activity_summary(uuid) from public;
grant execute on function public.read_ticket_share(text),public.record_event_activity(uuid,uuid,text),public.event_activity_summary(uuid) to anon,authenticated;
notify pgrst,'reload schema';
commit;
