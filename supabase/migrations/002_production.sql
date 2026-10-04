-- Incremental migration: apply AFTER 001_platform.sql. No existing event/order is removed.
begin;
alter table public.organizations add column active boolean not null default true;
alter table public.profiles add column email text;
update public.profiles p set email=u.email from auth.users u where u.id=p.id;
alter table public.events add column fee_rate numeric(5,4) not null default 0.1 check(fee_rate between 0 and 1);
alter table public.ticket_types add column active boolean not null default true;
alter table public.ticket_types add column starts_at timestamptz;
alter table public.ticket_types add column ends_at timestamptz;
alter table public.ticket_types add column position integer not null default 0;
alter table public.ticket_types add column sequential boolean not null default false;
alter table public.ticket_types add constraint batch_period check(ends_at is null or starts_at is null or ends_at>starts_at);
alter table public.ticket_types add constraint ticket_kind check(type in ('individual','table'));
alter table public.orders add column subtotal_cents integer not null default 0 check(subtotal_cents>=0);
alter table public.orders add column discount_cents integer not null default 0 check(discount_cents>=0);
alter table public.orders add column fee_cents integer not null default 0 check(fee_cents>=0);
alter table public.orders add column expires_at timestamptz;
alter table public.orders add column coupon_id uuid references public.coupons(id);
alter table public.orders add column campaign text;
alter table public.orders add column snapshot jsonb not null default '{}';
alter table public.coupons add column kind text not null default 'percent' check(kind in ('percent','fixed'));
alter table public.coupons add column amount numeric(12,2) not null default 1 check(amount>0);
update public.coupons set amount=coalesce(percent,1);
alter table public.coupons add column starts_at timestamptz;
alter table public.coupons add column expires_at timestamptz;
alter table public.coupons add column max_uses integer not null default 0 check(max_uses>=0);
alter table public.coupons add column max_per_user integer not null default 0 check(max_per_user>=0);
alter table public.coupons add column ticket_type_id uuid references public.ticket_types(id);
alter table public.coupons add constraint percent_limit check(kind<>'percent' or amount<=100);
create table public.event_images(id uuid primary key default gen_random_uuid(),event_id uuid not null references public.events(id),url text not null check(url like 'https://%'),position integer not null default 0);
create table public.event_sectors(id uuid primary key default gen_random_uuid(),event_id uuid not null references public.events(id),name text not null,kind text not null default 'individual' check(kind in ('individual','table')),layout jsonb not null default '{}',unique(event_id,name));
alter table public.ticket_types add column sector_id uuid references public.event_sectors(id);
-- ticket_types is the batch entity retained for backwards compatibility.
create table public.order_items(id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders(id),ticket_type_id uuid not null references public.ticket_types(id),quantity integer not null check(quantity>0),unit_price_cents integer not null check(unit_price_cents>=0));
create table public.payments(id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders(id),provider text not null,provider_id text unique,status text not null check(status in ('pending','approved','rejected','refunded')),amount_cents integer not null check(amount_cents>=0),currency text not null default 'BRL' check(currency='BRL'));
create table public.checkin_assignments(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id),event_id uuid not null references public.events(id),unique(user_id,event_id));
create table public.checkins(id uuid primary key default gen_random_uuid(),ticket_id uuid not null unique references public.tickets(id),event_id uuid not null references public.events(id),operator_id uuid not null references public.profiles(id));
create table public.coupon_uses(id uuid primary key default gen_random_uuid(),coupon_id uuid not null references public.coupons(id),order_id uuid not null unique references public.orders(id),user_id uuid not null references public.profiles(id));
create table public.refunds(id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders(id),amount_cents integer not null check(amount_cents>=0),status text not null default 'requested' check(status in ('requested','approved','rejected')),reason text not null);
create table public.transfers(id uuid primary key default gen_random_uuid(),ticket_id uuid not null references public.tickets(id),from_user uuid not null references public.profiles(id),to_user uuid not null references public.profiles(id),status text not null default 'requested' check(status in ('requested','approved','rejected')));
create table public.settings(key text primary key,value jsonb not null);
insert into public.settings values ('payments_enabled','false');
create function public.touch_updated_at() returns trigger language plpgsql set search_path='' as $$begin new.updated_at=now();return new;end$$;
do $$declare t text;begin
 foreach t in array array['organizations','profiles','events','ticket_types','orders','tickets','coupons','event_images','event_sectors','order_items','payments','checkin_assignments','checkins','coupon_uses','refunds','transfers','settings'] loop
  execute format('alter table public.%I add column if not exists created_at timestamptz not null default now()',t);
  execute format('alter table public.%I add column updated_at timestamptz not null default now()',t);
  execute format('create trigger touch_updated before update on public.%I for each row execute function public.touch_updated_at()',t);
  execute format('alter table public.%I enable row level security',t);
 end loop;
