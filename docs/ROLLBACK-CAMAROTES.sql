begin;
do $$begin if exists(select 1 from public.orders where snapshot->>'wristbands' is not null) or exists(select 1 from public.ticket_types where type='camarote') then raise exception 'Rollback bloqueado: preserve camarotes e histórico. Desative vendas e mantenha 027 para pedidos existentes.';end if;end$$;
drop trigger release_rejected_camarote on public.inline_payment_attempts;
drop function public.release_rejected_camarote();
drop function public.camarote_availability(uuid);
drop trigger guard_camarote on public.ticket_types;
drop function public.guard_camarote();
drop index public.camarote_event_name_unique;
alter table public.ticket_types drop constraint ticket_kind;
alter table public.ticket_types add constraint ticket_kind check(type in ('individual','table'));
create or replace function public.validate_order_participants(details jsonb,units integer,buyer jsonb) returns jsonb language plpgsql set search_path='' as $$
declare holders jsonb;p jsonb;birth date;rating integer;need boolean;seen text[]:='{}';cpf text;begin
 if units is null or units not between 1 and 10 then raise exception 'Quantidade inválida';end if;
 rating:=case coalesce(details->>'ageRating','Livre') when 'Livre' then 0 when '12+' then 12 when '14+' then 14 when '16+' then 16 when '18+' then 18 else 99 end;
 need:=rating=18 or coalesce((details->>'requireAgeConfirmation')::boolean,false);
 if need and coalesce((buyer->>'ageConfirmed')::boolean,false)=false then raise exception 'Confirmação de maioridade obrigatória';end if;
 birth:=nullif(buyer->>'birthDate','')::date;
 if birth is null or birth>current_date or birth<'1900-01-01' or extract(year from age(current_date,birth))<greatest(rating,case when need then 18 else 0 end) then raise exception 'Idade inferior à classificação ou nascimento inválido';end if;
 if coalesce(buyer->>'participantMode','same') not in ('same','individual') then raise exception 'Modo de participantes inválido';end if;
 if coalesce(buyer->>'participantMode','same')='same' then
  if units>1 and coalesce((details->>'allowSameCpf')::boolean,true)=false then raise exception 'Participantes individuais obrigatórios';end if;
  select jsonb_agg(jsonb_build_object('name',buyer->>'name','cpf',buyer->>'cpf','birthDate',buyer->>'birthDate')) into holders from generate_series(1,units);
 else holders:=buyer->'participants';end if;
 if holders is null or jsonb_typeof(holders)<>'array' or jsonb_array_length(holders)<>units then raise exception 'Informe um participante por ingresso';end if;
 for p in select value from jsonb_array_elements(holders) loop
  cpf:=regexp_replace(coalesce(p->>'cpf',''),'[^0-9]','','g');
  if not public.valid_cpf(cpf) or coalesce(length(trim(p->>'name')),0) not between 3 and 120 or trim(p->>'name') not like '% %' then raise exception 'Nome ou CPF inválido';end if;
  birth:=nullif(p->>'birthDate','')::date;
  if birth is null or birth>current_date or birth<'1900-01-01' or extract(year from age(current_date,birth))<greatest(rating,case when need then 18 else 0 end) then raise exception 'Idade inferior à classificação';end if;
  if coalesce((details->>'allowSameCpf')::boolean,true)=false and cpf=any(seen) then raise exception 'CPF repetido';end if;
  seen:=array_append(seen,cpf);
 end loop;
 return holders;
end$$;

