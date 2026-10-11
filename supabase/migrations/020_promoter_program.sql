-- 020: Programa de Promotores. Incremental, desativado por padrão.
-- Não executa Pix, não altera documentos jurídicos, pedidos, eventos ou pagamentos existentes.
begin;
create table public.promoter_rate_versions(
 id uuid primary key default gen_random_uuid(), promoter_id uuid references auth.users(id),
 first_rate_bps integer not null check(first_rate_bps between 0 and 10000),
 recurring_rate_bps integer not null check(recurring_rate_bps between 0 and 10000),
 first_events integer not null default 15 check(first_events=15),
 created_by uuid references auth.users(id),created_at timestamptz not null default now(),reason text not null check(length(trim(reason))>=5)
);
insert into public.promoter_rate_versions(first_rate_bps,recurring_rate_bps,reason) values(500,400,'Condição padrão inicial: 5% / 4%, primeiros 15 eventos elegíveis por organizador.');
create table public.promoter_settings(id boolean primary key default true check(id),enabled boolean not null default false,default_rate_version uuid not null references public.promoter_rate_versions(id));
insert into public.promoter_settings select true,false,id from public.promoter_rate_versions;
create table public.promoter_profiles(
 user_id uuid primary key references auth.users(id),display_name text not null,phone text not null,
 pix_kind text not null check(pix_kind in('cpf','cnpj','email','phone','random')),pix_key text not null,pix_holder text not null,
 status text not null default 'pending' check(status in('pending','approved','rejected','suspended')),
 rate_version uuid not null references public.promoter_rate_versions(id),proposed_rate_version uuid references public.promoter_rate_versions(id),
 link_token text unique,created_at timestamptz not null default now(),approved_at timestamptz,approved_by uuid references auth.users(id),
 check(link_token is null or link_token~'^[a-f0-9]{64}$')
);
create table public.promoter_rate_acceptances(user_id uuid not null references auth.users(id),rate_version uuid not null references public.promoter_rate_versions(id),accepted_at timestamptz not null default now(),primary key(user_id,rate_version));
create table public.promoter_signup_captures(
 user_id uuid primary key references auth.users(id),promoter_id uuid not null references public.promoter_profiles(user_id),
 rate_version uuid not null references public.promoter_rate_versions(id),identity_hash text unique not null,created_at timestamptz not null default now(),
 check(user_id<>promoter_id)
);
create table public.promoter_referrals(
 organization_id uuid primary key references public.organizations(id),user_id uuid unique not null references auth.users(id),
 promoter_id uuid not null references public.promoter_profiles(user_id),rate_version uuid not null references public.promoter_rate_versions(id),
 created_at timestamptz not null default now(),check(user_id<>promoter_id)
);
create index promoter_referrals_promoter on public.promoter_referrals(promoter_id);
create table public.promoter_event_closures(
 event_id uuid primary key references public.events(id),organization_id uuid not null references public.promoter_referrals(organization_id),
 promoter_id uuid not null references public.promoter_profiles(user_id),rate_version uuid not null references public.promoter_rate_versions(id),
 ordinal integer not null check(ordinal>0),rate_bps integer not null check(rate_bps between 0 and 10000),
 occurred_at timestamptz not null,reconciled_at timestamptz not null default now(),closed_by uuid not null references auth.users(id),
 evidence text not null check(length(trim(evidence))>=10)
);
create table public.promoter_recurring_tiers(organization_id uuid primary key references public.promoter_referrals(organization_id),first_recurring_event uuid not null references public.promoter_event_closures(event_id),activated_at timestamptz not null default now());
create table public.promoter_event_cancellations(event_id uuid primary key references public.events(id),actor uuid not null references auth.users(id),reason text not null check(length(trim(reason))>=10),created_at timestamptz not null default now());
create table public.promoter_commission_entries(
 id uuid primary key default gen_random_uuid(),event_id uuid not null references public.promoter_event_closures(event_id),
 promoter_id uuid not null references public.promoter_profiles(user_id),revision integer not null check(revision>0),
 net_fee_cents bigint not null check(net_fee_cents>=0),commission_delta_cents bigint not null,
 total_commission_cents bigint not null check(total_commission_cents>=0),source_hash text not null,
 source_snapshot jsonb not null,reason text not null check(length(trim(reason))>=10),created_at timestamptz not null default now(),
 actor uuid not null references auth.users(id),unique(event_id,revision)
);
create table public.promoter_manual_payments(
 id uuid primary key default gen_random_uuid(),promoter_id uuid not null references public.promoter_profiles(user_id),
 amount_cents bigint not null check(amount_cents>0),pix_snapshot jsonb not null,external_reference text unique not null,
 paid_at timestamptz not null,recorded_at timestamptz not null default now(),actor uuid not null references auth.users(id),
 request_id uuid unique not null,note text not null check(length(trim(note))>=10)
);
create table public.promoter_financial_resolutions(id uuid primary key default gen_random_uuid(),event_id uuid not null references public.events(id),source_hash text not null,net_fee_cents bigint not null check(net_fee_cents>=0),reference text not null,reason text not null,actor uuid not null references auth.users(id),created_at timestamptz not null default now(),unique(event_id,source_hash));
create table public.promoter_audit(
 id bigint generated always as identity primary key,actor uuid references auth.users(id),subject uuid,
 action text not null,details jsonb not null default '{}',created_at timestamptz not null default now()
);
create index promoter_profiles_queue on public.promoter_profiles(created_at desc,user_id);
create index promoter_referrals_page on public.promoter_referrals(promoter_id,created_at desc,organization_id);
create index promoter_closures_promoter on public.promoter_event_closures(promoter_id,event_id);
create index promoter_entries_page on public.promoter_commission_entries(promoter_id,created_at desc,id);
create index promoter_payments_page on public.promoter_manual_payments(promoter_id,recorded_at desc,id);
create index promoter_audit_subject on public.promoter_audit(subject,id desc);
-- Append-only evidence: snapshots, financial history, attribution and configuration versions cannot be edited.
do $$declare t text;begin
 foreach t in array array['promoter_financial_resolutions','promoter_recurring_tiers','promoter_event_cancellations','promoter_rate_versions','promoter_rate_acceptances','promoter_signup_captures','promoter_referrals','promoter_event_closures','promoter_commission_entries','promoter_manual_payments','promoter_audit'] loop
 execute format('create trigger promoter_immutable before update or delete on public.%I for each row execute function public.legal_immutable()',t);
 end loop;
 foreach t in array array['promoter_financial_resolutions','promoter_recurring_tiers','promoter_event_cancellations','promoter_rate_versions','promoter_settings','promoter_profiles','promoter_rate_acceptances','promoter_signup_captures','promoter_referrals','promoter_event_closures','promoter_commission_entries','promoter_manual_payments','promoter_audit'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 end loop;
end$$;
create function public.promoter_require_owner() returns void language plpgsql security definer set search_path='' as $$begin
 if not public.legal_is_owner() then raise exception 'Exclusivo do Administrador Geral';end if;
end$$;
create function public.promoter_require_user() returns void language plpgsql security definer set search_path='' as $$begin
 if not exists(select 1 from public.profiles p join auth.users u on u.id=p.id where p.id=auth.uid() and p.active and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)) then raise exception 'Conta ativa e e-mail confirmado obrigatórios';end if;
