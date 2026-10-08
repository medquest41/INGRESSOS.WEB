-- Atualizacao 13: criacao publica de organizadores + gestao segura de contas.
-- Incremental: nao remove eventos, pedidos, ingressos ou historico financeiro.
begin;

create table if not exists public.admin_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text not null,
  role text not null check (role in ('organizador','financeiro','checkin','cliente')),
  organization_id uuid references public.organizations(id),
  organization_name text,
  status text not null default 'pending' check (status in ('pending','provisioned','cancelled')),
  invited_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
create unique index if not exists admin_invitations_email_active
  on public.admin_invitations (lower(email))
  where status='pending';

alter table public.admin_invitations enable row level security;
revoke all on public.admin_invitations from anon,authenticated;
grant select on public.admin_invitations to authenticated;
drop policy if exists admin_invitations_primary_admin_read on public.admin_invitations;
create policy admin_invitations_primary_admin_read on public.admin_invitations
  for select to authenticated using (public.is_primary_admin());

create or replace function public.prepare_account_invite(
  invite_name text,
  invite_email text,
  invite_role text,
  organization uuid default null,
  organization_name text default null
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  normalized_email text:=lower(trim(invite_email));
  target uuid;
  org uuid:=organization;
  invitation uuid;
begin
  if not public.is_primary_admin() then raise exception 'Somente o administrador principal pode gerenciar contas';end if;
  if length(trim(invite_name)) not between 2 and 120 then raise exception 'Informe o nome completo';end if;
  if normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'E-mail inválido';end if;
  if normalized_email='ingressosaltatemporada@gmail.com' then raise exception 'O administrador principal já possui acesso';end if;
  if invite_role not in ('organizador','financeiro','checkin','cliente') then raise exception 'Perfil inválido';end if;

  if invite_role='organizador' and org is null then
    if nullif(trim(organization_name),'') is null then raise exception 'Informe a empresa ou organização';end if;
    org:=public.save_organization(null,trim(organization_name),true);
  elsif invite_role in ('financeiro','checkin') then
    if org is null or not exists(select 1 from public.organizations where id=org and active) then
      raise exception 'Selecione uma organização ativa';
    end if;
  else
    org:=null;
  end if;

  select id into target from public.profiles where lower(email)=normalized_email limit 1;
  if target is not null then
    perform public.set_member(target,invite_role,org,true);
    update public.profiles set name=trim(invite_name) where id=target;
    return jsonb_build_object('status','existing','userId',target);
  end if;

  insert into public.admin_invitations(email,name,role,organization_id,organization_name,status,invited_by)
  values(normalized_email,trim(invite_name),invite_role,org,nullif(trim(organization_name),''),'pending',auth.uid())
  on conflict (lower(email)) where status='pending'
  do update set name=excluded.name,role=excluded.role,organization_id=excluded.organization_id,
                organization_name=excluded.organization_name,invited_by=auth.uid(),created_at=now()
  returning id into invitation;

  return jsonb_build_object('status','pending','invitationId',invitation,'email',normalized_email);
end$$;
revoke all on function public.prepare_account_invite(text,text,text,uuid,text) from public,anon;
grant execute on function public.prepare_account_invite(text,text,text,uuid,text) to authenticated;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path='' as $$
declare inv public.admin_invitations;
begin
  select * into inv
  from public.admin_invitations
  where lower(email)=lower(new.email) and status='pending'
  order by created_at desc
  limit 1;

  if inv.id is null then
    insert into public.profiles(id,name,email,role)
    values(new.id,left(coalesce(nullif(new.raw_user_meta_data->>'name',''),'Cliente'),120),new.email,'cliente')
    on conflict(id) do update set email=excluded.email;
  else
    insert into public.profiles(id,name,email,role,organization_id,active)
    values(new.id,left(inv.name,120),new.email,inv.role,inv.organization_id,true)
    on conflict(id) do update set name=excluded.name,email=excluded.email,role=excluded.role,
                                  organization_id=excluded.organization_id,active=true;
    update public.admin_invitations set status='provisioned',accepted_at=now() where id=inv.id;
  end if;
  return new;
end$$;

create or replace function public.become_organizer(organization_name text) returns uuid
language plpgsql security definer set search_path='' as $$
declare org uuid; member_role_current text;
begin
  if not public.active_customer() then raise exception 'Entre na sua conta';end if;
  if length(trim(organization_name)) not between 2 and 120 then raise exception 'Informe o nome do organizador ou empresa';end if;
  select role into member_role_current from public.profiles where id=auth.uid() for update;
  if member_role_current='organizador' then
    return (select organization_id from public.profiles where id=auth.uid());
  end if;
  if member_role_current<>'cliente' then raise exception 'Este perfil já possui uma função administrativa';end if;
  insert into public.organizations(name,active) values(trim(organization_name),true) returning id into org;
  update public.profiles set role='organizador',organization_id=org where id=auth.uid();
  insert into public.audit_log(actor,action) values(auth.uid(),'organizer.self_service_created:'||org);
  return org;
end$$;
revoke all on function public.become_organizer(text) from public,anon;
grant execute on function public.become_organizer(text) to authenticated;

create or replace function public.safe_delete_member(member_id uuid) returns text
language plpgsql security definer set search_path='' as $$
declare target_email text;has_history boolean;
begin
  if not public.is_primary_admin() then raise exception 'Somente o administrador principal pode excluir contas';end if;
  if member_id=auth.uid() then raise exception 'Não é possível excluir sua própria conta';end if;
  select lower(email) into target_email from public.profiles where id=member_id for update;
  if target_email is null then raise exception 'Conta não encontrada';end if;
  if target_email='ingressosaltatemporada@gmail.com' then raise exception 'O administrador principal não pode ser excluído';end if;

  select (
    exists(select 1 from public.orders where user_id=member_id) or
    exists(select 1 from public.tickets where used_by=member_id) or
    exists(select 1 from public.audit_log where actor=member_id) or
    exists(select 1 from public.order_status_history where actor=member_id) or
    exists(select 1 from public.checkin_assignments where user_id=member_id) or
    exists(select 1 from public.checkins where operator_id=member_id) or
    exists(select 1 from public.coupon_uses where user_id=member_id) or
    exists(select 1 from public.transfers where from_user=member_id or to_user=member_id)
  ) into has_history;

  if has_history then
    update public.profiles set active=false where id=member_id;
    insert into public.audit_log(actor,action) values(auth.uid(),'member.deactivated_history:'||member_id);
    return 'deactivated_history';
  end if;

  delete from public.admin_invitations where lower(email)=target_email;
  delete from public.profiles where id=member_id;
  delete from auth.users where id=member_id;
  insert into public.audit_log(actor,action) values(auth.uid(),'member.deleted:'||member_id);
  return 'deleted';
end$$;
revoke all on function public.safe_delete_member(uuid) from public,anon;
grant execute on function public.safe_delete_member(uuid) to authenticated;

commit;