create or replace function public.quote_order(batch_id uuid,units integer,coupon_code text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.ticket_types;e public.events;c public.coupons;subtotal integer;discount integer:=0;fee integer;uses integer;own_uses integer;begin
 if not public.active_customer() then raise exception 'Conta ativa obrigatória';end if;
 if units is null or units not between 1 and 10 then raise exception 'Escolha entre 1 e 10 unidades';end if;
 select * into t from public.ticket_types where id=batch_id;
 select * into e from public.events where id=t.event_id;
 if e.id is null or not e.published or e.archived or not exists(select 1 from public.organizations where id=e.organization_id and active) or not public.batch_open(t.id) then raise exception 'Ingresso indisponível';end if;
 if public.batch_remaining(t.id)<units then raise exception 'Estoque insuficiente';end if;
 subtotal:=t.price_cents*units;
 if trim(coalesce(coupon_code,''))<>'' then
  select * into c from public.coupons where (event_id=e.id or event_id is null) and code=upper(trim(coupon_code)) order by event_id nulls last limit 1;
  if c.id is null or not c.active or c.starts_at>now() or c.expires_at<=now() or c.ticket_type_id is not null and c.ticket_type_id<>t.id then raise exception 'Cupom inválido ou expirado';end if;
  select count(*),count(*) filter(where user_id=auth.uid()) into uses,own_uses from public.orders where coupon_id=c.id and (status='approved' or status='pending' and expires_at>now());
  if c.max_uses>0 and uses>=c.max_uses or c.max_per_user>0 and own_uses>=c.max_per_user then raise exception 'Limite do cupom atingido';end if;
  discount:=least(subtotal,case when c.kind='fixed' then round(c.amount*100)::integer else round(subtotal*c.amount/100)::integer end);
 end if;
 fee:=round((subtotal-discount)*e.fee_rate)::integer;
 return jsonb_build_object('subtotal',subtotal/100.0,'discount',discount/100.0,'fee',case when coalesce(e.details->>'feePayer','buyer')='organizer' then 0 else fee/100.0 end,'platformFee',fee/100.0,'feePayer',coalesce(e.details->>'feePayer','buyer'),'feeRate',e.fee_rate,'total',(subtotal-discount+case when coalesce(e.details->>'feePayer','buyer')='organizer' then 0 else fee end)/100.0,'coupon',upper(trim(coalesce(coupon_code,''))),'couponId',c.id);
end$$;

create or replace function public.create_order(batch_id uuid,units integer,buyer_data jsonb,coupon_code text,request_id uuid,referral text default null,campaign_name text default null) returns uuid language plpgsql security definer set search_path='' as $$
declare t public.ticket_types;e public.events;q jsonb;existing public.orders;target uuid:=gen_random_uuid();email text;birth date;holders jsonb;vip jsonb;begin
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
 if email is null and exists(select 1 from auth.users where id=auth.uid() and is_anonymous) then email:=lower(trim(buyer_data->>'email'));end if;
 if email is null or email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Informe ou confirme seu e-mail';end if;
 holders:=public.validate_order_participants(e.details,units,buyer_data);
 if nullif(buyer_data->>'vipListId','') is not null then
  select value into vip from jsonb_array_elements(coalesce(e.details->'vipLists','[]')) where value->>'id'=buyer_data->>'vipListId';
  if vip is null or units<>1 or coalesce((vip->>'active')::boolean,true)=false or coalesce((vip->>'visible')::boolean,true)=false or nullif(vip->>'deadline','')::timestamptz<=now() or vip->>'ticketTypeId'<>batch_id::text or round((vip->>'price')::numeric*100)::integer<>t.price_cents then raise exception 'Lista VIP indisponível';end if;
  update public.vip_entries set status='cancelled' where event_id=e.id and status='pending' and order_id in(select id from public.orders where expires_at<=now() and status='pending');
  if exists(select 1 from public.vip_entries where event_id=e.id and list_id=vip->>'id' and cpf=regexp_replace(buyer_data->>'cpf','[^0-9]','','g') and status<>'cancelled') then raise exception 'CPF já inscrito';end if;
  
  if (select count(*) from public.vip_entries v left join public.orders vo on vo.id=v.order_id where v.event_id=e.id and v.list_id=vip->>'id' and (v.status in ('confirmed','used') or v.status='pending' and vo.expires_at>now()))>=(vip->>'limit')::integer then raise exception 'Lista VIP esgotada';end if;
 end if;
 insert into public.orders(id,user_id,event_id,ticket_type_id,quantity,total_cents,buyer,idempotency_key,source,campaign,subtotal_cents,discount_cents,fee_cents,coupon_id,expires_at,status,snapshot)
 values(target,auth.uid(),e.id,t.id,units,round((q->>'total')::numeric*100)::integer,jsonb_build_object('name',trim(buyer_data->>'name'),'email',email,'cpf',regexp_replace(buyer_data->>'cpf','[^0-9]','','g'),'phone',left(buyer_data->>'phone',25),'birthDate',birth,'participants',holders,'participantMode',coalesce(buyer_data->>'participantMode','same'),'ageConfirmed',coalesce((buyer_data->>'ageConfirmed')::boolean,false)),request_id,left(referral,120),left(campaign_name,120),round((q->>'subtotal')::numeric*100)::integer,round((q->>'discount')::numeric*100)::integer,round((q->>'platformFee')::numeric*100)::integer,(q->>'couponId')::uuid,now()+interval '15 minutes',case when (q->>'total')::numeric=0 then 'approved' else 'pending' end,jsonb_build_object('feePayer',q->>'feePayer','feeRate',q->'feeRate','eventTitle',e.title,'eventImage',e.details->>'image','eventDate',e.details->>'date','eventTime',e.details->>'time','ticketName',t.name,'batch',t.batch,'sector',t.sector,'unitLabel',case when t.type='table' then 'Mesa/camarote — entrada única do grupo' else 'Individual' end));
 insert into public.order_items(order_id,ticket_type_id,quantity,unit_price_cents) values(target,t.id,units,t.price_cents);
 if (q->>'couponId') is not null then insert into public.coupon_uses(coupon_id,order_id,user_id) values((q->>'couponId')::uuid,target,auth.uid());end if;
 if vip is not null then insert into public.vip_entries(event_id,list_id,user_id,name,cpf,phone,birth_date,status,order_id) values(e.id,vip->>'id',auth.uid(),buyer_data->>'name',regexp_replace(buyer_data->>'cpf','[^0-9]','','g'),buyer_data->>'phone',birth,case when (q->>'total')::numeric=0 then 'confirmed' else 'pending' end,target);end if;
 if (q->>'total')::numeric=0 then perform public.issue_tickets(target);end if;
 insert into public.audit_log(event_id,actor,action) values(e.id,auth.uid(),'order.created:'||target);
 return target;
end$$;

create or replace function public.issue_tickets(purchase_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare o public.orders;begin
 select * into o from public.orders where id=purchase_id for update;
 if o.id is null or o.status<>'approved' or o.payment_review then raise exception 'Pedido não aprovado';end if;
 if exists(select 1 from public.tickets where order_id=o.id) then return;end if;
 insert into public.tickets(order_id,holder,ticket_number) select o.id,coalesce(o.buyer->'participants'->(n-1),jsonb_build_object('name',o.buyer->>'name','cpf',o.buyer->>'cpf')),n from generate_series(1,o.quantity) n;
 insert into public.ticket_email_outbox(order_id) values(o.id) on conflict do nothing;
 update public.orders set email_delivery_status='pending' where id=o.id;
end$$;

notify pgrst,'reload schema';commit;