end$$;
create function public.promoter_program_ready() returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select s.enabled and c.program_enabled from public.promoter_settings s cross join public.legal_config c where s.id and c.id),false)
$$;
create function public.promoter_program_info() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('enabled',public.promoter_program_ready(),'rateVersion',v.id,'firstRateBps',v.first_rate_bps,'recurringRateBps',v.recurring_rate_bps,'firstEvents',v.first_events) from public.promoter_settings s join public.promoter_rate_versions v on v.id=s.default_rate_version where s.id
$$;
create function public.promoter_link_info(token text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('name',p.display_name,'valid',true) from public.promoter_profiles p join public.profiles u on u.id=p.user_id where public.promoter_program_ready() and p.status='approved' and u.active and token~'^[a-f0-9]{64}$' and p.link_token=token
$$;
create function public.promoter_apply(display_name text,phone text,pix_kind text,pix_key text,pix_holder text,claims jsonb,rate_version uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v public.promoter_settings;kind text:=pix_kind;key text:=trim(pix_key);begin
 perform public.promoter_require_user();
 if not public.promoter_program_ready() then raise exception 'Programa ainda não ativado';end if;
 if length(trim(display_name)) not between 2 and 120 or regexp_replace(phone,'[^0-9]','','g')!~'^[0-9]{10,15}$' or length(trim(pix_holder)) not between 3 and 160 then raise exception 'Confira nome, telefone e titular Pix';end if;
 if kind not in('cpf','cnpj','email','phone','random') or length(key) not between 5 and 254 then raise exception 'Chave Pix inválida';end if;
 if kind='email' and key!~'^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or kind='random' and key!~*'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' or kind in('cpf','cnpj') and regexp_replace(key,'[^0-9]','','g')!~(case when kind='cpf' then '^[0-9]{11}$' else '^[0-9]{14}$' end) or kind='phone' and regexp_replace(key,'[^0-9]','','g')!~'^[0-9]{10,15}$' then raise exception 'Formato da chave Pix inválido';end if;
 select * into v from public.promoter_settings where id for update;
 if rate_version is distinct from v.default_rate_version then raise exception 'Condições alteradas; confira novamente';end if;
 perform public.legal_validate(auth.uid(),claims,array['promotores'],'promoter.enrollment');
 insert into public.promoter_profiles(user_id,display_name,phone,pix_kind,pix_key,pix_holder,rate_version)
 values(auth.uid(),trim(display_name),regexp_replace(phone,'[^0-9]','','g'),kind,key,trim(pix_holder),rate_version);
 insert into public.promoter_rate_acceptances(user_id,rate_version) values(auth.uid(),rate_version);
 insert into public.promoter_applications(user_id) values(auth.uid()) on conflict do nothing;
 insert into public.promoter_audit(actor,subject,action) values(auth.uid(),auth.uid(),'application.submitted');
end$$;
create function public.promoter_review(target uuid,decision text,reason text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform public.promoter_require_owner();
 if decision not in('approved','rejected','suspended') or length(trim(reason))<10 then raise exception 'Decisão e justificativa obrigatórias';end if;
 perform 1 from public.promoter_profiles where user_id=target for update;if not found then raise exception 'Cadastro complementar inexistente';end if;
 if decision='approved' and not exists(select 1 from auth.users u join public.profiles p on p.id=u.id where u.id=target and p.active and u.email_confirmed_at is not null) then raise exception 'Conta não confirmada ou inativa';end if;
 update public.promoter_profiles set status=decision,link_token=case when decision='approved' then coalesce(link_token,replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','')) else link_token end,approved_at=case when decision='approved' then now() else approved_at end,approved_by=auth.uid() where user_id=target;
 update public.promoter_applications set status=case when decision='approved' then 'approved' when decision='suspended' then 'suspended' else 'pending' end where user_id=target;
 insert into public.promoter_audit(actor,subject,action,details) values(auth.uid(),target,'application.'||decision,jsonb_build_object('reason',reason));
end$$;
create function public.promoter_set_rates(target uuid,first_bps integer,recurring_bps integer,reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare v uuid;begin
 perform public.promoter_require_owner();if length(trim(reason))<10 then raise exception 'Justificativa obrigatória';end if;
 insert into public.promoter_rate_versions(promoter_id,first_rate_bps,recurring_rate_bps,created_by,reason) values(target,first_bps,recurring_bps,auth.uid(),reason) returning id into v;
 if target is null then update public.promoter_settings set default_rate_version=v where id;
 else update public.promoter_profiles set proposed_rate_version=v where user_id=target;if not found then raise exception 'Promotor inexistente';end if;end if;
 insert into public.promoter_audit(actor,subject,action,details) values(auth.uid(),target,'rates.proposed',jsonb_build_object('version',v,'reason',reason));return v;
end$$;
create function public.promoter_accept_rates(version uuid) returns void language plpgsql security definer set search_path='' as $$begin
 perform public.promoter_require_user();perform 1 from public.promoter_profiles where user_id=auth.uid() and proposed_rate_version=version for update;
 if not found then raise exception 'Proposta inválida';end if;
 insert into public.promoter_rate_acceptances(user_id,rate_version) values(auth.uid(),version);
 update public.promoter_profiles set rate_version=version,proposed_rate_version=null where user_id=auth.uid();
 insert into public.promoter_audit(actor,subject,action,details) values(auth.uid(),auth.uid(),'rates.accepted',jsonb_build_object('version',version));
end$$;
create function public.promoter_set_enabled(enabled boolean,reason text) returns void language plpgsql security definer set search_path='' as $$begin
 perform public.promoter_require_owner();if length(trim(reason))<10 then raise exception 'Justificativa obrigatória';end if;
 if enabled and not exists(select 1 from public.legal_config c join public.legal_documents d on d.slug='promotores' and d.version=c.active_versions->>'promotores' and d.published where c.company->>'reviewed'='true') then raise exception 'Termos aprovados indisponíveis';end if;
 update public.promoter_settings set enabled=promoter_set_enabled.enabled where id;
 update public.legal_config set program_enabled=enabled where id;
 insert into public.promoter_audit(actor,action,details) values(auth.uid(),'program.activation',jsonb_build_object('enabled',enabled,'reason',reason));
end$$;
create function public.promoter_valid_cpf(value text) returns boolean language plpgsql immutable set search_path='' as $$
declare s text:=regexp_replace(value,'[^0-9]','','g');len integer;i integer;total integer;digit integer;begin
 if s!~'^[0-9]{11}$' or s=repeat(substr(s,1,1),11) then return false;end if;
 for len in 9..10 loop total:=0;for i in 1..len loop total:=total+substr(s,i,1)::integer*(len+2-i);end loop;digit:=(total*10)%11;if digit=10 then digit:=0;end if;if substr(s,len+1,1)::integer<>digit then return false;end if;end loop;return true;
end$$;
-- A referral is captured only at INSERT of a genuinely new auth account, never by updating metadata later.
create function public.promoter_capture_signup() returns trigger language plpgsql security definer set search_path='' as $$
declare token text:=new.raw_user_meta_data->>'promoterReferral';p public.promoter_profiles;cpf text;identity text;begin
 if token is null then return new;end if;
 if not public.promoter_program_ready() then raise exception 'Indicação indisponível';end if;
 select pp.* into p from public.promoter_profiles pp join public.profiles u on u.id=pp.user_id where pp.link_token=token and pp.status='approved' and u.active for share of pp;
 if p.user_id is null or new.is_anonymous or new.email is null or lower(new.email)=(select lower(email) from auth.users where id=p.user_id) then raise exception 'Indicação inválida ou autoindicação';end if;
 cpf:=regexp_replace(coalesce(new.raw_user_meta_data->>'cpf',''),'[^0-9]','','g');
 if not public.promoter_valid_cpf(cpf) then raise exception 'CPF válido obrigatório para indicação';end if;
 -- CPF digest is server-only, never returned publicly. Same identity cannot restart attribution.
 identity:=encode(sha256(convert_to(cpf,'UTF8')),'hex');
 if exists(select 1 from auth.users u where u.id<>new.id and regexp_replace(coalesce(u.raw_user_meta_data->>'cpf',''),'[^0-9]','','g')=cpf) or exists(select 1 from public.promoter_profiles pp where pp.pix_kind='cpf' and regexp_replace(pp.pix_key,'[^0-9]','','g')=cpf) then raise exception 'Identidade já cadastrada ou autoindicação';end if;
 insert into public.promoter_signup_captures(user_id,promoter_id,rate_version,identity_hash) values(new.id,p.user_id,p.rate_version,identity);
 return new;
end$$;
create trigger promoter_capture_signup after insert on auth.users for each row execute function public.promoter_capture_signup();
create function public.promoter_link_organization() returns trigger language plpgsql security definer set search_path='' as $$
declare c public.promoter_signup_captures;o public.organizations;begin
 if new.organization_id is null or new.role<>'organizador' or new.organization_id is not distinct from old.organization_id then return new;end if;
 select * into c from public.promoter_signup_captures where user_id=new.id;if not found then return new;end if;
 if old.organization_id is not null or not exists(select 1 from auth.users where id=new.id and email_confirmed_at is not null) then raise exception 'Vinculação inválida';end if;
 select * into o from public.organizations where id=new.organization_id;
 if o.created_at<c.created_at or exists(select 1 from public.events where organization_id=o.id) or exists(select 1 from public.profiles where organization_id=o.id and id<>new.id) then raise exception 'A indicação exige uma nova organização';end if;
 insert into public.promoter_referrals(organization_id,user_id,promoter_id,rate_version) values(o.id,new.id,c.promoter_id,c.rate_version);
 insert into public.promoter_audit(actor,subject,action,details) values(new.id,c.promoter_id,'organizer.attributed',jsonb_build_object('organization',o.id));
 return new;
end$$;
create trigger promoter_link_organization after update of organization_id on public.profiles for each row execute function public.promoter_link_organization();

-- Financial source is read-only. Only settled provider receipts contribute to the platform net fee.
-- Current marketplace settlement charges provider fees to the organizer (total - platform fee - provider fee).
-- Therefore deducting provider fees from platform fee again would be a double deduction.
create function public.promoter_raw_financial_source(target_event uuid) returns jsonb language sql stable security definer set search_path='' as $$
 with source as(
 select o.id,o.status,o.fee_cents,o.provider_fee_cents,o.payment_review,o.payment_id,o.total_cents,o.test_archived_at,
 coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'status',p.status,'amount',p.amount_cents,'provider',p.provider_id) order by p.id) from public.payments p where p.order_id=o.id),'[]') as payments,
 coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'amount',r.amount_cents,'status',r.status) order by r.id) from public.refunds r where r.order_id=o.id),'[]') as refunds,
 exists(select 1 from public.payments p where p.order_id=o.id and p.status='approved' and p.provider_id=o.payment_id and p.amount_cents=o.total_cents and p.currency='BRL') as verified,
 exists(select 1 from public.refunds r where r.order_id=o.id and r.status in('requested','approved')) as refund_open
 from public.orders o where o.event_id=target_event
 ), totals as(select
 coalesce(jsonb_agg(to_jsonb(s) order by id),'[]') as snapshot,
 coalesce(bool_or(test_archived_at is null and ((payment_review and status<>'refunded') or (status='approved' and total_cents>0 and (provider_fee_cents is null or not verified)) or (status='approved' and refund_open))),false) as blocked,
 greatest(0,coalesce(sum(case when test_archived_at is null and status='approved' and total_cents>0 and verified and not payment_review and not refund_open then fee_cents else 0 end),0))::bigint as net
 from source s)
 select jsonb_build_object('net',case when exists(select 1 from public.promoter_event_cancellations where event_id=target_event) then 0 else net end,'blocked',blocked,'snapshot',snapshot,'hash',encode(sha256(convert_to(snapshot::text||coalesce((select reason from public.promoter_event_cancellations where event_id=target_event),''),'UTF8')),'hex')) from totals
