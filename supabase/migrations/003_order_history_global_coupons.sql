begin;
drop policy audit_read on public.audit_log;
create policy audit_read on public.audit_log for select to authenticated using(public.is_admin() or public.can_access_event(event_id,array['organizador','financeiro']));
alter table public.coupons alter column event_id drop not null;
create unique index coupons_global_code on public.coupons(code) where event_id is null;
drop policy coupon_read on public.coupons;
create policy coupon_read on public.coupons for select to authenticated using(public.is_admin() or public.can_access_event(event_id,array['organizador']));
create or replace function public.save_coupon(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare target uuid:=coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid());event uuid:=nullif(payload->>'eventId','')::uuid;begin
 if not public.is_admin() and not public.can_access_event(event,array['organizador']) then raise exception 'Sem permissão';end if;
 if exists(select 1 from public.coupons where id=target and event_id is distinct from event) then raise exception 'Não transfira cupons entre eventos';end if;
 if coalesce(payload->>'code','') !~ '^[A-Z0-9_-]{2,30}$' then raise exception 'Código inválido';end if;
 if nullif(payload->>'ticketId','') is not null and not exists(select 1 from public.ticket_types where id=(payload->>'ticketId')::uuid and event_id=event) then raise exception 'Lote inválido';end if;
 insert into public.coupons(id,event_id,code,kind,amount,active,max_uses,max_per_user,starts_at,expires_at,ticket_type_id)
 values(target,event,payload->>'code',payload->>'type',(payload->>'value')::numeric,coalesce((payload->>'active')::boolean,true),coalesce((payload->>'limit')::integer,0),coalesce((payload->>'perUserLimit')::integer,0),case when nullif(payload->>'startsAt','') is null then null when length(payload->>'startsAt')=10 then (payload->>'startsAt')::date::timestamp at time zone 'America/Sao_Paulo' else (payload->>'startsAt')::timestamptz end,case when nullif(payload->>'expiresAt','') is null then null else ((payload->>'expiresAt')::date+1)::timestamp at time zone 'America/Sao_Paulo' end,nullif(payload->>'ticketId','')::uuid)
 on conflict(id) do update set code=excluded.code,kind=excluded.kind,amount=excluded.amount,active=excluded.active,max_uses=excluded.max_uses,max_per_user=excluded.max_per_user,starts_at=excluded.starts_at,expires_at=excluded.expires_at,ticket_type_id=excluded.ticket_type_id;
 insert into public.audit_log(event_id,actor,action) values(event,auth.uid(),'coupon.saved');return target;
end$$;

create or replace function public.quote_order(batch_id uuid,units integer,coupon_code text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.ticket_types;e public.events;c public.coupons;subtotal integer;discount integer:=0;fee integer;uses integer;own_uses integer;begin
 if not public.active_customer() then raise exception 'Conta ativa obrigatória';end if;
 if units is null or units not between 1 and 10 then raise exception 'Escolha entre 1 e 10 unidades';end if;
 select * into t from public.ticket_types where id=batch_id;
 select * into e from public.events where id=t.event_id;
 if e.id is null or not e.published or e.archived or not exists(select 1 from public.organizations where id=e.organization_id and active) or not public.batch_open(t.id) then raise exception 'Ingresso indisponível';end if;
 if public.batch_remaining(t.id)<units then raise exception 'Estoque insuficiente';end if;
 subtotal:=t.price_cents*units;
 if trim(coalesce(coupon_code,''))<>'' then
  select * into c from public.coupons where (event_id=e.id or event_id is null) and code=upper(trim(coupon_code)) order by event_id nulls last limit 1;
  if c.id is null or not c.active or c.starts_at>now() or c.expires_at<=now() or c.ticket_type_id is not null and c.ticket_type_id<>t.id then raise exception 'Cupom inválido ou expirado';end if;
  select count(*),count(*) filter(where user_id=auth.uid()) into uses,own_uses from public.orders where coupon_id=c.id and (status='approved' or status='pending' and expires_at>now());
  if c.max_uses>0 and uses>=c.max_uses or c.max_per_user>0 and own_uses>=c.max_per_user then raise exception 'Limite do cupom atingido';end if;
  discount:=least(subtotal,case when c.kind='fixed' then round(c.amount*100)::integer else round(subtotal*c.amount/100)::integer end);
 end if;
 fee:=round((subtotal-discount)*e.fee_rate)::integer;
 return jsonb_build_object('subtotal',subtotal/100.0,'discount',discount/100.0,'fee',fee/100.0,'total',(subtotal-discount+fee)/100.0,'coupon',upper(trim(coalesce(coupon_code,''))),'couponId',c.id);
end$$;

create table public.order_status_history(id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders(id),from_status text,to_status text not null,actor uuid references public.profiles(id),created_at timestamptz not null default now());
create index order_history_order on public.order_status_history(order_id,created_at);
alter table public.order_status_history enable row level security;
create policy order_history_read on public.order_status_history for select to authenticated using(exists(select 1 from public.orders where id=order_id));
revoke all on public.order_status_history from anon,authenticated;
grant select on public.order_status_history to authenticated;
create function public.log_order_status() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then insert into public.order_status_history(order_id,to_status,actor) values(new.id,new.status,auth.uid());
 elsif old.status is distinct from new.status then insert into public.order_status_history(order_id,from_status,to_status,actor) values(new.id,old.status,new.status,auth.uid());end if;
 return new;
end$$;
revoke all on function public.log_order_status() from public,anon,authenticated;
create trigger order_status_changed after insert or update of status on public.orders for each row execute function public.log_order_status();
insert into public.order_status_history(order_id,to_status) select id,status from public.orders;
commit;