end$$;
create index profiles_organization on public.profiles(organization_id);
create index events_organization on public.events(organization_id);
create index ticket_types_event on public.ticket_types(event_id);
create index orders_stock on public.orders(ticket_type_id,status,expires_at);
create index orders_coupon on public.orders(coupon_id,user_id);
create index event_images_event on public.event_images(event_id);
create index sectors_event on public.event_sectors(event_id);
create index order_items_order on public.order_items(order_id);
create index payments_order on public.payments(order_id);
create index checkins_event on public.checkins(event_id);
create index audit_event on public.audit_log(event_id,created_at);
create index coupon_uses_coupon on public.coupon_uses(coupon_id,user_id);
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,name,email,role) values(new.id,left(coalesce(nullif(new.raw_user_meta_data->>'name',''),'Cliente'),120),new.email,'cliente')
 on conflict(id) do update set email=excluded.email;
 return new;
end$$;
create trigger auth_profile_created after insert or update of email on auth.users for each row execute function public.handle_new_user();
insert into public.profiles(id,name,email) select id,left(coalesce(nullif(raw_user_meta_data->>'name',''),'Cliente'),120),email from auth.users on conflict(id) do nothing;
-- Never promote from email metadata or from a frontend comparison.
create or replace function public.can_access_event(target uuid,allowed_roles text[]) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p join public.events e on e.id=target join public.organizations o on o.id=e.organization_id
 where p.id=auth.uid() and p.active and p.role=any(allowed_roles)
 and (p.role='admin' or (o.active and p.organization_id=e.organization_id and (p.role<>'checkin' or exists(select 1 from public.checkin_assignments a where a.user_id=p.id and a.event_id=e.id)))));
$$;
create function public.active_customer() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.profiles where id=auth.uid() and active)$$;
drop policy order_read on public.orders;
create policy order_read on public.orders for select to authenticated using(public.active_customer() and (user_id=auth.uid() or public.can_access_event(event_id,array['admin','organizador'])));
drop policy ticket_read on public.tickets;
create policy ticket_read on public.tickets for select to authenticated using(exists(select 1 from public.orders where id=order_id));
drop policy event_read on public.events;
create policy event_read on public.events for select using((published and not archived and exists(select 1 from public.organizations o where o.id=organization_id and o.active)) or public.can_access_event(id,array['admin','organizador','financeiro','checkin']));
drop policy organization_read on public.organizations;
-- Public organization names, never member/contact data.
create policy organization_read on public.organizations for select using(active or public.is_admin());
create policy images_read on public.event_images for select using(exists(select 1 from public.events where id=event_id));
create policy sectors_read on public.event_sectors for select using(exists(select 1 from public.events where id=event_id));
create policy items_read on public.order_items for select to authenticated using(exists(select 1 from public.orders where id=order_id));
create policy payments_read on public.payments for select to authenticated using(exists(select 1 from public.orders where id=order_id));
create policy checkins_read on public.checkins for select to authenticated using(public.can_access_event(event_id,array['admin','organizador','checkin']));
create policy assignment_read on public.checkin_assignments for select to authenticated using(user_id=auth.uid() or public.is_admin());
create policy coupon_uses_read on public.coupon_uses for select to authenticated using(user_id=auth.uid() and public.active_customer() or public.is_admin());
create policy refunds_read on public.refunds for select to authenticated using(exists(select 1 from public.orders where id=order_id));
create policy transfers_read on public.transfers for select to authenticated using(public.active_customer() and (from_user=auth.uid() or to_user=auth.uid()) or public.is_admin());
create policy settings_read on public.settings for select to authenticated using(public.is_admin());
-- Mutations use narrowly-scoped RPCs; deny direct browser writes even if old grants/policies exist.
revoke all on public.organizations,public.profiles,public.events,public.ticket_types,public.orders,public.tickets,public.coupons,public.audit_log,public.event_images,public.event_sectors,public.order_items,public.payments,public.checkin_assignments,public.checkins,public.coupon_uses,public.refunds,public.transfers,public.settings from anon,authenticated;
grant select on public.organizations,public.events,public.ticket_types,public.event_images,public.event_sectors to anon,authenticated;
grant select on public.profiles,public.orders,public.tickets,public.coupons,public.audit_log,public.order_items,public.payments,public.checkin_assignments,public.checkins,public.coupon_uses,public.refunds,public.transfers,public.settings to authenticated;

