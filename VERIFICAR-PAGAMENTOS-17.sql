-- Somente leitura: execute no SQL Editor do projeto Ingressos, antes de ativar.
select key,value from public.settings where key in ('payments_enabled','inline_payment_cutover');
select name,to_regclass('public.'||name) as installed from (values
 ('orders'),('tickets'),('inline_payment_attempts'),('inline_payment_history')) as t(name);
select signature,to_regprocedure(signature) as installed from (values
 ('public.settle_marketplace_payment(uuid,text,integer,text,integer,text)'),
 ('public.begin_inline_payment(uuid,uuid,text)'),
 ('public.become_organizer(text)'),
 ('public.record_verified_inline_payment(uuid,text,uuid,text,integer,text,timestamptz)'),
 ('public.reconcile_inline_payment(uuid,text,uuid,text,integer,text,timestamptz,integer,integer)'),
 ('public.claim_inline_creation(uuid,uuid,uuid)')) as t(signature);
select table_name,column_name from information_schema.columns
where table_schema='public' and (table_name='tickets' and column_name='holder'
 or table_name='orders' and column_name in ('payment_status','payment_review')
 or table_name='inline_payment_attempts' and column_name in ('creation_lease','creation_count'));
select grantee,routine_name,privilege_type from information_schema.routine_privileges
where routine_schema='public' and routine_name in
 ('settle_payment','settle_marketplace_payment','record_verified_inline_payment','reconcile_inline_payment','claim_inline_creation','reject_inline_creation')
and grantee in ('PUBLIC','anon','authenticated','service_role');
-- PUBLIC/anon/authenticated não devem ter EXECUTE para estas rotinas.
