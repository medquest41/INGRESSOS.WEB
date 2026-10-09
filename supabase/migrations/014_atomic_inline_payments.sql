-- Atualização 17. Execute depois das DUAS 011, 012 e 013. Nenhum segredo.
begin;
do $$begin
 if to_regprocedure('public.record_verified_inline_payment(uuid,text,uuid,text,integer,text,timestamptz)') is null
 or to_regprocedure('public.issue_tickets(uuid)') is null
 or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='tickets' and column_name='holder')
 then raise exception 'Instale as migrations 011, 012 e 013 antes da 014';end if;
end$$;

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
notify pgrst,'reload schema';
commit;
