-- Read-only. Inspect the intended Supabase project before applying migration 029.
select current_database() as database_name,
 to_regprocedure('public.issue_tickets(uuid)') as issuer,
 to_regprocedure('public.batch_open(uuid)') as stock_open,
 to_regprocedure('public.batch_remaining(uuid)') as stock_remaining,
 to_regclass('public.ticket_email_outbox') as email_outbox,
 to_regclass('ingressos_migration_audit.function_snapshots') as audit_snapshots,
 to_regprocedure('public.local_sale_capabilities(uuid)') as existing_local_capability,
 to_regprocedure('public.create_local_sale(uuid,integer,jsonb,uuid,boolean,boolean,integer,jsonb)') as existing_local_issuer;
select pg_get_functiondef('public.protect_recorded_payment()'::regprocedure) as payment_guard_definition;
select tgname,pg_get_triggerdef(oid) from pg_trigger where tgrelid='public.orders'::regclass and not tgisinternal;
