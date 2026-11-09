-- Incremental. Apply only after explicit production authorization.
-- Cash is declared by the authorized organizer; no online payment is approved.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $$begin
 if to_regprocedure('public.issue_tickets(uuid)') is null or to_regprocedure('public.batch_open(uuid)') is null
 or to_regclass('public.ticket_email_outbox') is null or to_regprocedure('public.protect_recorded_payment()') is null
 or to_regclass('ingressos_migration_audit.function_snapshots') is null then raise exception 'Pré-requisitos de emissão/estoque ausentes. Confira a migração 027.';end if;
end$$;
insert into ingressos_migration_audit.function_snapshots(version,signature,definition,acl)
select '029_local_sales',p.oid::regprocedure::text,pg_get_functiondef(p.oid),p.proacl::text from pg_proc p where p.oid='public.protect_recorded_payment()'::regprocedure on conflict do nothing;
-- Preserve the online-payment guard. Only organizer-declared cash with no
-- provider payment can be cancelled by its event manager through cancel_order.
create or replace function public.protect_recorded_payment() returns trigger language plpgsql set search_path='' as $$begin
 if old.status='approved' and old.total_cents>0 and new.status='cancelled' then
  if old.snapshot->>'saleChannel'='local' and old.payment_method='local_cash' and old.payment_id is null and old.fee_cents=0
   and not exists(select 1 from public.payments where order_id=old.id and status='approved' and amount_cents>0) then
   if not exists(select 1 from public.profiles p join public.events e on e.id=old.event_id where p.id=auth.uid() and p.active and p.role in ('admin','organizador') and (p.role='admin' or p.organization_id=e.organization_id)) then raise exception 'Somente o organizador responsável pode cancelar uma venda local.';end if;
  else raise exception 'Pagamento recebido: solicite estorno no Mercado Pago e reconcilie antes de cancelar';end if;
 end if;
 return new;
