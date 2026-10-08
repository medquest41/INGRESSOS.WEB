-- Administrador principal confirmado pelo proprietario em 04/10/2026.
begin;
create or replace function public.set_member(member_id uuid,member_role text,organization uuid,enabled boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Sem permissão';end if;
 if member_id=auth.uid() then raise exception 'Não altere seu próprio acesso';end if;
 if exists(select 1 from auth.users where id=member_id and lower(email)='ingressosaltatemporada@gmail.com') and (member_role<>'admin' or not enabled) then raise exception 'Preserve o administrador principal';end if;
 if member_role not in ('admin','cliente','organizador','financeiro','checkin') then raise exception 'Perfil inválido';end if;
 if member_role in ('organizador','financeiro','checkin') and not exists(select 1 from public.organizations where id=organization and active) then raise exception 'Organização ativa obrigatória';end if;
 update public.profiles set role=member_role,organization_id=case when member_role in ('admin','cliente') then null else organization end,active=enabled where id=member_id;
 if not found then raise exception 'Usuário não encontrado';end if;
 insert into public.audit_log(actor,action) values(auth.uid(),'member.updated:'||member_id);
end$$;
commit;
