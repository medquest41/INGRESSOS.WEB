-- Pagamentos dentro do checkout. Não armazena número do cartão, CVV ou token.
begin;
do $$begin if to_regprocedure('public.settle_marketplace_payment(uuid,text,integer,text,integer,text)') is null then raise exception 'Instale primeiro a Atualização 12 (migração 009)';end if;end$$;
create table public.inline_payment_attempts (
 order_id uuid primary key references public.orders(id),
 attempt_key uuid not null unique default gen_random_uuid(),
 method text not null check(method in ('pix','card')),
 provider_id text,
 status text not null default 'creating',
 created_at timestamptz not null default now()
);
alter table public.inline_payment_attempts enable row level security;
revoke all on public.inline_payment_attempts from public,anon,authenticated;
grant select,insert,update on public.inline_payment_attempts to service_role;

create function public.begin_inline_payment(purchase_id uuid,buyer_id uuid,payment_method text) returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.orders;a public.inline_payment_attempts;event uuid;begin
 if payment_method not in ('pix','card') or payment_method is null then raise exception 'Forma inválida';end if;
 select event_id into event from public.orders where id=purchase_id;
 perform 1 from public.events where id=event for update;
 select * into o from public.orders where id=purchase_id for update;
 if o.id is null or o.user_id<>buyer_id or o.status<>'pending' or o.payment_review or o.total_cents<=0 or o.expires_at<=now() then raise exception 'Reserva indisponível';end if;
 select * into a from public.inline_payment_attempts where order_id=o.id for update;
 if a.order_id is not null and a.status not in ('rejected','cancelled') then
  if a.method<>payment_method then raise exception 'Já existe uma cobrança ativa. Conclua o pagamento escolhido';end if;
  return to_jsonb(a);
 end if;
 -- Pix requer ao menos 30 minutos de validade; reserva e cobrança ficam sincronizadas.
 update public.orders set expires_at=now()+interval '32 minutes' where id=o.id;
 insert into public.inline_payment_attempts(order_id,method) values(o.id,payment_method)
 on conflict(order_id) do update set attempt_key=gen_random_uuid(),method=excluded.method,provider_id=null,status='creating',created_at=now()
 returning * into a;
 return to_jsonb(a);
end$$;
revoke all on function public.begin_inline_payment(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.begin_inline_payment(uuid,uuid,text) to service_role;
commit;
