import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'
import {randomUUID} from 'node:crypto'
const files=['001_platform.sql','002_production.sql','003_order_history_global_coupons.sql','004_preservation_reservation_limits.sql','008_event_platform_fee_and_safe_delete.sql','009_payment_fees_payouts.sql','010_owner_only_platform_fee.sql','011_self_service_organizers_and_account_admin.sql','011_inline_payment_attempts.sql','012_verified_inline_payments.sql','013_experience_participants_vip.sql','014_atomic_inline_payments.sql','015_event_checkin_team.sql','016_pending_checkin_team.sql','017_legal_documents_acceptances.sql','018_archive_test_sales.sql','019_publish_approved_legal.sql','020_promoter_program.sql']
const cpfFor=n=>{let s=String(n).padStart(9,'0');for(let len=9;len<11;len++){let sum=0;for(let i=0;i<len;i++)sum+=Number(s[i])*(len+1-i);const d=11-sum%11;s+=d>=10?0:d}return s}
test('promoter program: actual PostgreSQL permissions, attribution and financial journal',async t=>{
 const db=new PGlite();const admin=randomUUID(),dj=randomUUID(),other=randomUUID();
 const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0]
 const root=()=>db.exec('reset role')
 const as=async(id,role='authenticated')=>{await root();await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+role)}
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',email_confirmed_at timestamptz,is_anonymous boolean default false,created_at timestamptz default now());
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`)
 for(const file of files){try{await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'))}catch(e){throw Error(file+': '+e.message+' position '+e.position,{cause:undefined})};if(file==='016_pending_checkin_team.sql'){
 for(const [id,email,role] of [[admin,'ingressosaltatemporada@gmail.com','admin'],[dj,'dj@example.test','cliente'],[other,'notowner@example.test','admin']]){await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id,email]);await db.query('update public.profiles set role=$1 where id=$2',[role,id])}
 }}
 const claims=(await db.query("select slug,version,content_hash as hash,true as accepted from public.legal_documents where version='2026-10-10.3' and published")).rows
 await t.test('disabled by default; private tables and owner mutations are protected',async()=>{
 await as(null,'anon');assert.equal((await scalar('select public.promoter_program_info()')).enabled,false)
 await assert.rejects(db.query('select * from public.promoter_profiles'),/permission denied/)
 await assert.rejects(db.query('select public.promoter_dashboard()'),/permission denied/)
 await as(other);await assert.rejects(db.query("select public.promoter_set_enabled(true,'Teste autorizado local')"),/Exclusivo/)
 await as(dj);await assert.rejects(db.query('select public.promoter_apply($1,$2,$3,$4,$5,$6,$7)',['DJ Teste','45999999999','email','dj@example.test','DJ Teste',claims,randomUUID()]),/não ativado/)
 await as(admin);await db.query("select public.promoter_set_enabled(true,'Ativação somente no teste local')")
 })
 const version=await scalar('select default_rate_version from public.promoter_settings') .catch(async()=>{await root();return scalar('select default_rate_version from public.promoter_settings')})
 let token,org,organizer;
 await t.test('enrollment requires current legal consent and rate version; only owner approves',async()=>{
 await as(dj);await assert.rejects(db.query('select public.promoter_apply($1,$2,$3,$4,$5,$6,$7)',['DJ Teste','45999999999','email','dj@example.test','DJ Teste',[],version]),/Aceite/)
 await db.query('select public.promoter_apply($1,$2,$3,$4,$5,$6,$7)',['DJ Teste','45999999999','email','dj@example.test','DJ Teste',claims.filter(c=>c.slug==='promotores'),version])
 await assert.rejects(db.query("select public.promoter_review($1,'approved','Aprovação indevida teste')",[dj]),/Exclusivo/)
 await assert.rejects(db.query('select public.promoter_dashboard($1)',[admin]),/Sem acesso/)
 await as(admin);await db.query("select public.promoter_review($1,'approved','Dados conferidos em teste local')",[dj]);await as(dj);token=(await scalar('select public.promoter_dashboard()')).profile.link_token;assert.match(token,/^[a-f0-9]{64}$/)
 await assert.rejects(db.query("update public.promoter_profiles set status='approved'"),/permission denied/)
 })
 const signup=async(email,cpf,link=token)=>{await root();const id=randomUUID();await db.query('insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),$3)',[id,email,{name:'Novo Organizador',cpf,promoterReferral:link,legalAcceptances:claims.filter(c=>['termos','privacidade'].includes(c.slug))}]);return id}
 await t.test('new signup captures referral permanently; invalid links, self-referrals and duplicate identity rejected',async()=>{
 organizer=await signup('org@example.test',cpfFor(123456789));
 await assert.rejects(signup('duplicate@example.test',cpfFor(123456789)),/Identidade|unique/)
 await assert.rejects(signup('invalid@example.test',cpfFor(987654321),'a'.repeat(64)),/inválida/)
 await assert.rejects(signup('dj@example.test',cpfFor(987654322)),/autoindicação/)
 await root();await db.query("update auth.users set raw_user_meta_data=raw_user_meta_data||'{\"promoterReferral\":\"forged\"}' where id=$1",[organizer]);assert.equal(await scalar('select promoter_id from public.promoter_signup_captures where user_id=$1',[organizer]),dj)
 await as(organizer);await db.query('select public.accept_legal_documents($1,\'organizer.onboarding\')',[claims.filter(c=>c.slug==='organizadores')]);org=await scalar("select public.become_organizer('Organização indicada')")
 await root();assert.equal(await scalar('select promoter_id from public.promoter_referrals where organization_id=$1',[org]),dj)
 await assert.rejects(db.query('delete from public.promoter_referrals'),/imutável/)
 })
 const eventFixture=async({net=10000,status='approved',review=false,provider=true,date='2026-01-01'}={})=>{
 await root();const event=randomUUID(),batch=randomUUID(),order=randomUUID(),payment=randomUUID();
 await db.query("insert into public.events(id,organization_id,slug,title,details,created_at) values($1,$2,$3,'Evento teste',$4,now())",[event,org,event,{date}]);
 await db.query("insert into public.ticket_types(id,event_id,name,capacity,price_cents) values($1,$2,'Pista',10,10000)",[batch,event]);
 await db.query("insert into public.orders(id,user_id,event_id,ticket_type_id,quantity,status,total_cents,buyer,idempotency_key,fee_cents,provider_fee_cents,payment_id,payment_review) values($1,$2,$3,$4,1,$5,20000,'{}',$6,$7,1000,$8,$9)",[order,organizer,event,batch,status,randomUUID(),net,provider?payment:null,review]);
 if(provider)await db.query("insert into public.payments(order_id,provider,provider_id,status,amount_cents) values($1,'mercadopago',$2,'approved',20000)",[order,payment]);return {event,order,payment}
 }
 const close=async event=>{await as(admin);return scalar("select public.promoter_close_event($1,now(),'Evento realizado e extrato financeiro conciliado no teste')",[event])}
 const eligible=[]
 await t.test('5% for first 15 eligible events and 4% for event 16; duplicate closing blocked',async()=>{
 for(let i=1;i<=16;i++){const f=await eventFixture();eligible.push(f);const result=await close(f.event);assert.equal(result.ordinal,i);assert.equal(result.rateBps,i<=15?500:400);assert.equal(result.amountCents,i<=15?500:400)}
 await assert.rejects(close(eligible[0].event),/já fechado/)
 })
 await t.test('future, zero, unverified and review events cannot release commissions',async()=>{
 for(const options of [{net:0},{provider:false},{review:true},{date:'2099-01-01'},{date:'1 de janeiro de 2099'}]){const f=await eventFixture(options);await assert.rejects(close(f.event),/elegível|conciliação|realizado/)}
 await as(dj);await assert.rejects(db.query("select public.promoter_close_event($1,now(),'Tentativa sem permissão')",[eligible[0].event]),/Exclusivo/)
 })
 await t.test('configuration changes require owner and promoter consent; old referrals and closures are preserved',async()=>{
 await as(other);await assert.rejects(db.query("select public.promoter_set_rates($1,700,300,'Condição individual no teste')",[dj]),/Exclusivo/)
 await as(admin);const next=await scalar("select public.promoter_set_rates($1,700,300,'Condição individual no teste')",[dj]);await as(dj);let dash=await scalar('select public.promoter_dashboard()');assert.equal(dash.profile.rate_version,version);await db.query('select public.promoter_accept_rates($1)',[next]);
 const f=await eventFixture();assert.equal((await close(f.event)).rateBps,400);await root();assert.equal(await scalar('select rate_version from public.promoter_referrals where organization_id=$1',[org]),version)
 await assert.rejects(db.exec('update public.promoter_rate_versions set first_rate_bps=1'),/imutável/)
 })
 await t.test('manual Pix registration: owner only, bounded balance, idempotent, no real transfer',async()=>{
 const request=randomUUID();await as(dj);await assert.rejects(db.query("select public.promoter_record_payment($1,100,'PIX-TEST-001',now(),$2,'Comprovante sintético sem transferência')",[dj,request]),/Exclusivo/)
 await as(admin);await assert.rejects(db.query("select public.promoter_record_payment($1,99999999,'PIX-TEST-HIGH',now(),$2,'Comprovante sintético sem transferência')",[dj,request]),/saldo/)
 const id=await scalar("select public.promoter_record_payment($1,100,'PIX-TEST-001',now(),$2,'Comprovante sintético sem transferência')",[dj,request]);assert.equal(await scalar("select public.promoter_record_payment($1,100,'PIX-TEST-001',now(),$2,'Comprovante sintético sem transferência')",[dj,request]),id)
 await assert.rejects(db.query("select public.promoter_record_payment($1,101,'PIX-TEST-001',now(),$2,'Comprovante sintético sem transferência')",[dj,request]),/divergente/)
 })
 await t.test('refund drift blocks payout; reconciliation appends negative entry and preserves originals',async()=>{
 const f=eligible[0];await root();await db.query("update public.orders set status='refunded' where id=$1",[f.order]);await db.query("update public.payments set status='refunded' where order_id=$1",[f.order]);
 await as(admin);await assert.rejects(db.query("select public.promoter_record_payment($1,100,'PIX-TEST-DRIFT',now(),$2,'Comprovante sintético sem transferência')",[dj,randomUUID()]),/Reconcilie/)
 assert.equal(await scalar("select public.promoter_reconcile_event($1,'Estorno integral conciliado conforme extrato de teste')",[f.event]),-500)
 assert.equal(await scalar("select public.promoter_reconcile_event($1,'Repetição segura da conciliação do teste')",[f.event]),0)
 await root();assert.equal(await scalar('select count(*)::integer from public.promoter_commission_entries where event_id=$1',[f.event]),2);assert.equal(await scalar('select total_commission_cents from public.promoter_commission_entries where event_id=$1 and revision=1',[f.event]),500)
 await assert.rejects(db.query('delete from public.promoter_commission_entries'),/imutável/)
 })
 await t.test('cancellation zeroes eligibility through append-only adjustment; DJ sees own totals without buyer data',async()=>{
 await as(admin);await db.query("select public.promoter_cancel_event($1,'Cancelamento documentado exclusivamente no teste')",[eligible[1].event]);assert.equal(await scalar("select public.promoter_reconcile_event($1,'Cancelamento e conciliação financeira no teste')",[eligible[1].event]),-500)
 await as(dj);const dash=await scalar('select public.promoter_dashboard()');assert.ok(dash.balanceCents>0);assert.equal(dash.promoters.length,0);assert.equal(dash.audit.length,0);assert.ok(!JSON.stringify(dash).includes('buyer'));assert.ok(dash.events.length>=16)
 await as(other);await assert.rejects(db.query('select public.promoter_dashboard($1)',[dj]),/Sem acesso/)
 })

 await t.test('4% remains permanent after reversals; each organizer has an independent tier',async()=>{
 const f=await eventFixture();const closure=await close(f.event);assert.equal(closure.rateBps,400);assert.ok(closure.ordinal>=18)
 const second=await signup('org-second@example.test',cpfFor(987654321));await as(second);await db.query('select public.accept_legal_documents($1,\'organizer.onboarding\')',[claims.filter(c=>c.slug==='organizadores')]);const secondOrg=await scalar("select public.become_organizer('Segunda organização indicada')");const firstOrg=org;org=secondOrg;const event=await eventFixture();const c=await close(event.event);assert.equal(c.ordinal,1);assert.equal(c.rateBps,700);org=firstOrg
 })
 await t.test('partial refunds require documented owner reconciliation and cannot inflate received fees',async()=>{
 const f=eligible[2];await root();await db.query('update public.orders set payment_review=true where id=$1',[f.order]);await as(dj);await assert.rejects(db.query("select public.promoter_resolve_financial_review($1,8000,'EXTRATO-TEST-PARTIAL','Conferência de estorno parcial sintético')",[f.event]),/Exclusivo/)
 await as(admin);await assert.rejects(db.query("select public.promoter_resolve_financial_review($1,20000,'EXTRATO-TEST-PARTIAL','Conferência de estorno parcial sintético')",[f.event]),/superior/)
 await db.query("select public.promoter_resolve_financial_review($1,8000,'EXTRATO-TEST-PARTIAL','Conferência de estorno parcial sintético')",[f.event]);assert.equal(await scalar("select public.promoter_reconcile_event($1,'Reconciliação após conferência documental sintética')",[f.event]),-100)
 await root();assert.equal(await scalar('select payment_review from public.orders where id=$1',[f.order]),true)
 await assert.rejects(db.exec('delete from public.promoter_financial_resolutions'),/imutável/)
 })
 await t.test('old accounts cannot acquire attribution by metadata; suspended links reject new users and obligations survive',async()=>{
 await root();await db.query('update auth.users set raw_user_meta_data=raw_user_meta_data||$1::jsonb where id=$2',[{promoterReferral:token},other]);assert.equal(await scalar('select count(*)::integer from public.promoter_signup_captures where user_id=$1',[other]),0)
 await as(admin);await db.query("select public.promoter_review($1,'suspended','Suspensão para testar novas indicações')",[dj]);await as(null,'anon');assert.equal(await scalar('select public.promoter_link_info($1)',[token]),null)
 await assert.rejects(signup('suspended-link@example.test',cpfFor(987654323)),/inválida/)
 const f=await eventFixture();assert.equal((await close(f.event)).rateBps,400)
 await as(admin);await db.query("select public.promoter_review($1,'approved','Reaprovação de dados no teste local')",[dj]);await db.query("select public.promoter_set_enabled(false,'Programa desativado ao final do teste')");await assert.rejects(signup('disabled-link@example.test',cpfFor(987654324)),/indisponível/)
 assert.equal((await close((await eventFixture()).event)).rateBps,400)
 })
 await t.test('duplicate calls and references never duplicate money; rounding is in cents',async()=>{
 const f=await eventFixture({net:101});const result=await close(f.event);assert.equal(result.amountCents,4)
 const another=await eventFixture();await as(admin);const outcomes=await Promise.allSettled([db.query("select public.promoter_close_event($1,now(),'Fechamento repetido em duas requisições sintéticas')",[another.event]),db.query("select public.promoter_close_event($1,now(),'Fechamento repetido em duas requisições sintéticas')",[another.event])]);assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1)
 await assert.rejects(db.query("select public.promoter_record_payment($1,100,'PIX-TEST-001',now(),$2,'Referência repetida em nova requisição sintética')",[dj,randomUUID()]),/unique/)
 })
 }finally{await db.close()}
})
