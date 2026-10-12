-- Promotores de vendas de um evento. Independente do programa de indicacoes da plataforma.
begin;
create table if not exists public.event_sales_promoters(
 id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events(id),
 invited_name text not null check(length(trim(invited_name)) between 2 and 120),
 invite_secret uuid not null unique default gen_random_uuid(), referral_secret uuid not null unique default gen_random_uuid(),
 commission_mode text not null check(commission_mode in ('percent','fixed')),
 commission_value integer not null check(commission_value>0),
 user_id uuid references auth.users(id), active boolean not null default true,
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), accepted_at timestamptz,
 unique(event_id,user_id), check(commission_mode<>'percent' or commission_value<=10000)
);
create table if not exists public.event_sales_attributions(
 order_id uuid primary key references public.orders(id), promoter_id uuid not null references public.event_sales_promoters(id),
 commission_mode text not null, commission_value integer not null, created_at timestamptz not null default now()
);
create index if not exists event_sales_promoters_event_idx on public.event_sales_promoters(event_id);
create index if not exists event_sales_promoters_user_idx on public.event_sales_promoters(user_id) where user_id is not null;
create index if not exists event_sales_attributions_promoter_idx on public.event_sales_attributions(promoter_id);
alter table public.event_sales_promoters enable row level security;
alter table public.event_sales_attributions enable row level security;
revoke all on public.event_sales_promoters, public.event_sales_attributions from anon,authenticated;
create or replace function public.event_sales_owner(target uuid) returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from public.events e join public.profiles p on p.id=auth.uid() where e.id=target and p.active and (p.role='admin' or p.role='organizador' and p.organization_id=e.organization_id));
$$;
revoke all on function public.event_sales_owner(uuid) from public,anon,authenticated;
create or replace function public.event_sales_invite_info(secret uuid) returns jsonb language sql stable security definer set search_path=pg_catalog,public as $$
 select jsonb_build_object('name',p.invited_name,'eventTitle',e.title,'eventId',e.id,'mode',p.commission_mode,'value',p.commission_value,'available',p.active and not e.archived,'claimed',p.user_id is not null)
 from public.event_sales_promoters p join public.events e on e.id=p.event_id where p.invite_secret=secret;