$$;
create function public.promoter_financial_source(target_event uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare raw jsonb:=public.promoter_raw_financial_source(target_event);r public.promoter_financial_resolutions;begin
 select * into r from public.promoter_financial_resolutions where event_id=target_event and source_hash=raw->>'hash';
 if found then return raw||jsonb_build_object('net',case when exists(select 1 from public.promoter_event_cancellations where event_id=target_event) then 0 else r.net_fee_cents end,'blocked',false,'resolution',r.id,'hash',encode(sha256(convert_to((raw->>'hash')||r.id::text,'UTF8')),'hex'));end if;return raw;
end$$;
create function public.promoter_resolve_financial_review(target_event uuid,net_cents bigint,reference text,reason text) returns void language plpgsql security definer set search_path='' as $$
declare raw jsonb;cap bigint;begin
 perform public.promoter_require_owner();
 if net_cents is null or net_cents<0 or length(trim(reference)) not between 10 and 200 or length(trim(reason))<10 then raise exception 'Informe taxa líquida, referência do extrato e evidência da conciliação';end if;
 perform 1 from public.events where id=target_event for update;
 if not exists(select 1 from public.events e join public.promoter_referrals r on r.organization_id=e.organization_id where e.id=target_event) then raise exception 'Evento sem indicação';end if;
 perform 1 from public.orders where event_id=target_event order by id for update;
 raw:=public.promoter_raw_financial_source(target_event);
 if not (raw->>'blocked')::boolean then raise exception 'Sem revisão pendente: utilize a conciliação normal';end if;
 select coalesce(sum(o.fee_cents),0) into cap from public.orders o where o.event_id=target_event and o.status='approved' and o.test_archived_at is null and exists(select 1 from public.payments p where p.order_id=o.id and p.provider_id=o.payment_id and p.amount_cents=o.total_cents and p.status='approved');
 if net_cents>cap then raise exception 'Taxa líquida superior às taxas recebidas e verificadas';end if;
 insert into public.promoter_financial_resolutions(event_id,source_hash,net_fee_cents,reference,reason,actor) values(target_event,raw->>'hash',net_cents,reference,reason,auth.uid());
 insert into public.promoter_audit(actor,action,details) values(auth.uid(),'financial.review.confirmed',jsonb_build_object('event',target_event,'netCents',net_cents,'reference',reference,'reason',reason));
end$$;
create function public.promoter_event_date(value text) returns date language plpgsql immutable set search_path='' as $$
declare s text:=lower(trim(value));m text[];month integer;begin
 if s~'^\d{4}-\d{2}-\d{2}' then return substr(s,1,10)::date;end if;
 m:=regexp_match(s,'(\d{1,2})/(\d{1,2})/(\d{4})');if m is not null then return make_date(m[3]::integer,m[2]::integer,m[1]::integer);end if;
 m:=regexp_match(s,'(\d{1,2}) de ([a-zç]+) de (\d{4})');
 if m is not null then month:=array_position(array['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'],m[2]);if month is not null then return make_date(m[3]::integer,month,m[1]::integer);end if;end if;
 return null;
end$$;
create function public.promoter_close_event(target_event uuid,occurred_at timestamptz,evidence text) returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.events;r public.promoter_referrals;v public.promoter_rate_versions;s jsonb;num integer;rate integer;amount bigint;begin
 perform public.promoter_require_owner();
 if occurred_at is null or occurred_at>now() or length(trim(evidence))<10 then raise exception 'Confirme a realização passada e a apuração financeira';end if;
 select * into e from public.events where id=target_event for update;if not found then raise exception 'Evento inexistente';end if;
 if occurred_at<e.created_at then raise exception 'Realização anterior à criação do evento';end if;
 if public.promoter_event_date(e.details->>'date') is null then raise exception 'Data do evento não reconhecida: confira o cadastro antes da apuração';end if;
 if public.promoter_event_date(e.details->>'date')>current_date or occurred_at::date<public.promoter_event_date(e.details->>'date') then raise exception 'Evento ainda não realizado ou data de realização incompatível';end if;
 perform 1 from public.orders where event_id=e.id order by id for update;
 select * into r from public.promoter_referrals where organization_id=e.organization_id for update;
 if not found then raise exception 'Organizador sem indicação';end if;
 if exists(select 1 from public.promoter_event_closures where event_id=e.id) then raise exception 'Evento já fechado: utilize reconciliação';end if;
 s:=public.promoter_financial_source(e.id);
 if (s->>'blocked')::boolean then raise exception 'Pagamento ou estorno pendente de conciliação';end if;
 if (s->>'net')::bigint<=0 then raise exception 'Evento sem taxa líquida elegível';end if;
 -- Only currently eligible, previously closed events advance the tier; closed snapshots never change.
 select count(*)::integer+1 into num from public.promoter_event_closures c
 where c.organization_id=r.organization_id and (select x.net_fee_cents from public.promoter_commission_entries x where x.event_id=c.event_id order by revision desc limit 1)>0;
 select * into v from public.promoter_rate_versions where id=r.rate_version;
 if exists(select 1 from public.promoter_recurring_tiers where organization_id=r.organization_id) then select coalesce(max(ordinal),15)+1 into num from public.promoter_event_closures where organization_id=r.organization_id;end if;
 rate:=case when num<=v.first_events then v.first_rate_bps else v.recurring_rate_bps end;
 amount:=round((s->>'net')::numeric*rate/10000)::bigint;
 insert into public.promoter_event_closures(event_id,organization_id,promoter_id,rate_version,ordinal,rate_bps,occurred_at,closed_by,evidence)
 values(e.id,r.organization_id,r.promoter_id,v.id,num,rate,occurred_at,auth.uid(),evidence);
 if num>15 then insert into public.promoter_recurring_tiers(organization_id,first_recurring_event) values(r.organization_id,e.id) on conflict do nothing;end if;
 insert into public.promoter_commission_entries(event_id,promoter_id,revision,net_fee_cents,commission_delta_cents,total_commission_cents,source_hash,source_snapshot,reason,actor)
 values(e.id,r.promoter_id,1,(s->>'net')::bigint,amount,amount,s->>'hash',s->'snapshot',evidence,auth.uid());
 insert into public.promoter_audit(actor,subject,action,details) values(auth.uid(),r.promoter_id,'commission.closed',jsonb_build_object('event',e.id,'ordinal',num,'rateBps',rate,'amountCents',amount));
 return jsonb_build_object('ordinal',num,'rateBps',rate,'amountCents',amount);
end$$;
create function public.promoter_reconcile_event(target_event uuid,reason text) returns bigint language plpgsql security definer set search_path='' as $$
declare c public.promoter_event_closures;last public.promoter_commission_entries;s jsonb;amount bigint;delta bigint;begin
 perform public.promoter_require_owner();if length(trim(reason))<10 then raise exception 'Justificativa obrigatória';end if;
 perform 1 from public.events where id=target_event for update;
 perform 1 from public.orders where event_id=target_event order by id for update;
 select * into c from public.promoter_event_closures where event_id=target_event;
 if not found then raise exception 'Fechamento inexistente';end if;
 perform 1 from public.promoter_referrals where organization_id=c.organization_id for update;
 select * into last from public.promoter_commission_entries where event_id=target_event order by revision desc limit 1;
 s:=public.promoter_financial_source(target_event);
 if (s->>'blocked')::boolean then raise exception 'Pagamento ou estorno pendente de conciliação';end if;
 if s->>'hash'=last.source_hash then return 0;end if;
 amount:=round((s->>'net')::numeric*c.rate_bps/10000)::bigint;delta:=amount-last.total_commission_cents;
 insert into public.promoter_commission_entries(event_id,promoter_id,revision,net_fee_cents,commission_delta_cents,total_commission_cents,source_hash,source_snapshot,reason,actor)
 values(target_event,c.promoter_id,last.revision+1,(s->>'net')::bigint,delta,amount,s->>'hash',s->'snapshot',reason,auth.uid());
 insert into public.promoter_audit(actor,subject,action,details) values(auth.uid(),c.promoter_id,'commission.adjusted',jsonb_build_object('event',target_event,'delta',delta,'reason',reason));return delta;
end$$;
create function public.promoter_record_payment(target uuid,amount_cents bigint,external_reference text,paid_at timestamptz,request_id uuid,note text) returns uuid language plpgsql security definer set search_path='' as $$
declare p public.promoter_profiles;c public.promoter_event_closures;x public.promoter_commission_entries;s jsonb;balance bigint;existing public.promoter_manual_payments;payment_record_id uuid;begin
 perform public.promoter_require_owner();
 if amount_cents is null or amount_cents<=0 or paid_at is null or paid_at>now() or request_id is null or length(trim(external_reference)) not between 6 and 200 or length(trim(note))<10 then raise exception 'Confira valor, comprovante Pix, data e justificativa';end if;
 -- Serialize manual registrations. Lock event/orders before financial records in the same order as settlement.
 perform 1 from public.events where id in(select event_id from public.promoter_event_closures where promoter_id=target) order by id for update;
 perform 1 from public.orders where event_id in(select event_id from public.promoter_event_closures where promoter_id=target) order by event_id,id for update;
 select * into p from public.promoter_profiles where user_id=target for update;
 if not found then raise exception 'Promotor inexistente';end if;
 if p.status<>'approved' then raise exception 'Confira e aprove os dados Pix antes de registrar o pagamento';end if;
 select * into existing from public.promoter_manual_payments m where m.request_id=promoter_record_payment.request_id;
 if found then
 if existing.promoter_id=target and existing.amount_cents=amount_cents and existing.external_reference=trim(external_reference) then return existing.id;end if;
 raise exception 'Chave de repetição com conteúdo divergente';end if;
 for c in select * from public.promoter_event_closures where promoter_id=target order by event_id loop
 select * into x from public.promoter_commission_entries where event_id=c.event_id order by revision desc limit 1;
 s:=public.promoter_financial_source(c.event_id);
 if (s->>'blocked')::boolean or s->>'hash'<>x.source_hash then raise exception 'Reconcilie as alterações financeiras antes de registrar Pix';end if;
 end loop;
 select coalesce(sum(commission_delta_cents),0)-(select coalesce(sum(m.amount_cents),0) from public.promoter_manual_payments m where m.promoter_id=target) into balance from public.promoter_commission_entries where promoter_id=target;
 select least(balance,coalesce(sum(commission_delta_cents),0)-(select coalesce(sum(m.amount_cents),0) from public.promoter_manual_payments m where m.promoter_id=target)) into balance from public.promoter_commission_entries where promoter_id=target and created_at<=promoter_record_payment.paid_at;
 if amount_cents>balance then raise exception 'Valor superior ao saldo liberado na data do Pix';end if;
 insert into public.promoter_manual_payments(promoter_id,amount_cents,pix_snapshot,external_reference,paid_at,actor,request_id,note)
 values(target,amount_cents,jsonb_build_object('kind',p.pix_kind,'key',p.pix_key,'holder',p.pix_holder),trim(external_reference),paid_at,auth.uid(),request_id,note) returning promoter_manual_payments.id into payment_record_id;
 insert into public.promoter_audit(actor,subject,action,details) values(auth.uid(),target,'pix.manually.recorded',jsonb_build_object('payment',payment_record_id,'amountCents',amount_cents,'reference',external_reference));return payment_record_id;
end$$;
create function public.promoter_cancel_event(target_event uuid,reason text) returns void language plpgsql security definer set search_path='' as $$begin
 perform public.promoter_require_owner();if length(trim(reason))<10 then raise exception 'Justificativa obrigatória';end if;
 perform 1 from public.events where id=target_event for update;
 if not exists(select 1 from public.events e join public.promoter_referrals r on r.organization_id=e.organization_id where e.id=target_event) then raise exception 'Evento sem indicação';end if;
 insert into public.promoter_event_cancellations(event_id,actor,reason) values(target_event,auth.uid(),reason);
 insert into public.promoter_audit(actor,action,details) values(auth.uid(),'commission.event_cancelled',jsonb_build_object('event',target_event,'reason',reason));
end$$;
-- No automatic charge/debit or Pix integration. An existing real Pix receipt is recorded by the owner.
create function public.promoter_update_pix(kind text,key text,holder text,reason text) returns void language plpgsql security definer set search_path='' as $$begin
 perform public.promoter_require_user();
 if kind not in('cpf','cnpj','email','phone','random') or length(trim(key)) not between 5 and 254 or length(trim(holder)) not between 3 and 160 or length(trim(reason))<10 then raise exception 'Confira chave, titular e justificativa';end if;
 update public.promoter_profiles set pix_kind=kind,pix_key=trim(key),pix_holder=trim(holder),status='pending' where user_id=auth.uid();
 if not found then raise exception 'Cadastro inexistente';end if;
 insert into public.promoter_audit(actor,subject,action,details) values(auth.uid(),auth.uid(),'pix.changed.reapproval_required',jsonb_build_object('reason',reason));
end$$;
create function public.promoter_dashboard(target uuid default null,page integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare owner boolean:=public.legal_is_owner();who uuid:=coalesce(target,auth.uid());data jsonb;skip integer:=greatest(0,least(page,100000))*100;begin
 perform public.promoter_require_user();
 if not owner and who<>auth.uid() then raise exception 'Sem acesso ao painel de outro promotor';end if;
 select jsonb_build_object(
 'owner',owner,'program',public.promoter_program_info(),
 'profile',(select to_jsonb(p)||jsonb_build_object('email',u.email) from public.promoter_profiles p join auth.users u on u.id=p.user_id where p.user_id=who),
 'rates',coalesce((select jsonb_agg(to_jsonb(v)) from public.promoter_rate_versions v where v.id in(select rate_version from public.promoter_profiles where user_id=who) or v.id in(select proposed_rate_version from public.promoter_profiles where user_id=who)),'[]'),
 'promoters',case when owner and target is null then coalesce((select jsonb_agg(z) from(select p.user_id,p.display_name,p.phone,p.pix_kind,p.pix_key,p.pix_holder,p.status,u.email from public.promoter_profiles p join auth.users u on u.id=p.user_id order by p.created_at desc,p.user_id limit 100 offset skip)z),'[]') else '[]'::jsonb end,
 'referrals',coalesce((select jsonb_agg(z) from(select r.organization_id,r.created_at,o.name from public.promoter_referrals r join public.organizations o on o.id=r.organization_id where r.promoter_id=who order by r.created_at desc,r.organization_id limit 100 offset skip)z),'[]'),
 'events',coalesce((select jsonb_agg(z) from(select e.id,e.title,e.organization_id,c.ordinal,c.rate_bps,c.reconciled_at,
 (select x.total_commission_cents from public.promoter_commission_entries x where x.event_id=e.id order by revision desc limit 1) as commission_cents,
 case when c.event_id is null then null else (select x.source_hash from public.promoter_commission_entries x where x.event_id=e.id order by revision desc limit 1) is distinct from public.promoter_financial_source(e.id)->>'hash' or (public.promoter_financial_source(e.id)->>'blocked')::boolean end as needs_reconciliation
 from public.events e join public.promoter_referrals r on r.organization_id=e.organization_id left join public.promoter_event_closures c on c.event_id=e.id where r.promoter_id=who and e.created_at>=r.created_at order by e.created_at desc,e.id limit 100 offset skip)z),'[]'),
 'entries',coalesce((select jsonb_agg(z) from(select id,event_id,revision,net_fee_cents,commission_delta_cents,total_commission_cents,created_at,reason from public.promoter_commission_entries where promoter_id=who order by created_at desc,id limit 100 offset skip)z),'[]'),
 'payments',coalesce((select jsonb_agg(z) from(select id,amount_cents,external_reference,paid_at,note from public.promoter_manual_payments where promoter_id=who order by recorded_at desc,id limit 100 offset skip)z),'[]'),
 'balanceCents',coalesce((select sum(commission_delta_cents) from public.promoter_commission_entries where promoter_id=who),0)-coalesce((select sum(amount_cents) from public.promoter_manual_payments where promoter_id=who),0),
 'audit',case when owner then coalesce((select jsonb_agg(z) from(select * from public.promoter_audit where target is null or subject=target order by id desc limit 100 offset skip)z),'[]') else '[]'::jsonb end,
 'page',page
 ) into data;return data;
end$$;
-- All private tables are accessed via these scoped RPCs; no browser table grants or anonymous private reads.
do $$declare f record;begin
 for f in select p.oid::regprocedure as signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'promoter_%' loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 if f.proname in('promoter_program_info','promoter_link_info') then execute format('grant execute on function %s to anon,authenticated',f.signature);
 elsif f.proname in('promoter_apply','promoter_review','promoter_set_rates','promoter_accept_rates','promoter_set_enabled','promoter_resolve_financial_review','promoter_close_event','promoter_cancel_event','promoter_reconcile_event','promoter_record_payment','promoter_update_pix','promoter_dashboard') then execute format('grant execute on function %s to authenticated',f.signature);end if;
 end loop;
end$$;
notify pgrst,'reload schema';
commit;
