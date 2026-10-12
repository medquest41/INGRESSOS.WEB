-- Owner-only directory. No tables or existing data are modified.
begin;
create or replace function public.promoter_admin_directory(page integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;skip integer:=greatest(0,least(page,100000))*100;
begin
 perform public.promoter_require_user();
 if not public.legal_is_owner() then raise exception 'Acesso restrito ao Administrador Geral';end if;
 select jsonb_build_object('promoters',coalesce(jsonb_agg(row_data),'[]'::jsonb)) into result from(
 select p.user_id,p.display_name,p.phone,p.status,p.created_at,u.email,
 coalesce(nullif(trim(u.raw_user_meta_data->>'name'),''),p.display_name) as name,
 nullif(regexp_replace(coalesce(u.raw_user_meta_data->>'cpf',''),'[^0-9]','','g'),'') as cpf
 from public.promoter_profiles p join auth.users u on u.id=p.user_id
 order by p.created_at desc,p.user_id limit 100 offset skip
 )row_data;
 return result;
end $$;
revoke all on function public.promoter_admin_directory(integer) from public,anon,authenticated;
grant execute on function public.promoter_admin_directory(integer) to authenticated;
commit;
