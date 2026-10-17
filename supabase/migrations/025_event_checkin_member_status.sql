begin;
alter table public.checkin_assignments add column if not exists active boolean not null default true;
alter table public.pending_checkin_team add column if not exists active boolean not null default true;

-- Check-in accounts may work at multiple organizers, only through explicit event assignments.
create or replace function public.can_access_event(target uuid,allowed_roles text[]) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p join public.events e on e.id=target join public.organizations o on o.id=e.organization_id
 where p.id=auth.uid() and p.active and p.role=any(allowed_roles)
 and (p.role='admin' or (o.active and ((p.role='checkin' and exists(select 1 from public.checkin_assignments a where a.user_id=p.id and a.event_id=e.id and a.active)) or (p.role<>'checkin' and p.organization_id=e.organization_id)))));
$$;
create or replace function public.event_checkin_team(target_event uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not public.can_access_event(target_event,array['admin','organizador']) then raise exception 'Sem permissão para gerenciar a equipe deste evento';end if;
 return coalesce((select jsonb_agg(x order by x->>'email') from (
 select jsonb_build_object('id',p.id,'name',p.name,'email',u.email,'active',a.active,'accountActive',p.active,'pending',false) x from public.checkin_assignments a join public.profiles p on p.id=a.user_id join auth.users u on u.id=p.id where a.event_id=target_event
 union all select jsonb_build_object('id','pending:'||i.email,'name','Aguardando cadastro ou confirmação','email',i.email,'active',i.active,'pending',true) from public.pending_checkin_team i where i.event_id=target_event
 ) rows),'[]'::jsonb);
end$$;
create or replace function public.set_event_checkin_member(target_event uuid,member_email text,enabled boolean) returns void
language plpgsql security definer set search_path='' as $$
declare member public.profiles%rowtype; confirmed timestamptz; normalized text:=lower(trim(coalesce(member_email,'')));
begin
 if not public.can_access_event(target_event,array['admin','organizador']) then raise exception 'Sem permissão para gerenciar a equipe deste evento';end if;
 if enabled is null or length(normalized) not between 3 and 254 or normalized !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then raise exception 'Informe um e-mail válido';end if;
 select p.* into member from public.profiles p join auth.users u on u.id=p.id where lower(u.email)=normalized for update of p;
 if member.id is not null then
  if enabled then
   if not member.active then raise exception 'Essa conta está desativada';end if;
   if member.role not in ('cliente','checkin') then raise exception 'Essa conta já possui um perfil de gestão. Use uma conta de cliente ou portaria';end if;
  end if;
 end if;
 select email_confirmed_at into confirmed from auth.users where id=member.id;
 if member.id is null or confirmed is null then
   insert into public.pending_checkin_team(event_id,email,invited_by) values(target_event,normalized,auth.uid()) on conflict(event_id,email) do update set invited_by=excluded.invited_by,created_at=now();
   update public.pending_checkin_team set active=enabled where event_id=target_event and email=normalized;
  else
   if member.role='cliente' then update public.profiles set role='checkin' where id=member.id;end if;
   insert into public.checkin_assignments(user_id,event_id,active) values(member.id,target_event,enabled) on conflict(user_id,event_id) do update set active=excluded.active;
   delete from public.pending_checkin_team where event_id=target_event and email=normalized;
  end if;

 insert into public.audit_log(actor,event_id,action) values(auth.uid(),target_event,case when enabled then 'checkin.email.authorized:' else 'checkin.email.disabled:' end||normalized);
end$$;
create or replace function public.claim_event_checkin_invites() returns void
language plpgsql security definer set search_path='' as $$
declare member public.profiles%rowtype; verified_email text; invitation record;
begin
 select lower(email) into verified_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
 if verified_email is null then return;end if;
 select * into member from public.profiles where id=auth.uid() for update;
 if member.id is null or not member.active or member.role not in ('cliente','checkin') then return;end if;
 if member.role='cliente' and exists(select 1 from public.checkin_assignments where user_id=member.id) then
  update public.profiles set role='checkin' where id=member.id;
 end if;
 for invitation in select i.* from public.pending_checkin_team i join public.events e on e.id=i.event_id join public.organizations o on o.id=e.organization_id join public.profiles inviter on inviter.id=i.invited_by where i.email=verified_email and o.active and inviter.active and (inviter.role='admin' or (inviter.role='organizador' and inviter.organization_id=e.organization_id)) for update of i loop
  update public.profiles set role='checkin' where id=member.id and role='cliente';
  insert into public.checkin_assignments(user_id,event_id,active) values(member.id,invitation.event_id,invitation.active) on conflict(user_id,event_id) do update set active=excluded.active;
  delete from public.pending_checkin_team where event_id=invitation.event_id and email=verified_email;
  insert into public.audit_log(actor,event_id,action) values(member.id,invitation.event_id,'checkin.email.accepted');
 end loop;
end$$;
revoke all on function public.claim_event_checkin_invites() from public,anon;
grant execute on function public.claim_event_checkin_invites() to authenticated;
create or replace function public.remove_event_checkin_member(target_event uuid,member_email text) returns void
language plpgsql security definer set search_path='' as $$
declare normalized text:=lower(trim(coalesce(member_email,''))); member_id uuid;
begin
 if not public.can_access_event(target_event,array['admin','organizador']) then raise exception 'Sem permissão para gerenciar a equipe deste evento';end if;
 select p.id into member_id from public.profiles p join auth.users u on u.id=p.id where lower(u.email)=normalized for update of p;
 delete from public.pending_checkin_team where event_id=target_event and email=normalized;
 delete from public.checkin_assignments where event_id=target_event and user_id=member_id;
 insert into public.audit_log(actor,event_id,action) values(auth.uid(),target_event,'checkin.email.revoked:'||normalized);
end$$;
revoke all on function public.remove_event_checkin_member(uuid,text) from public,anon;
grant execute on function public.remove_event_checkin_member(uuid,text) to authenticated;
-- Versioned read endpoint prevents the new UI from using the old removal semantics before activation.
create or replace function public.event_checkin_team_v18(target_event uuid) returns jsonb
language sql stable security invoker set search_path='' as $$select public.event_checkin_team(target_event)$$;
revoke all on function public.event_checkin_team_v18(uuid) from public,anon;
grant execute on function public.event_checkin_team_v18(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
