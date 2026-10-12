-- Incremental. Prepare in staging before applying in production.
-- Existing accounts are preserved; only new duplicate identity writes are rejected.
begin;
create or replace function public.guard_signup_cpf() returns trigger
language plpgsql security definer set search_path='' as $$
declare normalized text:=regexp_replace(coalesce(new.raw_user_meta_data->>'cpf',''),'[^0-9]','','g');
begin
 if normalized='' then return new;end if;
 if tg_op='UPDATE' then
  if normalized=regexp_replace(coalesce(old.raw_user_meta_data->>'cpf',''),'[^0-9]','','g') then return new;end if;
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('signup-cpf:'||normalized,0));
 if exists(select 1 from auth.users u where u.id<>new.id and regexp_replace(coalesce(u.raw_user_meta_data->>'cpf',''),'[^0-9]','','g')=normalized) then
  raise exception using errcode='23505',message='CPF já cadastrado. Entre na sua conta ou recupere sua senha.';
 end if;
 return new;
end $$;
revoke all on function public.guard_signup_cpf() from public,anon,authenticated;
do $$ begin
 if not exists(select 1 from pg_catalog.pg_trigger where tgname='signup_cpf_guard' and tgrelid='auth.users'::regclass) then
  create trigger signup_cpf_guard before insert or update of raw_user_meta_data on auth.users for each row execute function public.guard_signup_cpf();
 end if;
end $$;
commit;
