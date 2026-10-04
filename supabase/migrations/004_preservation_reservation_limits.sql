begin;
alter table public.ticket_types add column details jsonb not null default '{}';
create or replace function public.save_event(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare target uuid;org uuid;old public.events;part jsonb;tid uuid;seen uuid[]:='{}';reserved integer;begin
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
 insert into public.events(id,organization_id,slug,title,published,archived,details,fee_rate,legacy_id)
 values(target,org,payload->>'slug',trim(payload->>'title'),coalesce((payload->>'published')::boolean,false),coalesce((payload->>'archived')::boolean,false),payload - array['id','ticketTypes','organizerId','organizerName'],coalesce((payload->>'feeRate')::numeric,0.1),nullif(payload->>'legacyId',''))
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
 insert into public.audit_log(event_id,actor,action) values(target,auth.uid(),'event.saved');return target;
end$$;

create or replace function public.create_order(batch_id uuid,units integer,buyer_data jsonb,coupon_code text,request_id uuid,referral text default null,campaign_name text default null) returns uuid language plpgsql security definer set search_path='' as $$
declare t public.ticket_types;e public.events;q jsonb;existing public.orders;target uuid:=gen_random_uuid();email text;birth date;begin
 if not public.active_customer() then raise exception 'Conta ativa obrigatória';end if;
 if request_id is null then raise exception 'Identificador obrigatório';end if;
 perform pg_advisory_xact_lock(hashtextextended(request_id::text,0));
 select * into existing from public.orders where idempotency_key=request_id;
 if found then
  if existing.user_id<>auth.uid() or existing.ticket_type_id<>batch_id or existing.quantity<>units then raise exception 'Requisição incompatível';end if;
  return existing.id;
 end if;
 perform pg_advisory_xact_lock(hashtextextended('buyer:'||auth.uid()::text,0));
 if (select count(*) from public.orders where user_id=auth.uid() and status='pending' and expires_at>now())>=5 then raise exception 'Limite de reservas ativas atingido. Cancele ou conclua os pedidos anteriores';end if;
 select * into t from public.ticket_types where id=batch_id;
 -- Serialize stock operations per event, including sequential batches and event edits.
 select * into e from public.events where id=t.event_id for update;
 if e.id is null then raise exception 'Evento não encontrado';end if;
 perform 1 from public.ticket_types where id=batch_id for update;
 perform 1 from public.coupons where (event_id=e.id or event_id is null) and code=upper(trim(coupon_code)) order by event_id nulls last for update;
 q:=public.quote_order(batch_id,units,coupon_code);
 if not public.valid_cpf(buyer_data->>'cpf') or coalesce(length(trim(buyer_data->>'name')),0) not between 3 and 120 or trim(buyer_data->>'name') not like '% %' or regexp_replace(coalesce(buyer_data->>'phone',''),'[^0-9]','','g') !~ '^[0-9]{10,13}$' then raise exception 'Confira nome completo, CPF e telefone';end if;
 birth:=nullif(buyer_data->>'birthDate','')::date;
 if birth is null or birth>current_date or birth<'1900-01-01' then raise exception 'Data de nascimento inválida';end if;
 select u.email into email from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null;
 if email is null then raise exception 'Confirme seu e-mail';end if;
 insert into public.orders(id,user_id,event_id,ticket_type_id,quantity,total_cents,buyer,idempotency_key,source,campaign,subtotal_cents,discount_cents,fee_cents,coupon_id,expires_at,status,snapshot)
 values(target,auth.uid(),e.id,t.id,units,round((q->>'total')::numeric*100)::integer,jsonb_build_object('name',trim(buyer_data->>'name'),'email',email,'cpf',regexp_replace(buyer_data->>'cpf','[^0-9]','','g'),'phone',left(buyer_data->>'phone',25),'birthDate',birth),request_id,left(referral,120),left(campaign_name,120),round((q->>'subtotal')::numeric*100)::integer,round((q->>'discount')::numeric*100)::integer,round((q->>'fee')::numeric*100)::integer,(q->>'couponId')::uuid,now()+interval '15 minutes',case when (q->>'total')::numeric=0 then 'approved' else 'pending' end,jsonb_build_object('eventTitle',e.title,'eventImage',e.details->>'image','eventDate',e.details->>'date','eventTime',e.details->>'time','ticketName',t.name,'batch',t.batch,'sector',t.sector,'unitLabel',case when t.type='table' then 'Mesa/camarote — entrada única do grupo' else 'Individual' end));
 insert into public.order_items(order_id,ticket_type_id,quantity,unit_price_cents) values(target,t.id,units,t.price_cents);
 if (q->>'couponId') is not null then insert into public.coupon_uses(coupon_id,order_id,user_id) values((q->>'couponId')::uuid,target,auth.uid());end if;
 if (q->>'total')::numeric=0 then perform public.issue_tickets(target);end if;
 insert into public.audit_log(event_id,actor,action) values(e.id,auth.uid(),'order.created:'||target);
 return target;
end$$;

commit;
