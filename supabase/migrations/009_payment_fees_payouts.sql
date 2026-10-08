begin;
do $$begin
 if to_regprocedure('public.is_primary_admin()') is null then raise exception 'Instale antes a migração 008_event_platform_fee_and_safe_delete.sql da Atualização 11';end if;
end$$;
alter table public.orders add column provider_fee_cents integer check(provider_fee_cents>=0);
alter table public.orders add column payout_status text not null default 'pending' check(payout_status in ('pending','paid'));
alter table public.orders add column payout_at timestamptz;
alter table public.orders add column payout_reference text;
alter table public.orders add column payout_by uuid references public.profiles(id);
alter table public.orders add column payout_cents integer check(payout_cents>0);
alter table public.orders add column payment_method text;
alter table public.orders add column payment_review boolean not null default false;
update public.orders set provider_fee_cents=0 where total_cents=0;
create or replace function public.save_event(payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare
 target uuid;org uuid;old public.events;part jsonb;tid uuid;seen uuid[]:='{}';reserved integer;
 requested_fee numeric;final_fee numeric;final_allow boolean:=false;details_payload jsonb;
begin
 if not public.active_customer() then raise exception 'Entre na sua conta';end if;
 target:=coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid());
 select * into old from public.events where id=target for update;
 org:=nullif(payload->>'organizerId','')::uuid;
 if not public.is_admin() then
  if old.id is not null and not public.can_access_event(target,array['organizador']) then raise exception 'Sem permissão';end if;
  select organization_id into org from public.profiles where id=auth.uid() and role='organizador' and active;
 end if;
 if org is null or not exists(select 1 from public.organizations where id=org and active) then raise exception 'Selecione uma organização ativa';end if;
 if old.id is not null and old.organization_id<>org and exists(select 1 from public.orders where event_id=target) then raise exception 'Evento com pedidos não pode trocar de organização';end if;
 if length(trim(payload->>'title')) not between 2 and 200 or coalesce(payload->>'slug','') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then raise exception 'Nome ou link inválido';end if;
 if jsonb_typeof(payload->'ticketTypes')<>'array' or jsonb_array_length(payload->'ticketTypes')<1 then raise exception 'Inclua pelo menos um lote';end if;
 if coalesce(payload->>'image','')<>'' and payload->>'image' !~ '^https://' then raise exception 'Use imagem HTTPS';end if;

 if coalesce(payload->>'feePayer','buyer') not in ('buyer','organizer') then raise exception 'Taxa inválida';end if;
 requested_fee:=coalesce(nullif(payload->>'feeRate','')::numeric,0.1);
 if requested_fee<0 or requested_fee>1 then raise exception 'Taxa da plataforma inválida';end if;

 if public.is_primary_admin() then
  final_fee:=requested_fee;
  final_allow:=false;
 elsif old.id is null then
  final_fee:=0.1;
  final_allow:=false;
 else
  final_fee:=old.fee_rate;
  final_allow:=false;
 end if;

 details_payload:=payload - array['id','ticketTypes','organizerId','organizerName','feeRate','feeEditableByOrganizer'];
 details_payload:=jsonb_set(details_payload,'{feeEditableByOrganizer}',to_jsonb(final_allow),true);

 insert into public.events(id,organization_id,slug,title,published,archived,details,fee_rate,legacy_id)
 values(target,org,payload->>'slug',trim(payload->>'title'),coalesce((payload->>'published')::boolean,false),coalesce((payload->>'archived')::boolean,false),details_payload,final_fee,nullif(payload->>'legacyId',''))
 on conflict(id) do update set organization_id=excluded.organization_id,slug=excluded.slug,title=excluded.title,published=excluded.published,archived=excluded.archived,details=excluded.details,fee_rate=excluded.fee_rate,legacy_id=coalesce(public.events.legacy_id,excluded.legacy_id);

 for part in select value from jsonb_array_elements(payload->'ticketTypes') loop
  tid:=coalesce(nullif(part->>'id','')::uuid,gen_random_uuid());
  if tid=any(seen) then raise exception 'Lote duplicado';end if;
  if exists(select 1 from public.ticket_types where id=tid and event_id<>target) then raise exception 'Lote de outro evento';end if;
  select coalesce(sum(quantity),0) into reserved from public.orders where ticket_type_id=tid and (status='approved' or status='pending' and expires_at>now());
  if (part->>'available')::integer<reserved then raise exception 'Capacidade inferior às reservas e vendas';end if;
  if length(trim(part->>'name')) not between 1 and 120 then raise exception 'Nome de lote inválido';end if;
  insert into public.ticket_types(id,event_id,name,sector,batch,type,capacity,price_cents,active,starts_at,ends_at,position,sequential,details)
  values(tid,target,trim(part->>'name'),coalesce(part->>'sector',part->>'name'),part->>'batch',coalesce(part->>'type','individual'),(part->>'available')::integer,round((part->>'price')::numeric*100)::integer,coalesce((part->>'active')::boolean,true),nullif(part->>'startsAt','')::timestamptz,nullif(part->>'endsAt','')::timestamptz,coalesce((part->>'position')::integer,0),coalesce((part->>'sequential')::boolean,false),part - array['id','price','available'])
  on conflict(id) do update set name=excluded.name,sector=excluded.sector,batch=excluded.batch,type=excluded.type,capacity=excluded.capacity,price_cents=excluded.price_cents,active=excluded.active,starts_at=excluded.starts_at,ends_at=excluded.ends_at,position=excluded.position,sequential=excluded.sequential,details=excluded.details;
  seen:=array_append(seen,tid);
 end loop;
 if exists(select 1 from public.ticket_types t join public.orders o on o.ticket_type_id=t.id where t.event_id=target and not(t.id=any(seen))) then raise exception 'Preserve lotes com histórico de pedidos; desative-os';end if;
 update public.ticket_types set active=false where event_id=target and not(id=any(seen));
 insert into public.audit_log(event_id,actor,action) values(target,auth.uid(),'event.saved');
 return target;
