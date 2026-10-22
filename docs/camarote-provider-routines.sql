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
