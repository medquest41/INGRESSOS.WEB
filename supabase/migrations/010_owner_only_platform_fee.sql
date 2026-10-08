-- Somente o administrador principal altera o percentual. Não modifica taxas já definidas.
begin;
create or replace function public.save_event(payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare
 target uuid;org uuid;old public.events;part jsonb;tid uuid;seen uuid[]:='{}';reserved integer;
 requested_fee numeric;final_fee numeric;final_allow boolean:=false;details_payload jsonb;
begin
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

 if coalesce(payload->>'feePayer','buyer') not in ('buyer','organizer') then raise exception 'Taxa inválida';end if;
 requested_fee:=coalesce(nullif(payload->>'feeRate','')::numeric,0.1);
 if requested_fee<0 or requested_fee>1 then raise exception 'Taxa da plataforma inválida';end if;

 if public.is_primary_admin() then
  final_fee:=requested_fee;
  final_allow:=false;
 elsif old.id is null then
  final_fee:=0.1;
  final_allow:=false;
 else
  final_fee:=old.fee_rate;
  final_allow:=false;
 end if;

 details_payload:=payload - array['id','ticketTypes','organizerId','organizerName','feeRate','feeEditableByOrganizer'];
 details_payload:=jsonb_set(details_payload,'{feeEditableByOrganizer}',to_jsonb(final_allow),true);

 insert into public.events(id,organization_id,slug,title,published,archived,details,fee_rate,legacy_id)
 values(target,org,payload->>'slug',trim(payload->>'title'),coalesce((payload->>'published')::boolean,false),coalesce((payload->>'archived')::boolean,false),details_payload,final_fee,nullif(payload->>'legacyId',''))
 on conflict(id) do update set organization_id=excluded.organization_id,slug=excluded.slug,title=excluded.title,published=excluded.published,archived=excluded.archived,details=excluded.details,fee_rate=excluded.fee_rate,legacy_id=coalesce(public.events.legacy_id,excluded.legacy_id);

 for part in select value from jsonb_array_elements(payload->'ticketTypes') loop
  tid:=coalesce(nullif(part->>'id','')::uuid,gen_random_uuid());
  if tid=any(seen) then raise exception 'Lote duplicado';end if;
  if exists(select 1 from public.ticket_types where id=tid and event_id<>target) then raise exception 'Lote de outro evento';end if;
  select coalesce(sum(quantity),0) into reserved from public.orders where ticket_type_id=tid and (status='approved' or status='pending' and expires_at>now());
  if (part->>'available')::integer<reserved then raise exception 'Capacidade inferior às reservas e vendas';end if;
  if length(trim(part->>'name')) not between 1 and 120 then raise exception 'Nome de lote inválido';end if;
  insert into public.ticket_types(id,event_id,name,sector,batch,type,capacity,price_cents,active,starts_at,ends_at,position,sequential,details)
  values(tid,target,trim(part->>'name'),coalesce(part->>'sector',part->>'name'),part->>'batch',coalesce(part->>'type','individual'),(part->>'available')::integer,round((part->>'price')::numeric*100)::integer,coalesce((part->>'active')::boolean,true),nullif(part->>'startsAt','')::timestamptz,nullif(part->>'endsAt','')::timestamptz,coalesce((part->>'position')::integer,0),coalesce((part->>'sequential')::boolean,false),part - array['id','price','available'])
  on conflict(id) do update set name=excluded.name,sector=excluded.sector,batch=excluded.batch,type=excluded.type,capacity=excluded.capacity,price_cents=excluded.price_cents,active=excluded.active,starts_at=excluded.starts_at,ends_at=excluded.ends_at,position=excluded.position,sequential=excluded.sequential,details=excluded.details;
  seen:=array_append(seen,tid);
 end loop;
 if exists(select 1 from public.ticket_types t join public.orders o on o.ticket_type_id=t.id where t.event_id=target and not(t.id=any(seen))) then raise exception 'Preserve lotes com histórico de pedidos; desative-os';end if;
 update public.ticket_types set active=false where event_id=target and not(id=any(seen));
 insert into public.audit_log(event_id,actor,action) values(target,auth.uid(),'event.saved');
 return target;
end$$;
update public.events set details=jsonb_set(details,'{feeEditableByOrganizer}','false'::jsonb,true) where coalesce((details->>'feeEditableByOrganizer')::boolean,false);
commit;