end$$;
create or replace function public.quote_order(batch_id uuid,units integer,coupon_code text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.ticket_types;e public.events;c public.coupons;subtotal integer;discount integer:=0;fee integer;uses integer;own_uses integer;begin
 if not public.active_customer() then raise exception 'Conta ativa obrigatória';end if;
 if units is null or units not between 1 and 10 then raise exception 'Escolha entre 1 e 10 unidades';end if;
 select * into t from public.ticket_types where id=batch_id;
 select * into e from public.events where id=t.event_id;
 if e.id is null or not e.published or e.archived or not exists(select 1 from public.organizations where id=e.organization_id and active) or not public.batch_open(t.id) then raise exception 'Ingresso indisponível';end if;
 if public.batch_remaining(t.id)<units then raise exception 'Estoque insuficiente';end if;
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
declare t public.ticket_types;e public.events;q jsonb;existing public.orders;target uuid:=gen_random_uuid();email text;birth date;begin
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
 if email is null then raise exception 'Confirme seu e-mail';end if;
 insert into public.orders(id,user_id,event_id,ticket_type_id,quantity,total_cents,buyer,idempotency_key,source,campaign,subtotal_cents,discount_cents,fee_cents,coupon_id,expires_at,status,snapshot)
 values(target,auth.uid(),e.id,t.id,units,round((q->>'total')::numeric*100)::integer,jsonb_build_object('name',trim(buyer_data->>'name'),'email',email,'cpf',regexp_replace(buyer_data->>'cpf','[^0-9]','','g'),'phone',left(buyer_data->>'phone',25),'birthDate',birth),request_id,left(referral,120),left(campaign_name,120),round((q->>'subtotal')::numeric*100)::integer,round((q->>'discount')::numeric*100)::integer,round((q->>'platformFee')::numeric*100)::integer,(q->>'couponId')::uuid,now()+interval '15 minutes',case when (q->>'total')::numeric=0 then 'approved' else 'pending' end,jsonb_build_object('feePayer',q->>'feePayer','feeRate',q->'feeRate','eventTitle',e.title,'eventImage',e.details->>'image','eventDate',e.details->>'date','eventTime',e.details->>'time','ticketName',t.name,'batch',t.batch,'sector',t.sector,'unitLabel',case when t.type='table' then 'Mesa/camarote — entrada única do grupo' else 'Individual' end));
 insert into public.order_items(order_id,ticket_type_id,quantity,unit_price_cents) values(target,t.id,units,t.price_cents);
 if (q->>'couponId') is not null then insert into public.coupon_uses(coupon_id,order_id,user_id) values((q->>'couponId')::uuid,target,auth.uid());end if;
 if (q->>'total')::numeric=0 then perform public.issue_tickets(target);end if;
 insert into public.audit_log(event_id,actor,action) values(e.id,auth.uid(),'order.created:'||target);
 return target;
end$$;
create or replace function public.finance_orders() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'event_id',o.event_id,'quantity',o.quantity,'status',o.status,'total_cents',o.total_cents,'subtotal_cents',o.subtotal_cents,'discount_cents',o.discount_cents,'fee_cents',o.fee_cents,'provider_fee_cents',o.provider_fee_cents,'payout_status',o.payout_status,'payout_cents',o.payout_cents,'payout_at',o.payout_at,'payout_reference',o.payout_reference,'payment_method',o.payment_method,'payment_review',o.payment_review,'created_at',o.created_at,'source',o.source,'snapshot',o.snapshot,'buyer','{}'::jsonb,'tickets','[]'::jsonb)),'[]'::jsonb) from public.orders o where public.can_access_event(o.event_id,array['admin','organizador','financeiro']);
$$;

