-- Somente leitura. Execute em homologação primeiro; revise antes de autorizar produção.
select version();
select p.oid::regprocedure as assinatura,pg_get_functiondef(p.oid) as definicao
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
('create_order','quote_order','issue_tickets','validate_order_participants','save_event',
 'batch_remaining','batch_open','begin_inline_payment','record_verified_inline_payment',
 'reconcile_inline_payment','settle_payment','check_in','check_in_event','cancel_order');
select table_name,column_name,data_type from information_schema.columns
where table_schema='public' and table_name in ('orders','tickets','ticket_types','inline_payment_attempts')
order by table_name,ordinal_position;
select conname,pg_get_constraintdef(oid) from pg_constraint where conrelid='public.ticket_types'::regclass;
select tgname,pg_get_triggerdef(oid) from pg_trigger where not tgisinternal
and tgrelid in ('public.orders'::regclass,'public.ticket_types'::regclass,'public.inline_payment_attempts'::regclass);
-- Pré-requisitos ausentes devem ser avaliados individualmente. Não reaplicar pacotes antigos.
select to_regprocedure('public.reconcile_inline_payment(uuid,text,uuid,text,integer,text,timestamptz,integer,integer)') as pagamento_verificado,
to_regprocedure('public.validate_order_participants(jsonb,integer,jsonb)') as participantes,
to_regprocedure('public.issue_tickets(uuid)') as emissao;