end$$;
revoke all on function public.protect_recorded_payment() from public,anon,authenticated;
create function public.local_sale_capabilities(target uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not exists(select 1 from public.profiles p join public.events e on e.id=target join auth.users u on u.id=p.id where p.id=auth.uid() and p.active and p.role in ('admin','organizador') and (p.role='admin' or p.organization_id=e.organization_id) and not coalesce(u.is_anonymous,false) and u.email_confirmed_at is not null) then raise exception 'Sem permissão para venda local deste evento.';end if;
 return jsonb_build_object('enabled',true,'feePolicy','no_platform_fee','optionalBuyer',true);
end$$;
revoke all on function public.local_sale_capabilities(uuid) from public,anon,authenticated;
grant execute on function public.local_sale_capabilities(uuid) to authenticated;
create function public.create_local_sale(batch_id uuid,units integer,buyer_data jsonb,request_id uuid,received_confirmed boolean,eligibility_confirmed boolean,expected_total_cents integer,sale_overrides jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor public.profiles;t public.ticket_types;e public.events;existing public.orders;target uuid:=gen_random_uuid();
 buyer_record jsonb;holders jsonb;total integer;number_of_tickets integer;birth date;rating integer;email text;phone text;cpf text;person text;sale_name text;sale_price integer;terms jsonb;
begin
 select * into actor from public.profiles where id=auth.uid();
 if actor.id is null or not actor.active or actor.role not in ('admin','organizador')
 or not exists(select 1 from auth.users u where u.id=actor.id and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)) then raise exception 'Somente o organizador responsável pode registrar venda local.';end if;
 if request_id is null or received_confirmed is distinct from true or eligibility_confirmed is distinct from true then raise exception 'Confirme o recebimento e a conferência presencial das regras do evento.';end if;
 if units is null or units not between 1 and 10 then raise exception 'Escolha de 1 a 10 unidades.';end if;
 perform pg_advisory_xact_lock(hashtextextended(request_id::text,0));
 select * into t from public.ticket_types where id=batch_id;
 select * into e from public.events where id=t.event_id for update;
 if e.id is null or not public.can_access_event(e.id,array['admin','organizador']) or (actor.role='organizador' and actor.organization_id is distinct from e.organization_id) then raise exception 'Sem permissão para gerar ingressos deste evento.';end if;
 person:=nullif(trim(buyer_data->>'name'),'');cpf:=nullif(regexp_replace(coalesce(buyer_data->>'cpf',''),'[^0-9]','','g'),'');
 phone:=nullif(regexp_replace(coalesce(buyer_data->>'phone',''),'[^0-9]','','g'),'');email:=nullif(lower(trim(buyer_data->>'email')),'');
 if length(person)>120 or (cpf is null and nullif(trim(buyer_data->>'cpf'),'') is not null) or (phone is null and nullif(trim(buyer_data->>'phone'),'') is not null) or (cpf is not null and not public.valid_cpf(cpf)) or (phone is not null and phone!~'^[0-9]{10,13}$')
 or (email is not null and (length(email)>254 or email!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')) then raise exception 'Confira os dados opcionais: nome, CPF, telefone ou e-mail.';end if;
 if nullif(buyer_data->>'birthDate','') is not null then
  if buyer_data->>'birthDate'!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'Confira a data de nascimento opcional.';end if;
  birth:=(buyer_data->>'birthDate')::date;
  rating:=case coalesce(e.details->>'ageRating','Livre') when 'Livre' then 0 when '12+' then 12 when '14+' then 14 when '16+' then 16 when '18+' then 18 else 99 end;
  if birth>current_date or birth<'1900-01-01' or extract(year from age(current_date,birth))<greatest(rating,case when coalesce((e.details->>'requireAgeConfirmation')::boolean,false) then 18 else 0 end) then raise exception 'Nascimento incompatível com a classificação do evento.';end if;
 end if;
 sale_name:=coalesce(nullif(trim(sale_overrides->>'name'),''),t.name);
 if sale_overrides ? 'name' and (nullif(trim(sale_overrides->>'name'),'') is null or length(trim(sale_overrides->>'name'))>120) then raise exception 'Preencha o nome do ingresso nesta venda com até 120 caracteres.';end if;
 if sale_overrides ? 'unitPriceCents' and (sale_overrides->>'unitPriceCents' is null or sale_overrides->>'unitPriceCents'!~'^[0-9]{1,9}$') then raise exception 'Informe um valor válido para esta venda.';end if;
 sale_price:=coalesce((sale_overrides->>'unitPriceCents')::integer,t.price_cents);
 if sale_price<0 or sale_price>100000000 then raise exception 'Informe um valor válido para esta venda.';end if;
 terms:=jsonb_build_object('name',sale_name,'unitPriceCents',sale_price);
 buyer_record:=jsonb_build_object('name',coalesce(person,'Venda local'),'cpf',cpf,'phone',phone,'email',email,'birthDate',birth);
 select * into existing from public.orders where idempotency_key=request_id;
 if existing.id is not null then
  if existing.user_id<>actor.id or existing.ticket_type_id<>batch_id or existing.quantity<>units or existing.snapshot->>'saleChannel' is distinct from 'local'
   or (existing.buyer-'participants') is distinct from buyer_record or existing.total_cents is distinct from expected_total_cents or existing.snapshot->'localSaleOverrides' is distinct from terms then raise exception 'Esta tentativa já foi usada com outros dados. Confira a emissão anterior.';end if;
  return existing.id;
 end if;
 perform 1 from public.ticket_types where id=batch_id for update;
 select * into t from public.ticket_types where id=batch_id;
 if not e.published or e.archived or not exists(select 1 from public.organizations where id=e.organization_id and active)
 or not t.active or coalesce((t.details->>'retiredForSales')::boolean,false) or t.details->>'numberedCategoryId' is not null or not coalesce(public.batch_open(t.id),false) then raise exception 'Este ingresso não está liberado para venda. Escolha uma unidade disponível.';end if;
 if t.type in ('camarote','table') and units<>1 then raise exception 'Escolha uma mesa ou camarote inteiro por venda.';end if;
 if coalesce(public.batch_remaining(t.id),0)<units then raise exception 'Estoque insuficiente. A unidade pode ter sido reservada por outro comprador.';end if;
 total:=sale_price*units;
 if expected_total_cents is distinct from total then raise exception 'O preço mudou. Atualize e confira o valor recebido antes de emitir.';end if;
 number_of_tickets:=case when t.type='camarote' then (t.details->>'wristbands')::integer else units end;
 if number_of_tickets is null or number_of_tickets not between 1 and 100 then raise exception 'Confira a quantidade de ingressos inclusos.';end if;
 select jsonb_agg(jsonb_build_object('name',case when n=1 then coalesce(person,'Venda local') else 'Venda local' end,'cpf',case when n=1 then cpf end,'birthDate',case when n=1 then birth end) order by n) into holders from generate_series(1,number_of_tickets) n;
 insert into public.orders(id,user_id,event_id,ticket_type_id,quantity,total_cents,buyer,idempotency_key,source,subtotal_cents,discount_cents,fee_cents,expires_at,status,payment_status,payment_method,provider_fee_cents,snapshot)
 values(target,actor.id,e.id,t.id,units,total,buyer_record,request_id,'venda_local',total,0,0,now(),'approved','approved','local_cash',null,
 jsonb_build_object('saleChannel','local','localReceivedBy',actor.id,'localReceivedAt',now(),'localEligibilityConfirmed',true,'paymentVerification','organizer_cash_declaration','feePayer','organizer','feeRate',0,'eventTitle',e.title,'eventImage',e.details->>'image','eventDate',e.details->>'date','eventTime',e.details->>'time','ticketName',sale_name||case when t.details->>'unitNumber' is not null and sale_name<>t.name then ' • '||t.name else '' end,'batch',t.batch,'sector',t.sector,'wristbands',case when t.type='camarote' then number_of_tickets end,'unitLabel',t.name,'localSaleOverrides',terms,'localCatalogPriceCents',t.price_cents,'localCatalogName',t.name,'localFeePolicy','no_platform_fee')||jsonb_build_object('localBuyerIdentified',person is not null or cpf is not null));
 update public.orders set buyer=buyer_record||jsonb_build_object('participants',holders) where id=target;
 insert into public.order_items(order_id,ticket_type_id,quantity,unit_price_cents) values(target,t.id,units,sale_price);
 perform public.issue_tickets(target);
 if email is null then
  delete from public.ticket_email_outbox where order_id=target;
  update public.orders set email_delivery_status='not_configured' where id=target;
 end if;
 insert into public.audit_log(event_id,actor,action) values(e.id,actor.id,'local_sale.received_no_platform_fee:'||target);
 return target;
end$$;
revoke all on function public.create_local_sale(uuid,integer,jsonb,uuid,boolean,boolean,integer,jsonb) from public,anon,authenticated;
grant execute on function public.create_local_sale(uuid,integer,jsonb,uuid,boolean,boolean,integer,jsonb) to authenticated;
-- Organizer already holds this cash: it can never become a platform payout.
create function public.guard_local_sale_payout() returns trigger language plpgsql set search_path='' as $$begin
 if old.snapshot->>'saleChannel'='local' and new.payout_status='paid' and old.payout_status is distinct from 'paid' then raise exception 'Venda local já recebida pelo organizador: não há repasse do Mercado Pago.';end if;
 return new;
end$$;
revoke all on function public.guard_local_sale_payout() from public,anon,authenticated;
create trigger guard_local_sale_payout before update of payout_status on public.orders for each row execute function public.guard_local_sale_payout();
commit;