create function public.record_payout(purchase_id uuid,transfer_reference text) returns void language plpgsql security definer set search_path='' as $$
declare o public.orders;amount integer;begin
 if not public.is_admin() then raise exception 'Somente a administração registra repasses';end if;
 if coalesce(length(trim(transfer_reference)),0) not between 3 and 200 then raise exception 'Informe a referência do Pix ou transferência';end if;
 select * into o from public.orders where id=purchase_id for update;
 if o.id is null or o.status<>'approved' or o.provider_fee_cents is null or o.total_cents<=0 or o.payment_review then raise exception 'Pedido sem pagamento confirmado, tarifa desconhecida ou em revisão';end if;
 if o.payout_status='paid' then raise exception 'Repasse já registrado';end if;
 amount:=o.total_cents-o.fee_cents-o.provider_fee_cents;
 if amount<=0 then raise exception 'Sem saldo positivo para repasse';end if;
 update public.orders set payout_status='paid',payout_at=now(),payout_reference=trim(transfer_reference),payout_by=auth.uid(),payout_cents=amount where id=o.id;
 insert into public.audit_log(event_id,actor,action) values(o.event_id,auth.uid(),'payout.recorded:'||o.id);
end$$;
revoke all on function public.record_payout(uuid,text) from public,anon,authenticated;
grant execute on function public.record_payout(uuid,text) to authenticated;

create function public.settle_marketplace_payment(purchase_id uuid,external_payment_id text,paid_cents integer,currency_code text,provider_fee integer,method text) returns void language plpgsql security definer set search_path='' as $$
begin
 if provider_fee<0 or provider_fee>paid_cents or coalesce(length(method),0) not between 1 and 80 then raise exception 'Tarifa ou método inválido';end if;
 perform public.settle_payment(purchase_id,external_payment_id,paid_cents,currency_code);
 -- Preserve the first verified fee, including after an already recorded payout.
 update public.orders set provider_fee_cents=coalesce(provider_fee_cents,provider_fee),payment_method=coalesce(payment_method,method) where id=purchase_id and payment_id=external_payment_id;
end$$;
revoke all on function public.settle_marketplace_payment(uuid,text,integer,text,integer,text) from public,anon,authenticated;
grant execute on function public.settle_marketplace_payment(uuid,text,integer,text,integer,text) to service_role;

-- A paid order cannot be cancelled locally: Mercado Pago refund/reconciliation is required.
create function public.protect_recorded_payment() returns trigger language plpgsql set search_path='' as $$
begin
 if old.status='approved' and old.total_cents>0 and new.status='cancelled' then raise exception 'Pagamento recebido: solicite estorno no Mercado Pago e reconcilie antes de cancelar';end if;
 return new;
end$$;
revoke all on function public.protect_recorded_payment() from public,anon,authenticated;
create trigger protect_recorded_payment before update of status on public.orders for each row execute function public.protect_recorded_payment();
create function public.record_payment_reversal(purchase_id uuid,external_payment_id text,provider_status text,full_reversal boolean) returns void language plpgsql security definer set search_path='' as $$
declare o public.orders;begin
 select * into o from public.orders where id=purchase_id for update;
 if o.id is null or o.payment_id is distinct from external_payment_id then return;end if;
 update public.orders set payment_review=true,status=case when full_reversal then 'refunded' else status end where id=o.id;
 if full_reversal then update public.tickets set cancelled=true where order_id=o.id;end if;
 if not o.payment_review then insert into public.audit_log(event_id,action) values(o.event_id,'payment.review:'||o.id||':'||left(provider_status,40));end if;
end$$;
revoke all on function public.record_payment_reversal(uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.record_payment_reversal(uuid,text,text,boolean) to service_role;
commit;


