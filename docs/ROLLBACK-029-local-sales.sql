-- Disable new cash issuance; never remove orders, tickets, audit, or QR Codes.
begin;
set local lock_timeout='5s';
drop function if exists public.create_local_sale(uuid,integer,jsonb,uuid,boolean,boolean,integer,jsonb);
drop function if exists public.local_sale_capabilities(uuid);
do $$declare saved text;begin
 select definition into saved from ingressos_migration_audit.function_snapshots where version='029_local_sales' and signature in ('public.protect_recorded_payment()','protect_recorded_payment()');
 if saved is null then raise exception 'Snapshot da proteção de pagamentos ausente. Interrompa e confira o backup.';end if;
 execute saved;
end$$;
-- Retain the payout guard when local sales exist, even if frontend is reverted.
do $$begin
 if not exists(select 1 from public.orders where snapshot->>'saleChannel'='local') then
  drop trigger if exists guard_local_sale_payout on public.orders;
  drop function if exists public.guard_local_sale_payout();
 end if;
end$$;
commit;
