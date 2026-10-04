import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const ids={admin:'10000000-0000-4000-8000-000000000001',client:'10000000-0000-4000-8000-000000000002',other:'10000000-0000-4000-8000-000000000003',organizer:'10000000-0000-4000-8000-000000000004',finance:'10000000-0000-4000-8000-000000000005',checkin:'10000000-0000-4000-8000-000000000006',outsider:'10000000-0000-4000-8000-000000000007'}
const org='20000000-0000-4000-8000-000000000001',org2='20000000-0000-4000-8000-000000000002'
const event='30000000-0000-4000-8000-000000000001',batch='40000000-0000-4000-8000-000000000001'
const buyer={name:'Cliente Teste',cpf:'52998224725',phone:'41999999999',birthDate:'2000-01-01',email:'ignored@example.test'}
test('PostgreSQL migrations, real RLS, stock, coupons, issuance and atomic check-in',async t=>{
 const db=new PGlite()
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',email_confirmed_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`)
 for(const file of ['001_platform.sql','002_production.sql','003_order_history_global_coupons.sql','004_preservation_reservation_limits.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'))
 const as=async role=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ids[role]||'']);await db.exec(role==='anon'?'set role anon':'set role authenticated')}
 const root=()=>db.exec('reset role')
 const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0]
 for(const [role,id] of Object.entries(ids))await db.query('insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),$3)',[id,role==='admin'?'medquest41@gmail.com':role+'@example.test',{name:role,role:'admin'}])
 assert.equal(await scalar('select count(*)::integer from public.profiles where role=\'admin\''),0,'signup metadata cannot promote')
 await db.query('insert into public.organizations(id,name) values($1,\'Empresa A\'),($2,\'Empresa B\')',[org,org2])
 await db.query("update public.profiles set role='admin' where id=$1",[ids.admin])
 for(const [user,role] of [['organizer','organizador'],['finance','financeiro'],['checkin','checkin'],['outsider','organizador']])await db.query('update public.profiles set role=$1,organization_id=$2 where id=$3',[role,user==='outsider'?org2:org,ids[user]])
 const payload={id:event,legacyId:'local-1',title:'Evento Teste',slug:'evento-teste',organizerId:org,published:true,archived:false,feeRate:0.1,ticketTypes:[{id:batch,name:'Pista',description:'Descrição aprovada',legacyId:'pista-antiga',available:2,price:0,type:'individual'}]}
 await as('admin');await db.query('select public.save_event($1)',[payload])
 assert.equal(await scalar("select legacy_id from public.events where id=$1",[event]),'local-1')
 assert.equal(await scalar("select details->>'description' from public.ticket_types where id=$1",[batch]),'Descrição aprovada')
 await t.test('anonymous published catalog and denied private tables',async()=>{
  await as('anon');assert.equal(await scalar('select count(*)::integer from public.events'),1)
  await assert.rejects(db.query('select * from public.orders'),/permission denied/)
  await assert.rejects(db.query('select public.create_order($1,1,$2,\'\',$3,null,null)',[batch,buyer,crypto.randomUUID()]),/permission denied/)
 })
 await t.test('RLS and grants deny role escalation and cross-organization event writes',async()=>{
  await as('client');assert.equal(await scalar('select count(*)::integer from public.profiles'),1)
  await assert.rejects(db.query("update public.profiles set role='admin'"),/permission denied/)
  await assert.rejects(db.query('select public.set_member($1,\'admin\',null,true)',[ids.client]),/Sem permissão/)
  await as('outsider');await assert.rejects(db.query('select public.save_event($1)',[payload]),/Sem permissão/)
 })
 let order,code
 await t.test('free checkout issues random QR, ignores buyer email and is idempotent',async()=>{
  await as('client');const request=crypto.randomUUID()
  order=await scalar('select public.create_order($1,1,$2,\'\',$3,\'instagram\',\'lancamento\')',[batch,buyer,request])
  assert.equal(await scalar('select public.create_order($1,1,$2,\'\',$3,null,null)',[batch,buyer,request]),order)
  code=await scalar('select code from public.tickets where order_id=$1',[order]);assert.match(code,/^[0-9a-f-]{36}$/)
  assert.equal(await scalar("select buyer->>'email' from public.orders where id=$1",[order]),'client@example.test')
  assert.equal(await scalar('select public.batch_remaining($1)',[batch]),1)
  await assert.rejects(db.query('select public.create_order($1,2,$2,\'\',$3,null,null)',[batch,buyer,request]),/incompatível/)
 })
 await t.test('client isolation and finance receives no buyer data or QR',async()=>{
  await as('other');assert.equal(await scalar('select count(*)::integer from public.orders'),0);assert.equal(await scalar('select count(*)::integer from public.tickets'),0)
  await as('finance');assert.equal(await scalar('select count(*)::integer from public.orders'),0)
  const sales=await scalar('select public.finance_orders()');assert.equal(sales.length,1);assert.deepEqual(sales[0].buyer,{});assert.deepEqual(sales[0].tickets,[])
  await as('outsider');assert.deepEqual(await scalar('select public.finance_orders()'),[])
 })
 await t.test('overselling and invalid CPF rejected; cancel restores stock',async()=>{
  await as('client');await assert.rejects(db.query('select public.create_order($1,2,$2,\'\',$3,null,null)',[batch,buyer,crypto.randomUUID()]),/Estoque/)
  await assert.rejects(db.query('select public.create_order($1,1,$2,\'\',$3,null,null)',[batch,{...buyer,cpf:'11111111111'},crypto.randomUUID()]),/CPF/)
  const second=await scalar('select public.create_order($1,1,$2,\'\',$3,null,null)',[batch,buyer,crypto.randomUUID()])
  assert.equal(await scalar('select public.batch_remaining($1)',[batch]),0)
  await as('admin');await db.query('select public.cancel_order($1)',[second]);assert.equal(await scalar('select public.batch_remaining($1)',[batch]),1)
  const cancelled=await scalar('select code from public.tickets where order_id=$1',[second]);assert.equal(await scalar('select public.check_in($1)',[cancelled]),'cancelled')
 })
 await t.test('check-in requires assignment and rejects reuse; used tickets cannot cancel',async()=>{
  await as('checkin');assert.equal(await scalar('select public.check_in($1)',[code]),'forbidden')
  await as('admin');await db.query('select public.assign_checkin($1,$2,true)',[ids.checkin,event])
  await as('checkin');assert.equal(await scalar('select public.check_in($1)',[code]),'valid');assert.equal(await scalar('select public.check_in($1)',[code]),'used')
  assert.equal(await scalar('select count(*)::integer from public.checkins'),1)
  await as('admin');await assert.rejects(db.query('select public.cancel_order($1)',[order]),/utilizado/)
 })
 const paidBatch='40000000-0000-4000-8000-000000000002'
 await t.test('pending paid orders reserve stock without tickets; coupon limits include reservations',async()=>{
  await as('admin');await db.query('select public.save_event($1)',[{...payload,ticketTypes:[...payload.ticketTypes,{id:paidBatch,name:'VIP',available:10,price:100,type:'individual'}]}])
  await db.query('select public.save_coupon($1)',[{eventId:event,code:'PROMO',type:'percent',value:20,limit:2,perUserLimit:1}])
  await as('client');const q=await scalar('select public.quote_order($1,1,\'PROMO\')',[paidBatch]);assert.equal(q.total,88)
  const pending=await scalar('select public.create_order($1,1,$2,\'PROMO\',$3,null,null)',[paidBatch,buyer,crypto.randomUUID()])
  assert.equal(await scalar('select status from public.orders where id=$1',[pending]),'pending')
  assert.equal(await scalar('select count(*)::integer from public.tickets where order_id=$1',[pending]),0)
  await assert.rejects(db.query('select public.quote_order($1,1,\'PROMO\')',[paidBatch]),/Limite/)
  await assert.rejects(db.query('select public.settle_payment($1,\'123\',8800,\'BRL\')',[pending]),/permission denied/)
  await db.query('select public.cancel_order($1)',[pending]);assert.equal((await scalar('select public.quote_order($1,1,\'PROMO\')',[paidBatch])).total,88)
 })
 await t.test('global coupons require admin and order history is private',async()=>{
  await as('client');assert.equal(await scalar('select count(*)::integer from public.order_status_history where order_id=$1',[order]),1)
  await as('other');assert.equal(await scalar('select count(*)::integer from public.order_status_history'),0)
  await as('organizer');await assert.rejects(db.query('select public.save_coupon($1)',[{eventId:'',code:'GLOBAL',type:'fixed',value:10}]),/Sem permissão/)
  await as('admin');await db.query('select public.save_coupon($1)',[{eventId:'',code:'GLOBAL',type:'fixed',value:10}])
  await as('client');assert.equal((await scalar('select public.quote_order($1,1,\'GLOBAL\')',[paidBatch])).total,99)
 })
 await t.test('active reservation cap cannot be bypassed by fresh request IDs',async()=>{
  await as('client');const pending=[]
  for(let i=0;i<5;i++)pending.push(await scalar('select public.create_order($1,1,$2,\'\',$3,null,null)',[paidBatch,buyer,crypto.randomUUID()]))
  await assert.rejects(db.query('select public.create_order($1,1,$2,\'\',$3,null,null)',[paidBatch,buyer,crypto.randomUUID()]),/Limite de reservas/)
  for(const id of pending)await db.query('select public.cancel_order($1)',[id])
 })
 await t.test('hidden events cannot leak through preview or public inventory',async()=>{
  await as('admin');await db.query('select public.save_event($1)',[{...payload,published:false,ticketTypes:[...payload.ticketTypes,{id:paidBatch,name:'VIP',available:10,price:100,type:'individual'}]}])
  await as('anon');assert.equal(await scalar('select count(*)::integer from public.events'),0);assert.equal(await scalar('select count(*)::integer from public.ticket_types'),0);assert.equal(await scalar('select public.batch_remaining($1)',[batch]),null)
  await as('organizer');assert.equal(await scalar('select count(*)::integer from public.events'),1)
 })
 await root()
 }finally{await db.close()}
})