$$;
revoke all on function public.event_sales_invite_info(uuid) from public;
grant execute on function public.event_sales_invite_info(uuid) to anon,authenticated;
create or replace function public.event_sales_promoters_api(action text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare ev uuid; person public.event_sales_promoters; answer jsonb; begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and active) then raise exception 'Entre em uma conta ativa';end if;
 if action in ('create','list','toggle') then
  ev:=nullif(payload->>'eventId','')::uuid;
  if not public.event_sales_owner(ev) then raise exception 'Sem permissao para gerenciar este evento';end if;
 end if;
 if action='create' then
  if exists(select 1 from public.events where id=ev and archived) then raise exception 'Evento arquivado';end if;
  insert into public.event_sales_promoters(event_id,invited_name,commission_mode,commission_value,created_by)
  values(ev,trim(payload->>'name'),payload->>'mode',(payload->>'value')::integer,auth.uid()) returning * into person;
  return jsonb_build_object('id',person.id,'invite',person.invite_secret);
 elsif action='toggle' then
  update public.event_sales_promoters set active=(payload->>'active')::boolean where id=(payload->>'id')::uuid and event_id=ev;
  return jsonb_build_object('ok',true);
 elsif action='join' then
  if coalesce((payload->>'accepted')::boolean,false) is not true then raise exception 'Aceite as condicoes da divulgacao';end if;
  if not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null and email is not null and not coalesce(is_anonymous,false)) then raise exception 'Confirme o e-mail da sua conta antes de aceitar';end if;
  select * into person from public.event_sales_promoters where invite_secret=(payload->>'secret')::uuid for update;
  if not found or not person.active then raise exception 'Convite indisponivel';end if;
  if person.user_id is not null and person.user_id<>auth.uid() then raise exception 'Este convite ja pertence a outra conta';end if;
  if public.event_sales_owner(person.event_id) then raise exception 'O responsavel pelo evento nao pode aceitar o proprio convite';end if;
  update public.event_sales_promoters set user_id=auth.uid(),accepted_at=coalesce(accepted_at,now()) where id=person.id;
  return jsonb_build_object('ok',true);
 elsif action not in ('list','mine') then raise exception 'Acao invalida';end if;
 select coalesce(jsonb_agg(row_to_json(x) order by x.created_at desc),'[]') into answer from (
  select p.id,p.event_id,p.invited_name,p.commission_mode,p.commission_value,p.active,p.created_at,p.accepted_at,
   case when action='list' then p.invite_secret end as invite_secret,
   case when p.user_id=auth.uid() then p.referral_secret end as referral_secret,
   e.title as event_title,e.slug as event_slug,p.user_id is not null as registered,
   coalesce(s.tickets,0) as tickets,coalesce(s.sales_cents,0) as sales_cents,coalesce(s.commission_cents,0) as commission_cents,
   coalesce(s.orders,'[]') as orders
  from public.event_sales_promoters p join public.events e on e.id=p.event_id
  left join lateral(
   select sum(case when o.status='approved' and not o.payment_review then o.quantity else 0 end) as tickets,
    sum(case when o.status='approved' and not o.payment_review then greatest(o.subtotal_cents-o.discount_cents,0) else 0 end) as sales_cents,
    sum(case when o.status='approved' and not o.payment_review then least(greatest(o.subtotal_cents-o.discount_cents,0),case when a.commission_mode='percent' then round(greatest(o.subtotal_cents-o.discount_cents,0)::numeric*a.commission_value/10000)::bigint else o.quantity::bigint*a.commission_value end) else 0 end) as commission_cents,
    jsonb_agg(jsonb_build_object('id',o.id,'createdAt',o.created_at,'status',o.status,'quantity',o.quantity,'salesCents',greatest(o.subtotal_cents-o.discount_cents,0),'commissionCents',case when o.status='approved' and not o.payment_review then least(greatest(o.subtotal_cents-o.discount_cents,0),case when a.commission_mode='percent' then round(greatest(o.subtotal_cents-o.discount_cents,0)::numeric*a.commission_value/10000)::bigint else o.quantity::bigint*a.commission_value end) else 0 end) order by o.created_at desc) as orders
   from public.event_sales_attributions a join public.orders o on o.id=a.order_id where a.promoter_id=p.id
  ) s on true
  where case when action='list' then p.event_id=ev else p.user_id=auth.uid() end
 ) x;
 return answer;
end $$;
revoke all on function public.event_sales_promoters_api(text,jsonb) from public,anon;
grant execute on function public.event_sales_promoters_api(text,jsonb) to authenticated;
create or replace function public.capture_event_sales_promoter() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare person public.event_sales_promoters; secret text; begin
 if coalesce(new.source,'') not like 'event-promoter:%' then return new;end if;
 secret:=substr(new.source,16);
 if secret!~'^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$' then raise exception 'Link de divulgacao invalido';end if;
 select * into person from public.event_sales_promoters where referral_secret=secret::uuid and event_id=new.event_id and active and user_id is not null for share;
 if not found then raise exception 'Link de divulgacao indisponivel para este evento';end if;
 if person.user_id=new.user_id then return new;end if;
 insert into public.event_sales_attributions(order_id,promoter_id,commission_mode,commission_value) values(new.id,person.id,person.commission_mode,person.commission_value);
 return new;
end $$;
revoke all on function public.capture_event_sales_promoter() from public,anon,authenticated;
drop trigger if exists capture_event_sales_promoter on public.orders;
create trigger capture_event_sales_promoter after insert on public.orders for each row execute function public.capture_event_sales_promoter();
commit;
