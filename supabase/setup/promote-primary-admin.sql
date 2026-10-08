-- Run manually in Supabase SQL Editor AFTER creating/confirming the account.
-- No password and no auto-promotion on signup.
begin;
do $$declare target uuid;begin
 select id into target from auth.users where lower(email)='ingressosaltatemporada@gmail.com' and email_confirmed_at is not null;
 if target is null then raise exception 'Crie/confirme ingressosaltatemporada@gmail.com em Authentication > Users primeiro';end if;
 update public.profiles set role='admin',active=true,organization_id=null where id=target;
 if not found then raise exception 'Aplique as migrations primeiro';end if;
 insert into public.audit_log(actor,action) values(target,'primary_admin.manually_promoted');
end$$;
commit;
