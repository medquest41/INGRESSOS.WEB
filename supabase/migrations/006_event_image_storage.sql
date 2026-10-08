-- Execute no projeto ingressos-web. Somente cartazes publicos, nunca documentos pessoais.
begin;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('event-images','event-images',true,8388608,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create or replace function public.can_upload_event_image(folder text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.organizations o join public.profiles p on p.id=auth.uid()
 where o.id::text=folder and o.active and p.active and (p.role='admin' or (p.role='organizador' and p.organization_id=o.id)));
$$;
revoke all on function public.can_upload_event_image(text) from public,anon;
grant execute on function public.can_upload_event_image(text) to authenticated;
drop policy if exists ingressos_event_image_insert on storage.objects;
create policy ingressos_event_image_insert on storage.objects for insert to authenticated
with check (bucket_id='event-images' and public.can_upload_event_image((storage.foldername(name))[1]));
-- Sem UPDATE, DELETE ou listagem publica: novos arquivos recebem nomes aleatorios.
commit;