create function public.save_organization(organization uuid,label text,enabled boolean) returns uuid language plpgsql security definer set search_path='' as $$
declare target uuid:=coalesce(organization,gen_random_uuid());begin
 if not public.is_admin() then raise exception 'Sem permissão';end if;
 if length(trim(label)) not between 2 and 120 then raise exception 'Nome inválido';end if;
 insert into public.organizations(id,name,active) values(target,trim(label),enabled) on conflict(id) do update set name=excluded.name,active=excluded.active;
 insert into public.audit_log(actor,action) values(auth.uid(),'organization.saved:'||target);return target;
end$$;
create function public.set_member(member_id uuid,member_role text,organization uuid,enabled boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Sem permissão';end if;
 if member_id=auth.uid() then raise exception 'Não altere seu próprio acesso';end if;
 if exists(select 1 from auth.users where id=member_id and lower(email)='medquest41@gmail.com') and (member_role<>'admin' or not enabled) then raise exception 'Preserve o administrador principal';end if;
 if member_role not in ('admin','cliente','organizador','financeiro','checkin') then raise exception 'Perfil inválido';end if;
 if member_role in ('organizador','financeiro','checkin') and not exists(select 1 from public.organizations where id=organization and active) then raise exception 'Organização ativa obrigatória';end if;
 update public.profiles set role=member_role,organization_id=case when member_role in ('admin','cliente') then null else organization end,active=enabled where id=member_id;
 if not found then raise exception 'Usuário não encontrado';end if;
 insert into public.audit_log(actor,action) values(auth.uid(),'member.updated:'||member_id);
end$$;
create function public.assign_member(member_email text,member_role text,organization uuid default null,organization_name text default null) returns void language plpgsql security definer set search_path='' as $$
declare target uuid;org uuid:=organization;begin
 if not public.is_admin() then raise exception 'Sem permissão';end if;
 select id into target from auth.users where lower(email)=lower(trim(member_email)) and email_confirmed_at is not null;
 if target is null then raise exception 'A pessoa deve criar e confirmar a conta primeiro, ou ser convidada pelo Dashboard Auth';end if;
 if member_role='organizador' and org is null and nullif(trim(organization_name),'') is not null then org:=public.save_organization(null,organization_name,true);end if;
 perform public.set_member(target,member_role,org,true);
end$$;
create function public.assign_checkin(member_id uuid,event uuid,enabled boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Sem permissão';end if;
 if not exists(select 1 from public.profiles p join public.events e on e.id=event where p.id=member_id and p.role='checkin' and p.organization_id=e.organization_id and p.active) then raise exception 'Operador e evento devem pertencer à mesma organização';end if;
 if enabled then insert into public.checkin_assignments(user_id,event_id) values(member_id,event) on conflict(user_id,event_id) do nothing;
 else delete from public.checkin_assignments where user_id=member_id and event_id=event;end if;
 insert into public.audit_log(actor,event_id,action) values(auth.uid(),event,'checkin.assignment:'||member_id);
end$$;

create function public.save_event(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare target uuid;org uuid;old public.events;part jsonb;tid uuid;seen uuid[]:='{}';reserved integer;begin
 if not public.active_customer() then raise exception 'Entre na sua conta';end if;
 target:=coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid());
 select * into old from public.events where id=target for update;
 org:=nullif(payload->>'organizerId','')::uuid;
 if not public.is_admin() then
  if old.id is not null and not public.can_access_event(target,array['organizador']) then raise exception 'Sem permissão';end if;
  select organization_id into org from public.profiles where id=auth.uid() and role='organizador' and active;
 end if;
 if org is null or not exists(select 1 from public.organizations where id=org and active) then raise exception 'Selecione uma organização ativa';end if;
 if old.id is not null and old.organization_id<>org and exists(select 1 from public.orders where event_id=target) then raise exception 'Evento com pedidos não pode trocar de organização';end if;
 if length(trim(payload->>'title')) not between 2 and 200 or coalesce(payload->>'slug','') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then raise exception 'Nome ou link inválido';end if;
 if jsonb_typeof(payload->'ticketTypes')<>'array' or jsonb_array_length(payload->'ticketTypes')<1 then raise exception 'Inclua pelo menos um lote';end if;
 if coalesce(payload->>'image','')<>'' and payload->>'image' !~ '^https://' then raise exception 'Use imagem HTTPS';end if;
 insert into public.events(id,organization_id,slug,title,published,archived,details,fee_rate)
 values(target,org,payload->>'slug',trim(payload->>'title'),coalesce((payload->>'published')::boolean,false),coalesce((payload->>'archived')::boolean,false),payload - array['id','ticketTypes','organizerId','organizerName'],coalesce((payload->>'feeRate')::numeric,0.1))
 on conflict(id) do update set organization_id=excluded.organization_id,slug=excluded.slug,title=excluded.title,published=excluded.published,archived=excluded.archived,details=excluded.details,fee_rate=excluded.fee_rate;
 for part in select value from jsonb_array_elements(payload->'ticketTypes') loop
  tid:=coalesce(nullif(part->>'id','')::uuid,gen_random_uuid());
  if tid=any(seen) then raise exception 'Lote duplicado';end if;
  if exists(select 1 from public.ticket_types where id=tid and event_id<>target) then raise exception 'Lote de outro evento';end if;
  select coalesce(sum(quantity),0) into reserved from public.orders where ticket_type_id=tid and (status='approved' or status='pending' and expires_at>now());
  if (part->>'available')::integer<reserved then raise exception 'Capacidade inferior às reservas e vendas';end if;
  if length(trim(part->>'name')) not between 1 and 120 then raise exception 'Nome de lote inválido';end if;
  insert into public.ticket_types(id,event_id,name,sector,batch,type,capacity,price_cents,active,starts_at,ends_at,position,sequential)
  values(tid,target,trim(part->>'name'),coalesce(part->>'sector',part->>'name'),part->>'batch',coalesce(part->>'type','individual'),(part->>'available')::integer,round((part->>'price')::numeric*100)::integer,coalesce((part->>'active')::boolean,true),nullif(part->>'startsAt','')::timestamptz,nullif(part->>'endsAt','')::timestamptz,coalesce((part->>'position')::integer,0),coalesce((part->>'sequential')::boolean,false))
  on conflict(id) do update set name=excluded.name,sector=excluded.sector,batch=excluded.batch,type=excluded.type,capacity=excluded.capacity,price_cents=excluded.price_cents,active=excluded.active,starts_at=excluded.starts_at,ends_at=excluded.ends_at,position=excluded.position,sequential=excluded.sequential;
  seen:=array_append(seen,tid);
 end loop;
 if exists(select 1 from public.ticket_types t join public.orders o on o.ticket_type_id=t.id where t.event_id=target and not(t.id=any(seen))) then raise exception 'Preserve lotes com histórico de pedidos; desative-os';end if;
 update public.ticket_types set active=false where event_id=target and not(id=any(seen));
 insert into public.audit_log(event_id,actor,action) values(target,auth.uid(),'event.saved');return target;
end$$;

create function public.batch_remaining(batch_id uuid) returns integer language sql stable security definer set search_path='' as $$
 select greatest(0,t.capacity-coalesce((select sum(o.quantity) from public.orders o where o.ticket_type_id=t.id and (o.status='approved' or o.status='pending' and o.expires_at>now())),0))::integer from public.ticket_types t join public.events e on e.id=t.event_id join public.organizations org on org.id=e.organization_id where t.id=batch_id and ((e.published and not e.archived and org.active) or public.can_access_event(e.id,array['admin','organizador','financeiro','checkin']));
$$;
create function public.batch_open(batch_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select t.active and (t.starts_at is null or t.starts_at<=now()) and (t.ends_at is null or t.ends_at>now()) and (not t.sequential or not exists(select 1 from public.ticket_types prev where prev.event_id=t.event_id and prev.sector=t.sector and prev.position<t.position and prev.active and (prev.starts_at is null or prev.starts_at<=now()) and (prev.ends_at is null or prev.ends_at>now()) and public.batch_remaining(prev.id)>0)) from public.ticket_types t where t.id=batch_id and public.batch_remaining(t.id) is not null;
$$;
create function public.catalog_stock() returns table(id uuid,remaining integer,open boolean) language sql stable security invoker set search_path='' as $$ select t.id,public.batch_remaining(t.id),public.batch_open(t.id) from public.ticket_types t $$;
create function public.save_coupon(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare target uuid:=coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid());event uuid:=(payload->>'eventId')::uuid;begin
 if not public.can_access_event(event,array['admin','organizador']) then raise exception 'Sem permissão';end if;
 if exists(select 1 from public.coupons where id=target and event_id<>event) then raise exception 'Não transfira cupons entre eventos';end if;
 if coalesce(payload->>'code','') !~ '^[A-Z0-9_-]{2,30}$' then raise exception 'Código inválido';end if;
 if nullif(payload->>'ticketId','') is not null and not exists(select 1 from public.ticket_types where id=(payload->>'ticketId')::uuid and event_id=event) then raise exception 'Lote inválido';end if;
 insert into public.coupons(id,event_id,code,kind,amount,active,max_uses,max_per_user,starts_at,expires_at,ticket_type_id)
 values(target,event,payload->>'code',payload->>'type',(payload->>'value')::numeric,coalesce((payload->>'active')::boolean,true),coalesce((payload->>'limit')::integer,0),coalesce((payload->>'perUserLimit')::integer,0),case when nullif(payload->>'startsAt','') is null then null when length(payload->>'startsAt')=10 then (payload->>'startsAt')::date::timestamp at time zone 'America/Sao_Paulo' else (payload->>'startsAt')::timestamptz end,case when nullif(payload->>'expiresAt','') is null then null else ((payload->>'expiresAt')::date+1)::timestamp at time zone 'America/Sao_Paulo' end,nullif(payload->>'ticketId','')::uuid)
 on conflict(id) do update set code=excluded.code,kind=excluded.kind,amount=excluded.amount,active=excluded.active,max_uses=excluded.max_uses,max_per_user=excluded.max_per_user,starts_at=excluded.starts_at,expires_at=excluded.expires_at,ticket_type_id=excluded.ticket_type_id;
 insert into public.audit_log(event_id,actor,action) values(event,auth.uid(),'coupon.saved');return target;
end$$;

create function public.quote_order(batch_id uuid,units integer,coupon_code text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.ticket_types;e public.events;c public.coupons;subtotal integer;discount integer:=0;fee integer;uses integer;own_uses integer;begin
 if not public.active_customer() then raise exception 'Conta ativa obrigatória';end if;
 if units is null or units not between 1 and 10 then raise exception 'Escolha entre 1 e 10 unidades';end if;
 select * into t from public.ticket_types where id=batch_id;
 select * into e from public.events where id=t.event_id;
 if e.id is null or not e.published or e.archived or not exists(select 1 from public.organizations where id=e.organization_id and active) or not public.batch_open(t.id) then raise exception 'Ingresso indisponível';end if;
 if public.batch_remaining(t.id)<units then raise exception 'Estoque insuficiente';end if;
 subtotal:=t.price_cents*units;
 if trim(coalesce(coupon_code,''))<>'' then
  select * into c from public.coupons where event_id=e.id and code=upper(trim(coupon_code));
  if c.id is null or not c.active or c.starts_at>now() or c.expires_at<=now() or c.ticket_type_id is not null and c.ticket_type_id<>t.id then raise exception 'Cupom inválido ou expirado';end if;
  select count(*),count(*) filter(where user_id=auth.uid()) into uses,own_uses from public.orders where coupon_id=c.id and (status='approved' or status='pending' and expires_at>now());
  if c.max_uses>0 and uses>=c.max_uses or c.max_per_user>0 and own_uses>=c.max_per_user then raise exception 'Limite do cupom atingido';end if;
  discount:=least(subtotal,case when c.kind='fixed' then round(c.amount*100)::integer else round(subtotal*c.amount/100)::integer end);
 end if;
 fee:=round((subtotal-discount)*e.fee_rate)::integer;
 return jsonb_build_object('subtotal',subtotal/100.0,'discount',discount/100.0,'fee',fee/100.0,'total',(subtotal-discount+fee)/100.0,'coupon',upper(trim(coalesce(coupon_code,''))),'couponId',c.id);
end$$;
create function public.valid_cpf(raw text) returns boolean language plpgsql immutable set search_path='' as $$
declare cpf text:=regexp_replace(coalesce(raw,''),'[^0-9]','','g');len integer;i integer;s integer;begin
 if cpf !~ '^[0-9]{11}$' or cpf=repeat(substr(cpf,1,1),11) then return false;end if;
 for len in 9..10 loop s:=0;for i in 1..len loop s:=s+substr(cpf,i,1)::integer*(len+2-i);end loop;if substr(cpf,len+1,1)::integer<>((s*10)%11)%10 then return false;end if;end loop;return true;
end$$;
create function public.issue_tickets(purchase_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare o public.orders;begin
 select * into o from public.orders where id=purchase_id for update;
 if o.status<>'approved' then raise exception 'Pedido não aprovado';end if;
 if exists(select 1 from public.tickets where order_id=o.id) then return;end if;
 insert into public.tickets(order_id) select o.id from generate_series(1,o.quantity);
end$$;
create function public.create_order(batch_id uuid,units integer,buyer_data jsonb,coupon_code text,request_id uuid,referral text default null,campaign_name text default null) returns uuid language plpgsql security definer set search_path='' as $$
declare t public.ticket_types;e public.events;q jsonb;existing public.orders;target uuid:=gen_random_uuid();email text;birth date;begin
 if not public.active_customer() then raise exception 'Conta ativa obrigatória';end if;
 if request_id is null then raise exception 'Identificador obrigatório';end if;
 perform pg_advisory_xact_lock(hashtextextended(request_id::text,0));
 select * into existing from public.orders where idempotency_key=request_id;
 if found then
  if existing.user_id<>auth.uid() or existing.ticket_type_id<>batch_id or existing.quantity<>units then raise exception 'Requisição incompatível';end if;
  return existing.id;
 end if;
 select * into t from public.ticket_types where id=batch_id;
 -- Serialize stock operations per event, including sequential batches and event edits.
 select * into e from public.events where id=t.event_id for update;
 if e.id is null then raise exception 'Evento não encontrado';end if;
 perform 1 from public.ticket_types where id=batch_id for update;
 perform 1 from public.coupons where (event_id=e.id or event_id is null) and code=upper(trim(coupon_code)) order by event_id nulls last for update;
 q:=public.quote_order(batch_id,units,coupon_code);
 if not public.valid_cpf(buyer_data->>'cpf') or coalesce(length(trim(buyer_data->>'name')),0) not between 3 and 120 or trim(buyer_data->>'name') not like '% %' or regexp_replace(coalesce(buyer_data->>'phone',''),'[^0-9]','','g') !~ '^[0-9]{10,13}$' then raise exception 'Confira nome completo, CPF e telefone';end if;
 birth:=nullif(buyer_data->>'birthDate','')::date;
 if birth is null or birth>current_date or birth<'1900-01-01' then raise exception 'Data de nascimento inválida';end if;
 select u.email into email from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null;
 if email is null then raise exception 'Confirme seu e-mail';end if;
 insert into public.orders(id,user_id,event_id,ticket_type_id,quantity,total_cents,buyer,idempotency_key,source,campaign,subtotal_cents,discount_cents,fee_cents,coupon_id,expires_at,status,snapshot)
 values(target,auth.uid(),e.id,t.id,units,round((q->>'total')::numeric*100)::integer,jsonb_build_object('name',trim(buyer_data->>'name'),'email',email,'cpf',regexp_replace(buyer_data->>'cpf','[^0-9]','','g'),'phone',left(buyer_data->>'phone',25),'birthDate',birth),request_id,left(referral,120),left(campaign_name,120),round((q->>'subtotal')::numeric*100)::integer,round((q->>'discount')::numeric*100)::integer,round((q->>'fee')::numeric*100)::integer,(q->>'couponId')::uuid,now()+interval '15 minutes',case when (q->>'total')::numeric=0 then 'approved' else 'pending' end,jsonb_build_object('eventTitle',e.title,'eventImage',e.details->>'image','eventDate',e.details->>'date','eventTime',e.details->>'time','ticketName',t.name,'batch',t.batch,'sector',t.sector,'unitLabel',case when t.type='table' then 'Mesa/camarote — entrada única do grupo' else 'Individual' end));
 insert into public.order_items(order_id,ticket_type_id,quantity,unit_price_cents) values(target,t.id,units,t.price_cents);
 if (q->>'couponId') is not null then insert into public.coupon_uses(coupon_id,order_id,user_id) values((q->>'couponId')::uuid,target,auth.uid());end if;
 if (q->>'total')::numeric=0 then perform public.issue_tickets(target);end if;
 insert into public.audit_log(event_id,actor,action) values(e.id,auth.uid(),'order.created:'||target);
 return target;
end$$;

create function public.cancel_order(purchase_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare o public.orders;event uuid;begin
 select event_id into event from public.orders where id=purchase_id;
 perform 1 from public.events where id=event for update;
 select * into o from public.orders where id=purchase_id for update;
 if o.id is null or not public.active_customer() or not (public.can_access_event(o.event_id,array['admin','organizador','financeiro']) or (o.user_id=auth.uid() and o.status='pending')) then raise exception 'Sem permissão';end if;
 if o.status='cancelled' then return;end if;
 if o.status='refunded' or exists(select 1 from public.tickets where order_id=o.id and used_at is not null) then raise exception 'Pedido já estornado ou ingresso utilizado';end if;
 if exists(select 1 from public.payments where order_id=o.id and status='approved' and amount_cents>0) then raise exception 'Solicite estorno pelo provedor antes de cancelar um pagamento real';end if;
 update public.orders set status='cancelled' where id=o.id;
 update public.tickets set cancelled=true where order_id=o.id;
 insert into public.audit_log(event_id,actor,action) values(o.event_id,auth.uid(),'order.cancelled:'||o.id);
end$$;
create or replace function public.check_in(ticket_code uuid) returns text language plpgsql security definer set search_path='' as $$
declare entry public.tickets;purchase public.orders;begin
 -- Lock order before ticket: same order as cancellation/issuance, avoiding deadlocks.
 select o.* into purchase from public.orders o join public.tickets t on t.order_id=o.id where t.code=ticket_code;
 if purchase.id is null then return 'invalid';end if;
 if not public.can_access_event(purchase.event_id,array['admin','organizador','checkin']) then return 'forbidden';end if;
 select * into purchase from public.orders where id=purchase.id for update;
 select * into entry from public.tickets where code=ticket_code for update;
 if entry.cancelled or purchase.status<>'approved' then return 'cancelled';end if;
 if entry.used_at is not null then return 'used';end if;
 update public.tickets set used_at=now(),used_by=auth.uid() where id=entry.id;
 insert into public.checkins(ticket_id,event_id,operator_id) values(entry.id,purchase.event_id,auth.uid());
 insert into public.audit_log(event_id,actor,action) values(purchase.event_id,auth.uid(),'checkin.valid');
 return 'valid';
end$$;
create function public.finance_orders() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'event_id',o.event_id,'quantity',o.quantity,'status',o.status,'total_cents',o.total_cents,'subtotal_cents',o.subtotal_cents,'discount_cents',o.discount_cents,'fee_cents',o.fee_cents,'created_at',o.created_at,'source',o.source,'snapshot',o.snapshot,'buyer','{}'::jsonb,'tickets','[]'::jsonb)),'[]'::jsonb) from public.orders o where public.can_access_event(o.event_id,array['admin','organizador','financeiro']);
$$;
create function public.checkin_summary() returns jsonb language sql stable security definer set search_path='' as $$select coalesce(jsonb_agg(x),'[]'::jsonb) from (select e.id as event_id,(select count(*) from public.tickets t join public.orders o on o.id=t.order_id where o.event_id=e.id and o.status='approved' and not t.cancelled) as issued,(select count(*) from public.checkins c where c.event_id=e.id) as checked_in from public.events e where public.can_access_event(e.id,array['admin','organizador','checkin'])) x$$;

-- Service-only settlement boundary for a future verified Mercado Pago webhook.
create function public.settle_payment(purchase_id uuid,external_payment_id text,paid_cents integer,currency_code text) returns void language plpgsql security definer set search_path='' as $$
declare o public.orders;event uuid;reserved integer;begin
 if coalesce((select value='true'::jsonb from public.settings where key='payments_enabled'),false)=false then raise exception 'Pagamentos não habilitados';end if;
 select event_id into event from public.orders where id=purchase_id;
 perform 1 from public.events where id=event for update;
 select * into o from public.orders where id=purchase_id for update;
 if o.id is null or o.total_cents<>paid_cents or currency_code<>'BRL' or nullif(external_payment_id,'') is null then raise exception 'Pagamento incompatível';end if;
 if exists(select 1 from public.payments where provider_id=external_payment_id and order_id=o.id and status='approved') then return;end if;
 if o.status<>'pending' then raise exception 'Pedido não está pendente';end if;
 select coalesce(sum(quantity),0) into reserved from public.orders where ticket_type_id=o.ticket_type_id and id<>o.id and (status='approved' or status='pending' and expires_at>now());
 if reserved+o.quantity>(select capacity from public.ticket_types where id=o.ticket_type_id) then raise exception 'Reserva expirada sem estoque: reconciliar e estornar';end if;
 if o.expires_at<=now() then raise exception 'Reserva expirada: reconciliar e estornar';end if;
 insert into public.payments(order_id,provider,provider_id,status,amount_cents) values(o.id,'mercadopago',external_payment_id,'approved',paid_cents);
 update public.orders set status='approved',payment_id=external_payment_id where id=o.id;
 perform public.issue_tickets(o.id);
 insert into public.audit_log(event_id,action) values(o.event_id,'payment.approved:'||o.id);
end$$;
-- Explicit EXECUTE allowlist: default PostgreSQL PUBLIC execution is unsafe.
do $$declare r record;begin
 for r in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(array['touch_updated_at','handle_new_user','can_access_event','is_admin','active_customer','save_organization','set_member','assign_member','assign_checkin','save_event','batch_remaining','batch_open','catalog_stock','save_coupon','quote_order','valid_cpf','issue_tickets','create_order','cancel_order','check_in','finance_orders','checkin_summary','settle_payment']) loop
  execute format('revoke all on function %s from public,anon,authenticated',r.signature);
 end loop;
end$$;
grant execute on function public.is_admin(),public.can_access_event(uuid,text[]),public.batch_remaining(uuid),public.batch_open(uuid),public.catalog_stock() to anon,authenticated;
grant execute on function public.active_customer(),public.save_organization(uuid,text,boolean),public.set_member(uuid,text,uuid,boolean),public.assign_member(text,text,uuid,text),public.assign_checkin(uuid,uuid,boolean),public.save_event(jsonb),public.save_coupon(jsonb),public.quote_order(uuid,integer,text),public.create_order(uuid,integer,jsonb,text,uuid,text,text),public.cancel_order(uuid),public.check_in(uuid),public.finance_orders(),public.checkin_summary() to authenticated;
grant execute on function public.settle_payment(uuid,text,integer,text) to service_role;
commit;
