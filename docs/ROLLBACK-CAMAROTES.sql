begin;
do $$begin if exists(select 1 from public.orders where snapshot->>'wristbands' is not null) or exists(select 1 from public.ticket_types where type='camarote') then raise exception 'Rollback bloqueado: preserve camarotes e histórico. Desative vendas e mantenha 027 para pedidos existentes.';end if;end$$;
drop trigger release_rejected_camarote on public.inline_payment_attempts;
drop function public.release_rejected_camarote();
drop function public.camarote_availability(uuid);
drop trigger guard_camarote on public.ticket_types;
drop function public.guard_camarote();
drop index public.camarote_event_name_unique;
alter table public.ticket_types drop constraint ticket_kind;
alter table public.ticket_types add constraint ticket_kind check(type in ('individual','table'));
do $restore$declare r record;begin
 if to_regclass('ingressos_migration_audit.function_snapshots') is null then raise exception 'Backup das funções ausente; restauração manual auditada necessária';end if;
 for r in select definition from ingressos_migration_audit.function_snapshots where version='027_camarotes' and signature ~ '^(public\.)?(create_order|quote_order|issue_tickets|validate_order_participants)\(' loop execute r.definition;end loop;
end$restore$;
-- Keep additive columns, shares and verified reconciliation: no data/history deletion.
notify pgrst,'reload schema';commit;