begin;
-- Check-in accounts may work at multiple organizers, only through explicit event assignments.
create or replace function public.can_access_event(target uuid,allowed_roles text[]) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p join public.events e on e.id=target join public.organizations o on o.id=e.organization_id
 where p.id=auth.uid() and p.active and p.role=any(allowed_roles)
 and (p.role='admin' or (o.active and ((p.role='checkin' and exists(select 1 from public.checkin_assignments a where a.user_id=p.id and a.event_id=e.id)) or (p.role<>'checkin' and p.organization_id=e.organization_id)))));
$$;
create or replace function public.event_checkin_team(target_event uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not public.can_access_event(target_event,array['admin','organizador']) then raise exception 'Sem permissão para gerenciar a equipe deste evento';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'email',u.email,'active',p.active) order by p.name) from public.checkin_assignments a join public.profiles p on p.id=a.user_id join auth.users u on u.id=p.id where a.event_id=target_event),'[]'::jsonb);
end$$;
create or replace function public.set_event_checkin_member(target_event uuid,member_email text,enabled boolean) returns void
language plpgsql security definer set search_path='' as $$
declare member public.profiles%rowtype; confirmed timestamptz;
begin
 if not public.can_access_event(target_event,array['admin','organizador']) then raise exception 'Sem permissão para gerenciar a equipe deste evento';end if;
 if enabled is null or length(trim(coalesce(member_email,''))) not between 3 and 254 then raise exception 'Informe um e-mail válido';end if;
 select p.* into member from public.profiles p join auth.users u on u.id=p.id where lower(u.email)=lower(trim(member_email)) for update of p;
 if member.id is null then raise exception 'Essa pessoa precisa criar sua conta com este e-mail antes de ser adicionada';end if;
 if enabled then
  select email_confirmed_at into confirmed from auth.users where id=member.id;
  if confirmed is null then raise exception 'Essa pessoa precisa confirmar o e-mail da conta';end if;
  if not member.active then raise exception 'Essa conta está desativada';end if;
  if member.role not in ('cliente','checkin') then raise exception 'Essa conta já possui um perfil de gestão. Use uma conta de cliente ou portaria';end if;
  if member.role='cliente' then update public.profiles set role='checkin' where id=member.id;end if;
  insert into public.checkin_assignments(user_id,event_id) values(member.id,target_event) on conflict(user_id,event_id) do nothing;
 else
  delete from public.checkin_assignments where user_id=member.id and event_id=target_event;
 end if;
 insert into public.audit_log(actor,event_id,action) values(auth.uid(),target_event,case when enabled then 'checkin.member.authorized:' else 'checkin.member.revoked:' end||member.id);
end$$;
revoke all on function public.event_checkin_team(uuid),public.set_event_checkin_member(uuid,text,boolean) from public,anon;
grant execute on function public.event_checkin_team(uuid),public.set_event_checkin_member(uuid,text,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
