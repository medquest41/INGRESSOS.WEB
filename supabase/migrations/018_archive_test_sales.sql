begin;
alter table public.orders add column test_archived_at timestamptz;
alter table public.orders add column test_archived_by uuid references auth.users(id);
create table public.sales_cleanup_log (
 id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events(id),
 actor uuid not null references auth.users(id), order_ids uuid[] not null,
 created_at timestamptz not null default now(), reason text not null
);
alter table public.sales_cleanup_log enable row level security;
grant select on public.sales_cleanup_log to authenticated;
create policy cleanup_owner_read on public.sales_cleanup_log for select to authenticated using(public.legal_is_owner());
create function public.archive_test_sales(actor_id uuid,target_event uuid,selected_orders uuid[],confirmation text) returns integer
language plpgsql security definer set search_path='' as $$
declare count_orders integer; purchase public.orders;
begin
 if not exists(select 1 from public.profiles p join auth.users u on u.id=p.id where p.id=actor_id and p.active and p.role='admin' and lower(u.email)='ingressosaltatemporada@gmail.com' and u.email_confirmed_at is not null) then raise exception 'Apenas Admin Geral';end if;
 if confirmation is distinct from 'LIMPAR VENDAS DE TESTE' then raise exception 'Confirmação obrigatória';end if;
 if selected_orders is null or cardinality(selected_orders) not between 1 and 500 then raise exception 'Selecione de 1 a 500 pedidos';end if;
 perform 1 from public.events where id=target_event for update;
 if not found then raise exception 'Evento inexistente';end if;
 perform 1 from public.orders where id=any(selected_orders) order by id for update;
 select count(*) into count_orders from public.orders where id=any(selected_orders) and event_id=target_event and test_archived_at is null;
 if count_orders<>cardinality(selected_orders) then raise exception 'Seleção inválida, duplicada, arquivada ou de outro evento';end if;
 for purchase in select * from public.orders where id=any(selected_orders) loop
  if purchase.payment_review or purchase.payout_status='paid' or (purchase.total_cents>0 and purchase.status='approved') or purchase.payment_id is not null or exists(select 1 from public.payments pay where pay.order_id=purchase.id and pay.status<>'rejected') or exists(select 1 from public.inline_payment_attempts a where a.order_id=purchase.id and a.status not in('rejected','cancelled')) then
   raise exception 'Pedido com pagamento, cobrança ativa, revisão ou repasse: concilie antes de limpar';
  end if;
 end loop;
 update public.orders set test_archived_at=now(),test_archived_by=actor_id,expires_at=least(expires_at,now()),status=case when status in('pending','approved') then 'cancelled' else status end where id=any(selected_orders);
 update public.tickets set cancelled=true where order_id=any(selected_orders);
 if to_regclass('public.vip_entries') is not null then execute 'update public.vip_entries set status=''cancelled'' where order_id=any($1)' using selected_orders;end if;
 insert into public.sales_cleanup_log(event_id,actor,order_ids,reason) values(target_event,actor_id,selected_orders,'Testes arquivados; histórico preservado; sem estorno financeiro');
 insert into public.audit_log(event_id,actor,action) values(target_event,actor_id,'sales.tests.archived:'||count_orders);
 return count_orders;
end$$;
-- Only the password-verifying Edge Function can execute the mutation.
revoke all on function public.archive_test_sales(uuid,uuid,uuid[],text) from public,anon,authenticated;
grant execute on function public.archive_test_sales(uuid,uuid,uuid[],text) to service_role;
-- Operational lists exclude archived tests. Original statuses and payment ledgers remain stored.
create or replace function public.finance_orders() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'event_id',o.event_id,'quantity',o.quantity,'status',o.status,'total_cents',o.total_cents,'subtotal_cents',o.subtotal_cents,'discount_cents',o.discount_cents,'fee_cents',o.fee_cents,'provider_fee_cents',o.provider_fee_cents,'payout_status',o.payout_status,'payout_cents',o.payout_cents,'payout_at',o.payout_at,'payout_reference',o.payout_reference,'payment_method',o.payment_method,'payment_review',o.payment_review,'created_at',o.created_at,'source',o.source,'snapshot',o.snapshot,'buyer','{}'::jsonb,'tickets','[]'::jsonb)),'[]'::jsonb) from public.orders o where o.test_archived_at is null and public.can_access_event(o.event_id,array['admin','organizador','financeiro']);
$$;
notify pgrst,'reload schema';
commit;
