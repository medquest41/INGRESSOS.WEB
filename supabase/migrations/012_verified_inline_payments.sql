-- Atualização 14. Mantém as duas migrations 011 existentes e os snapshots de taxa.
begin;
do $$begin
 if to_regclass('public.inline_payment_attempts') is null then raise exception 'Instale primeiro 011_inline_payment_attempts.sql';end if;
 if to_regprocedure('public.become_organizer(text)') is null then raise exception 'Instale primeiro a Atualização 13 de contas';end if;
end$$;
alter table public.orders add column if not exists payment_status text;
insert into public.settings(key,value) values('inline_payment_cutover',to_jsonb(now())) on conflict(key) do nothing;
alter table public.inline_payment_attempts add column if not exists provider_updated_at timestamptz;
create unique index if not exists inline_payment_provider_unique on public.inline_payment_attempts(provider_id) where provider_id is not null;
create table if not exists public.inline_payment_history (
 attempt_key uuid primary key, order_id uuid not null references public.orders(id),
 method text not null, provider_id text unique, status text not null,
 created_at timestamptz not null, provider_updated_at timestamptz
);
alter table public.inline_payment_history enable row level security;
revoke all on public.inline_payment_history from public,anon,authenticated;
grant select,insert,update on public.inline_payment_history to service_role;
create or replace function public.archive_inline_attempt() returns trigger language plpgsql security definer set search_path='' as $$begin
 if old.attempt_key<>new.attempt_key then
  insert into public.inline_payment_history values(old.attempt_key,old.order_id,old.method,old.provider_id,old.status,old.created_at,old.provider_updated_at);
  new.provider_updated_at:=null;
 end if;
 return new;
end$$;
revoke all on function public.archive_inline_attempt() from public,anon,authenticated;
create trigger archive_inline_attempt before update on public.inline_payment_attempts for each row execute function public.archive_inline_attempt();

-- Only verified provider responses reach this RPC. Browser roles have no EXECUTE.
create function public.record_verified_inline_payment(purchase_id uuid,external_payment_id text,attempt_id uuid,provider_status text,paid_cents integer,payment_method text,provider_updated timestamptz)
returns text language plpgsql security definer set search_path='' as $$
declare o public.orders;a public.inline_payment_attempts;h public.inline_payment_history;event uuid;begin
 if external_payment_id is null or external_payment_id !~ '^[0-9]+$' or provider_status is null or provider_status not in ('pending','in_process','authorized','approved','rejected','cancelled','refunded','charged_back') then raise exception 'Resposta inválida';end if;
 select event_id into event from public.orders where id=purchase_id;
 perform 1 from public.events where id=event for update;
 select * into o from public.orders where id=purchase_id for update;
 if o.id is null or paid_cents is distinct from o.total_cents or paid_cents<=0 then raise exception 'Pagamento incompatível';end if;
 select * into a from public.inline_payment_attempts where order_id=o.id for update;
 if a.order_id is null then
  -- Preserve existing Checkout Pro charges and their reversals. New orders require a bound attempt.
  if o.payment_id is distinct from external_payment_id and (o.status='pending' and o.created_at<(select (value#>>'{}')::timestamptz from public.settings where key='inline_payment_cutover')) is not true then raise exception 'Tentativa não encontrada';end if;
  if provider_status='approved' and o.status='pending' and o.expires_at<=now() then
   update public.orders set payment_review=true,payment_status='review' where id=o.id;
   return 'review';
  end if;
  if o.status='pending' then update public.orders set payment_status=provider_status where id=o.id;end if;
  return 'recorded';
 end if;
 if (a.provider_id=external_payment_id or (a.provider_id is null and a.attempt_key=attempt_id)) is not true or
    (a.provider_id is null and attempt_id is null) then
  select * into h from public.inline_payment_history where order_id=o.id and provider_id=external_payment_id for update;
  if h.attempt_key is null then raise exception 'Cobrança não pertence à tentativa';end if;
  if provider_status='approved' then
   update public.orders set payment_review=true,payment_status='review' where id=o.id;
   insert into public.audit_log(event_id,action) values(o.event_id,'payment.retired_attempt_review:'||o.id||':'||external_payment_id);
  end if;
  return 'review';
 end if;
 if payment_method is distinct from a.method then raise exception 'Forma incompatível';end if;
 if provider_updated is not null and a.provider_updated_at is not null and provider_updated<a.provider_updated_at then return 'stale';end if;
 -- Never let a delayed pending/declined notification undo an approval or reversal.
 if a.status in ('approved','refunded','charged_back') and provider_status not in ('refunded','charged_back') then return 'unchanged';end if;
 update public.inline_payment_attempts set provider_id=external_payment_id,status=provider_status,provider_updated_at=coalesce(provider_updated,provider_updated_at) where order_id=o.id;
 if provider_status='approved' and (o.status<>'pending' or o.expires_at<=now()) and o.payment_id is distinct from external_payment_id then
  update public.orders set payment_review=true,payment_status='review' where id=o.id;
  insert into public.audit_log(event_id,action) values(o.event_id,'payment.unsettled_review:'||o.id||':'||external_payment_id);
  return 'review';
 end if;
 if o.status='pending' and not o.payment_review then
  update public.orders set payment_status=case when o.expires_at<=now() and provider_status<>'approved' then 'expired' else provider_status end where id=o.id;
 end if;
 return 'recorded';
end$$;
revoke all on function public.record_verified_inline_payment(uuid,text,uuid,text,integer,text,timestamptz) from public,anon,authenticated;
grant execute on function public.record_verified_inline_payment(uuid,text,uuid,text,integer,text,timestamptz) to service_role;

-- QR already downloaded must also be refused at check-in while payment is in review.
create or replace function public.check_in(ticket_code uuid) returns text language plpgsql security definer set search_path='' as $$
declare entry public.tickets;purchase public.orders;begin
 select o.* into purchase from public.orders o join public.tickets t on t.order_id=o.id where t.code=ticket_code;
 if purchase.id is null then return 'invalid';end if;
 if not public.can_access_event(purchase.event_id,array['admin','organizador','checkin']) then return 'forbidden';end if;
 select * into purchase from public.orders where id=purchase.id for update;
 select * into entry from public.tickets where code=ticket_code for update;
 if entry.cancelled or purchase.status<>'approved' or purchase.payment_review then return 'cancelled';end if;
 if entry.used_at is not null then return 'used';end if;
 update public.tickets set used_at=now(),used_by=auth.uid() where id=entry.id;
 insert into public.checkins(ticket_id,event_id,operator_id) values(entry.id,purchase.event_id,auth.uid());
 insert into public.audit_log(event_id,actor,action) values(purchase.event_id,auth.uid(),'checkin.valid');
 return 'valid';
end$$;
notify pgrst, 'reload schema';
commit;
