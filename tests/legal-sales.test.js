import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'
import {createHash} from 'node:crypto'
const admin='10000000-0000-4000-8000-000000000001',client='10000000-0000-4000-8000-000000000002',other='10000000-0000-4000-8000-000000000003'
const org='20000000-0000-4000-8000-000000000001',event='30000000-0000-4000-8000-000000000001',batch='40000000-0000-4000-8000-000000000001'
test('legal version hashes match the exact saved content',async()=>{
 const docs=JSON.parse(await readFile(new URL('../src/legal/documents.json',import.meta.url),'utf8'))
 assert.equal(Object.keys(docs).length,6)
 for(const d of Object.values(docs)){assert.equal(createHash('sha256').update(d.canonical).digest('hex'),d.hash);assert.deepEqual(JSON.parse(d.canonical),d.content);assert.ok(d.content.sections.length>=8)}
})
test('legal evidence and sales cleanup enforce real database permissions',async t=>{
 const db=new PGlite()
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',email_confirmed_at timestamptz,is_anonymous boolean default false);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`)
 for(const file of ['001_platform.sql','002_production.sql','003_order_history_global_coupons.sql','004_preservation_reservation_limits.sql','008_event_platform_fee_and_safe_delete.sql','009_payment_fees_payouts.sql','010_owner_only_platform_fee.sql','011_self_service_organizers_and_account_admin.sql','011_inline_payment_attempts.sql','012_verified_inline_payments.sql','013_experience_participants_vip.sql','014_atomic_inline_payments.sql','015_event_checkin_team.sql','016_pending_checkin_team.sql','017_legal_documents_acceptances.sql','018_archive_test_sales.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'))
 const root=()=>db.exec('reset role')
 const as=async(id,role='authenticated')=>{await root();await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+role)}
 const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0]
 for(const [id,email] of [[admin,'ingressosaltatemporada@gmail.com'],[client,'client@example.test'],[other,'other@example.test']])await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id,email])
 await db.query("update public.profiles set role='admin' where id=$1",[admin]);await db.query('insert into public.organizations(id,name) values($1,\'Teste\')',[org])
 await as(admin);await db.query('select public.save_event($1)',[{id:event,title:'Evento preservado',slug:'teste-juridico',organizerId:org,published:true,archived:false,feeRate:0.1,description:'Descrição preservada',attractions:[{name:'DJ preservado'}],ticketTypes:[{id:batch,name:'Pista',price:0,available:10,type:'individual'}]}])
 await root()
 const claims=[]
 for(const slug of ['termos','privacidade','organizadores','promotores']){
  const content=JSON.stringify({title:slug,version:'reviewed-1',status:'approved',sections:[]})
  await db.query('insert into public.legal_documents(slug,version,content,published) values($1,\'reviewed-1\',$2,true)',[slug,content])
  const hash=await scalar('select content_hash from public.legal_documents where slug=$1 and version=\'reviewed-1\'',[slug]);claims.push({slug,version:'reviewed-1',hash,accepted:true})
 }
 await db.query("update public.legal_config set company=company||$1::jsonb,active_versions=$2,enforce_signup=true",[{reviewed:true,legalName:'Empresa de teste',address:'Endereço de teste'},{termos:'reviewed-1',privacidade:'reviewed-1',organizadores:'reviewed-1',promotores:'reviewed-1'}])
 const newcomer='10000000-0000-4000-8000-000000000099'
 await t.test('signup blocked without acceptance; valid acceptance and optional marketing false succeed',async()=>{
  await assert.rejects(db.query('insert into auth.users(id,email) values($1,\'new@example.test\')',[newcomer]),/Aceite obrigatório/)
  await assert.rejects(db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,\'new@example.test\',$2)',[newcomer,{legalAcceptances:claims.map(c=>({...c,hash:'forged'}))}]),/desatualizada/)
  await db.query('insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at) values($1,\'new@example.test\',$2,now())',[newcomer,{legalAcceptances:claims.slice(0,2),marketing:false}])
  assert.equal(await scalar('select count(*)::integer from public.legal_acceptances where user_id=$1',[newcomer]),2)
  assert.equal(await scalar('select enabled from public.marketing_preferences where user_id=$1',[newcomer]),false)
  assert.equal(await scalar("select bool_and(accepted_at is not null and origin='account.signup') from public.legal_acceptances where user_id=$1",[newcomer]),true)
  await assert.rejects(db.exec("update public.legal_documents set content='changed'"),/imutável/)
  await assert.rejects(db.exec('delete from public.legal_acceptances'),/imutável/)
 })
 await t.test('RLS isolates legal history and marketing withdrawal appends evidence',async()=>{
  await as(other);assert.equal(await scalar('select count(*)::integer from public.legal_acceptances'),0)
  await assert.rejects(db.exec("insert into public.legal_acceptances(user_id,slug,version,content_hash,origin) values('"+other+"','termos','reviewed-1','forged','fake')"),/permission denied/)
  await as(newcomer);await db.query('select public.set_marketing_consent(true)');await db.query('select public.set_marketing_consent(false)');assert.equal(await scalar('select count(*)::integer from public.marketing_preferences'),3)
  await as(admin);assert.equal(await scalar('select count(*)::integer from public.legal_acceptances'),2)
  await as(null,'anon');await assert.rejects(db.exec('select * from public.legal_acceptances'),/permission denied/)
 })
 await t.test('promoter terms required, reacceptance retains history, no link enabled',async()=>{
  await as(newcomer);await assert.rejects(db.query('select public.accept_legal_documents($1,\'promoter.application\')',[[]]),/Aceite obrigatório/)
  await db.query('select public.accept_legal_documents($1,\'promoter.application\')',[claims]);assert.equal(await scalar('select status from public.promoter_applications'),'pending')
  await root();const content='{"title":"v2"}';await db.query("insert into public.legal_documents(slug,version,content,published) values('promotores','reviewed-2',$1,true)",[content]);await db.exec("update public.legal_config set active_versions=jsonb_set(active_versions,'{promotores}','\"reviewed-2\"')");const hash=await scalar("select content_hash from public.legal_documents where slug='promotores' and version='reviewed-2'")
  await as(newcomer);await assert.rejects(db.query('select public.accept_legal_documents($1,\'promoter.application\')',[claims]),/desatualizada/);await db.query('select public.accept_legal_documents($1,\'promoter.application\')',[[{slug:'promotores',version:'reviewed-2',hash,accepted:true}]]);assert.equal(await scalar("select count(*)::integer from public.legal_acceptances where slug='promotores'"),2)
 })
 let order
 const buyer={name:'Cliente Teste',cpf:'52998224725',phone:'41999999999',birthDate:'2000-01-01'}
 await t.test('cleanup password endpoint RPC cannot be called by browser roles',async()=>{
  await as(client);order=await scalar('select public.create_order($1,1,$2,\'\',$3,null,null)',[batch,buyer,crypto.randomUUID()])
  await as(admin);await assert.rejects(db.query('select public.archive_test_sales($1,$2,$3,$4)',[admin,event,[order],'LIMPAR VENDAS DE TESTE']),/permission denied/)
 })
 await t.test('archive removes free tests from stock and finance without changing event, attractions or payment records',async()=>{
  await root();const before=await scalar('select to_jsonb(e) from public.events e where id=$1',[event]);assert.equal(await scalar('select public.batch_remaining($1)',[batch]),9)
  await as(admin,'service_role');await assert.rejects(db.query('select public.archive_test_sales($1,$2,$3,$4)',[other,event,[order],'LIMPAR VENDAS DE TESTE']),/Admin Geral/)
  await assert.rejects(db.query('select public.archive_test_sales($1,$2,$3,$4)',[admin,event,[order],'wrong']),/Confirmação/)
  assert.equal(await scalar('select public.archive_test_sales($1,$2,$3,$4)',[admin,event,[order],'LIMPAR VENDAS DE TESTE']),1)
  await root();assert.deepEqual(await scalar('select to_jsonb(e) from public.events e where id=$1',[event]),before);assert.equal(await scalar('select count(*)::integer from public.orders'),1);assert.equal(await scalar('select cancelled from public.tickets where order_id=$1',[order]),true);assert.equal(await scalar('select public.batch_remaining($1)',[batch]),10)
  await as(admin);assert.deepEqual(await scalar('select public.finance_orders()'),[]);assert.equal(await scalar('select count(*)::integer from public.sales_cleanup_log'),1)
  await as(client);assert.equal(await scalar('select count(*)::integer from public.sales_cleanup_log'),0)
 })
 await t.test('approved real payments and active payment attempts are blocked atomically',async()=>{
  await root();await db.query('update public.ticket_types set price_cents=1000 where id=$1',[batch]);await as(client);const paid=await scalar('select public.create_order($1,1,$2,\'\',$3,null,null)',[batch,buyer,crypto.randomUUID()]);await root();await db.query("update public.orders set status='approved' where id=$1",[paid]);await as(admin,'service_role');await assert.rejects(db.query('select public.archive_test_sales($1,$2,$3,$4)',[admin,event,[paid],'LIMPAR VENDAS DE TESTE']),/pagamento/)
  await root();await db.query("update public.orders set status='pending' where id=$1",[paid]);await db.query("insert into public.inline_payment_attempts(order_id,method,status) values($1,'pix','creating')",[paid]);await as(admin,'service_role');await assert.rejects(db.query('select public.archive_test_sales($1,$2,$3,$4)',[admin,event,[paid],'LIMPAR VENDAS DE TESTE']),/cobrança/);await root();assert.equal(await scalar('select test_archived_at from public.orders where id=$1',[paid]),null)
 })
 }finally{await db.close()}
})
