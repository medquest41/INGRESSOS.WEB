-- Initial production schema. Apply only to a new Supabase project after review.
-- Local browser data is not imported or deleted by this migration.
create table public.organizations (id uuid primary key default gen_random_uuid(), name text not null);
create table public.profiles (
 id uuid primary key references auth.users(id), name text not null,
 role text not null default 'cliente' check (role in ('admin','organizador','financeiro','checkin','cliente')),
 organization_id uuid references public.organizations(id), active boolean not null default true
);
create table public.events (
 id uuid primary key default gen_random_uuid(), legacy_id text unique,
 organization_id uuid not null references public.organizations(id),
 slug text not null unique, title text not null, published boolean not null default false,
 archived boolean not null default false, details jsonb not null default '{}'
);
create table public.ticket_types (
 id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events(id),
 name text not null, sector text, batch text, type text not null default 'individual',
 capacity integer not null check(capacity>=0), price_cents integer not null check(price_cents>=0)
);
create table public.orders (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 event_id uuid not null references public.events(id), ticket_type_id uuid not null references public.ticket_types(id),
 quantity integer not null check(quantity between 1 and 10),
 status text not null default 'pending' check(status in ('pending','approved','cancelled','refunded')),
 total_cents integer not null check(total_cents>=0), buyer jsonb not null,
 source text, payment_id text unique, idempotency_key uuid not null unique,
 created_at timestamptz not null default now()
);
create table public.tickets (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id),
 code uuid not null default gen_random_uuid() unique, used_at timestamptz, used_by uuid references auth.users(id), cancelled boolean not null default false
);
create table public.coupons (id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events(id), code text not null, percent integer check(percent between 1 and 100), active boolean not null default true, unique(event_id,code));
create table public.audit_log (id bigint generated always as identity primary key, event_id uuid references public.events(id), actor uuid references auth.users(id), action text not null, created_at timestamptz not null default now());
create index orders_event on public.orders(event_id);
create index orders_user on public.orders(user_id);
create index tickets_order on public.tickets(order_id);
create function public.can_access_event(target uuid, allowed_roles text[]) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles p join public.events e on e.id=target
 where p.id=auth.uid() and p.active and p.role=any(allowed_roles)
 and (p.role='admin' or p.organization_id=e.organization_id));
$$;
create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and role='admin' and active);
$$;
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.ticket_types enable row level security;
alter table public.orders enable row level security;
alter table public.tickets enable row level security;
alter table public.coupons enable row level security;
alter table public.audit_log enable row level security;
create policy profile_read on public.profiles for select to authenticated using(id=auth.uid() or public.is_admin());
-- No browser write policies for profiles: clients cannot assign themselves roles.
create policy organization_read on public.organizations for select to authenticated using(public.is_admin() or id in(select organization_id from public.profiles where id=auth.uid()));
create policy event_read on public.events for select using((published and not archived) or public.can_access_event(id,array['admin','organizador','financeiro','checkin']));
create policy event_update on public.events for update to authenticated using(public.can_access_event(id,array['admin','organizador'])) with check(public.is_admin() or organization_id in(select organization_id from public.profiles where id=auth.uid() and role='organizador' and active));
create policy event_insert on public.events for insert to authenticated with check(public.is_admin() or organization_id in(select organization_id from public.profiles where id=auth.uid() and role='organizador' and active));
create policy type_read on public.ticket_types for select using(exists(select 1 from public.events where id=event_id));
create policy order_read on public.orders for select to authenticated using(user_id=auth.uid() or public.can_access_event(event_id,array['admin','organizador','financeiro']));
create policy ticket_read on public.tickets for select to authenticated using(exists(select 1 from public.orders where id=order_id));
create policy coupon_read on public.coupons for select to authenticated using(public.can_access_event(event_id,array['admin','organizador']));
create policy audit_read on public.audit_log for select to authenticated using(public.can_access_event(event_id,array['admin','organizador','financeiro']));
-- Issuance, stock reservations, payment approval and cancellations are server-only.
create function public.check_in(ticket_code uuid) returns text
language plpgsql security definer set search_path='' as $$
declare entry public.tickets; purchase public.orders;
begin
 select * into entry from public.tickets where code=ticket_code for update;
 if not found then return 'invalid'; end if;
 select * into purchase from public.orders where id=entry.order_id for update;
 if not public.can_access_event(purchase.event_id,array['admin','organizador','checkin']) then return 'forbidden'; end if;
 if entry.cancelled or purchase.status <> 'approved' then return 'cancelled'; end if;
 if entry.used_at is not null then return 'used'; end if;
 update public.tickets set used_at=now(),used_by=auth.uid() where id=entry.id;
 insert into public.audit_log(event_id,actor,action) values(purchase.event_id,auth.uid(),'checkin');
 return 'valid';
end;
$$;
revoke all on function public.check_in(uuid) from public, anon;
grant execute on function public.check_in(uuid) to authenticated;
