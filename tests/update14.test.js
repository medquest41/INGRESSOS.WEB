import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHmac } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { paymentHandlers } from '../server/payment-handlers.mjs'
import { orderPaymentStatus } from '../server/inline-payment.mjs'

test('order status never presents a provider approval as confirmed before settlement',()=>{
 const order={status:'pending',expires_at:new Date(Date.now()+60000).toISOString(),payment_status:'approved'}
 assert.equal(orderPaymentStatus(order),'confirming')
 assert.equal(orderPaymentStatus({...order,status:'cancelled'}),'cancelled')
 assert.equal(orderPaymentStatus({...order,status:'approved',payment_review:true}),'review')
 assert.equal(orderPaymentStatus(order,Date.now()+120000),'expired')
})

test('signed webhooks reconcile non-approved statuses and propagate failures for retry',async()=>{
 const secret='synthetic',requestId='synthetic-request',ts=String(Math.floor(Date.now()/1000))
 const signature='ts='+ts+',v1='+createHmac('sha256',secret).update(`id:123;request-id:${requestId};ts:${ts};`).digest('hex')
 let seen
 const config={enabled:true,accessToken:'synthetic',webhookSecret:secret,collectorId:'42',fetchPayment:async()=>({id:123,collector_id:42,currency_id:'BRL',live_mode:true,status:'rejected'}),reconcilePayment:async p=>{seen=p.status}}
 const notice={signature,requestId,dataId:'123'}
 assert.deepEqual(await paymentHandlers(config).webhook(notice),{received:true})
 assert.equal(seen,'rejected')
 await assert.rejects(paymentHandlers({...config,reconcilePayment:async()=>{throw new Error('retry')}}).webhook(notice),/retry/)
})

test('Atualizacao 14: verified attempts, history, expiry, approval replay and least privilege',async()=>{
 const db=new PGlite()
 const buyer='10000000-0000-4000-8000-000000000001',event='20000000-0000-4000-8000-000000000001',batch='30000000-0000-4000-8000-000000000001'
 const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0]
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
   create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',email_confirmed_at timestamptz);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth,public to anon,authenticated,service_role;`)
  for(const file of ['001_platform.sql','002_production.sql','003_order_history_global_coupons.sql','004_preservation_reservation_limits.sql','005_primary_admin_email.sql','008_event_platform_fee_and_safe_delete.sql','009_payment_fees_payouts.sql','010_owner_only_platform_fee.sql','011_inline_payment_attempts.sql','011_self_service_organizers_and_account_admin.sql','012_verified_inline_payments.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'))
  await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[buyer,'synthetic@example.test'])
  const org=await scalar("insert into public.organizations(name) values('Teste') returning id")
  await db.query("insert into public.events(id,organization_id,slug,title,published) values($1,$2,'test','Teste',true)",[event,org])
  await db.query("insert into public.ticket_types(id,event_id,name,sector,batch,type,capacity,price_cents) values($1,$2,'Pista','Pista','1','individual',20,1000)",[batch,event])
  await db.exec("update public.settings set value='true'::jsonb where key='payments_enabled'")
  const makeOrder=async()=>{
   await db.query("select set_config('request.jwt.claim.sub',$1,false)",[buyer])
   return scalar("select public.create_order($1,1,$2,'',$3,null,null)",[batch,{name:'Cliente Teste',cpf:'52998224725',phone:'41999999999',birthDate:'2000-01-01'},crypto.randomUUID()])
  }
  const purchase=await makeOrder()
  const attempt=await scalar("select public.begin_inline_payment($1,$2,'pix')",[purchase,buyer])
  const total=await scalar('select total_cents from public.orders where id=$1',[purchase])
  const record=(id,key,status,stamp='2026-10-08T18:00:00Z',amount=total)=>scalar('select public.record_verified_inline_payment($1,$2,$3,$4,$5,$6,$7)',[purchase,id,key,status,amount,'pix',stamp])
  await assert.rejects(record('123',null,'pending'),/tentativa/)
  await assert.rejects(record('123',attempt.attempt_key,'approved',undefined,total-1),/incompatível/)
  assert.equal(await record('123',attempt.attempt_key,'pending'),'recorded')
  await assert.rejects(record('456',attempt.attempt_key,'approved'),/tentativa/)
  assert.equal(await record('123',attempt.attempt_key,'rejected','2026-10-08T18:01:00Z'),'recorded')
  assert.equal(await scalar('select payment_status from public.orders where id=$1',[purchase]),'rejected')
  const retry=await scalar("select public.begin_inline_payment($1,$2,'pix')",[purchase,buyer])
  assert.notEqual(retry.attempt_key,attempt.attempt_key)
  assert.equal(await scalar('select count(*)::int from public.inline_payment_history'),1)
  assert.equal(await record('456',retry.attempt_key,'approved','2026-10-08T18:02:00Z'),'recorded')
  await db.query("select public.settle_marketplace_payment($1,'456',$2,'BRL',10,'pix')",[purchase,total])
  await db.query("select public.settle_marketplace_payment($1,'456',$2,'BRL',10,'pix')",[purchase,total])
  assert.equal(await scalar('select count(*)::int from public.tickets where order_id=$1',[purchase]),1)
  assert.equal(await record('456',retry.attempt_key,'pending','2026-10-08T18:01:00Z'),'stale')
  assert.equal(await record('456',retry.attempt_key,'pending','2026-10-08T18:03:00Z'),'unchanged')
  assert.equal(await scalar('select status from public.orders where id=$1',[purchase]),'approved')
  assert.equal(await record('123',attempt.attempt_key,'approved'),'review')
  assert.equal(await scalar('select payment_review from public.orders where id=$1',[purchase]),true)
  await db.query("update public.profiles set role='admin' where id=$1",[buyer])
  const code=await scalar('select code from public.tickets where order_id=$1',[purchase])
  assert.equal(await scalar('select public.check_in($1)',[code]),'cancelled')
  const expired=await makeOrder()
  const expAttempt=await scalar("select public.begin_inline_payment($1,$2,'pix')",[expired,buyer])
  await db.query("update public.orders set expires_at=now()-interval '1 minute' where id=$1",[expired])
  const expTotal=await scalar('select total_cents from public.orders where id=$1',[expired])
  assert.equal(await scalar("select public.record_verified_inline_payment($1,'789',$2,'approved',$3,'pix',now())",[expired,expAttempt.attempt_key,expTotal]),'review')
  assert.equal(await scalar('select count(*)::int from public.tickets where order_id=$1',[expired]),0)
  const legacy=await makeOrder()
  await assert.rejects(db.query("select public.record_verified_inline_payment($1,'910',null,'approved',$2,'pix',now())",[legacy,expTotal]),/Tentativa/)
  await db.query("update public.orders set created_at=now()-interval '1 day' where id=$1",[legacy])
  assert.equal(await scalar("select public.record_verified_inline_payment($1,'910',null,'approved',$2,'pix',now())",[legacy,expTotal]),'recorded')
  await db.query("select public.settle_marketplace_payment($1,'910',$2,'BRL',10,'pix')",[legacy,expTotal])
  assert.equal(await scalar("select public.record_verified_inline_payment($1,'910',null,'refunded',$2,'pix',now())",[legacy,expTotal]),'recorded')
  await db.exec('set role authenticated')
  await assert.rejects(db.query('select * from public.inline_payment_history'),/permission denied/)
  await assert.rejects(record('456',retry.attempt_key,'approved'),/permission denied/)
 }finally{await db.close()}
})
