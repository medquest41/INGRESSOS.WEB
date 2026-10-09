import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'
import {createHmac} from 'node:crypto'
import {safePayment,paymentBody,publicPayment,createInlinePayment,orderPaymentStatus} from '../server/inline-payment.mjs'
import {recoverInlinePayment,reconciliationArgs} from '../server/payment-recovery.mjs'
import {paymentHandlers} from '../server/payment-handlers.mjs'
const order={id:crypto.randomUUID(),total_cents:1100,buyer:{name:'Cliente Teste',cpf:'52998224725',email:'buyer@example.test'},expires_at:new Date(Date.now()+32*60000).toISOString()}
const provider={id:123,collector_id:42,live_mode:true,currency_id:'BRL',external_reference:order.id,transaction_amount:11,status:'pending',payment_method_id:'pix',metadata:{attempt_key:crypto.randomUUID()}}

test('17: recover by exact attempt, safe environment, holder token and reversal states',async()=>{
 const fetchImpl=async()=>({ok:true,json:async()=>({results:[{...provider,id:456,metadata:{attempt_key:'other'}},provider],paging:{total:2}})})
 assert.equal(await recoverInlinePayment({orderId:order.id,attemptKey:provider.metadata.attempt_key,accessToken:'synthetic',fetchImpl}),'123')
 await assert.rejects(recoverInlinePayment({orderId:order.id,attemptKey:provider.metadata.attempt_key,fetchImpl:async()=>({ok:true,json:async()=>({results:[provider,provider]})})}),/revisão/)
 assert.throws(()=>safePayment({...provider,live_mode:false},order,42,'pix'))
 assert.doesNotThrow(()=>safePayment({...provider,live_mode:false},order,42,'pix',false))
 assert.throws(()=>safePayment(provider,order,42,'card'))
 const body=paymentBody(order,'card',{token:'synthetic-token',payment_method_id:'visa',installments:1,payer:{email:'holder@example.test',identification:{type:'CPF',number:'11144477735'},card_number:'never-forward'}},'https://example.test/webhook')
 assert.equal(body.payer.identification.number,'11144477735');assert.equal(body.payer.email,'holder@example.test');assert.equal(body.payer.card_number,undefined)
 assert.equal(publicPayment({...provider,status:'charged_back'},{...order,payment_review:true}).status,'charged_back')
 assert.equal(orderPaymentStatus({...order,status:'refunded',payment_review:true,payment_status:'refunded'}),'refunded')
 assert.equal(reconciliationArgs({...provider,transaction_amount_refunded:1},order,null).refunded_cents,100)
 assert.throws(()=>reconciliationArgs({...provider,transaction_amount_refunded:12},order,null))
 for(const [status,payload,definitive] of [[400,{message:'invalid token'},true],[400,{message:'idempotency mismatch'},false],[500,{},false]]){
  await assert.rejects(createInlinePayment({accessToken:'synthetic',order,method:'pix',idempotencyKey:'synthetic',webhookUrl:'https://example.test/webhook',fetchImpl:async()=>({ok:false,status,json:async()=>payload})}),e=>e.definitive===definitive)
 }
})

test('17: signed provider callbacks reject forged/replayed signatures before any lookup',async()=>{
 let lookups=0
 const ts=String(Math.floor(Date.now()/1000)),requestId='synthetic-request',secret='synthetic-webhook'
 const sign=time=>'ts='+time+',v1='+createHmac('sha256',secret).update(`id:123;request-id:${requestId};ts:${time};`).digest('hex')
 const handler=paymentHandlers({enabled:true,accessToken:'synthetic',webhookSecret:secret,collectorId:42,fetchPayment:async()=>{lookups++;return provider},reconcilePayment:async()=>{}})
 for(const signature of ['ts='+ts+',v1='+'0'.repeat(64),sign(Number(ts)-3600)])await assert.rejects(handler.webhook({signature,requestId,dataId:'123'}),/Assinatura/)
 assert.equal(lookups,0)
 await handler.webhook({signature:sign(ts),requestId,dataId:'123'});assert.equal(lookups,1)
})

test('17 PostgreSQL: atomic settlement, leases, duplicate notices, partial refunds before approval, rejection, expiry and RLS',async()=>{
 const db=new PGlite(),buyer=crypto.randomUUID(),event=crypto.randomUUID(),batch=crypto.randomUUID()
 const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0]
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
   create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',email_confirmed_at timestamptz,is_anonymous boolean default false);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth,public to anon,authenticated,service_role;`)
  for(const file of ['001_platform.sql','002_production.sql','003_order_history_global_coupons.sql','004_preservation_reservation_limits.sql','005_primary_admin_email.sql','008_event_platform_fee_and_safe_delete.sql','009_payment_fees_payouts.sql','010_owner_only_platform_fee.sql','011_inline_payment_attempts.sql','011_self_service_organizers_and_account_admin.sql','012_verified_inline_payments.sql','013_experience_participants_vip.sql','014_atomic_inline_payments.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'))
  await db.exec(await readFile(new URL('../supabase/migrations/014_atomic_inline_payments.sql',import.meta.url),'utf8'))
  await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[buyer,'buyer@example.test'])
  const org=await scalar("insert into public.organizations(name) values('Teste') returning id")
  await db.query("insert into public.events(id,organization_id,slug,title,published) values($1,$2,'test','Teste',true)",[event,org])
  await db.query("insert into public.ticket_types(id,event_id,name,sector,batch,type,capacity,price_cents) values($1,$2,'Pista','Pista','1','individual',100,1000)",[batch,event])
  await db.exec("update public.settings set value='true'::jsonb where key='payments_enabled'")
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[buyer])
  const make=async(method='pix')=>{
   const id=await scalar("select public.create_order($1,2,$2,'',$3,null,null)",[batch,{name:'Cliente Teste',cpf:'52998224725',phone:'41999999999',birthDate:'2000-01-01',email:'buyer@example.test',participantMode:'same'},crypto.randomUUID()])
   const attempt=await scalar('select public.begin_inline_payment($1,$2,$3)',[id,buyer,method])
   return {id,attempt,total:await scalar('select total_cents from public.orders where id=$1',[id])}
  }
  const sync=(o,id,status,refunded=0,stamp='2026-10-08T18:00:00Z')=>scalar('select public.reconcile_inline_payment($1,$2,$3,$4,$5,$6,$7,10,$8)',[o.id,id,o.attempt.attempt_key,status,o.total,o.attempt.method,stamp,refunded])
  const count=o=>scalar('select count(*)::integer from public.tickets where order_id=$1',[o.id])
  const pix=await make(),lease=crypto.randomUUID()
  assert.equal(await scalar('select public.claim_inline_creation($1,$2,$3)',[pix.id,pix.attempt.attempt_key,lease]),1)
  assert.equal(await scalar('select public.claim_inline_creation($1,$2,$3)',[pix.id,pix.attempt.attempt_key,crypto.randomUUID()]),0)
  assert.equal(await sync(pix,'1001','pending'),'recorded');assert.equal(await count(pix),0)
  const snapshot=await scalar('select snapshot from public.orders where id=$1',[pix.id])
  assert.equal(await sync(pix,'1001','approved',0,'2026-10-08T18:01:00Z'),'approved');assert.equal(await count(pix),2)
  assert.equal(await sync(pix,'1001','approved',0,'2026-10-08T18:01:00Z'),'approved');assert.equal(await count(pix),2)
  assert.deepEqual(await scalar('select snapshot from public.orders where id=$1',[pix.id]),snapshot)
  assert.equal(await sync(pix,'1001','rejected',0,'2026-10-08T17:59:00Z'),'stale')
  assert.equal(await sync(pix,'1001','charged_back',0,'2026-10-08T18:02:00Z'),'review')
  assert.equal(await scalar('select bool_and(cancelled) from public.tickets where order_id=$1',[pix.id]),true)
  const refunded=await make('card')
  await sync(refunded,'1010','in_process');assert.equal(await count(refunded),0)
  await sync(refunded,'1010','approved',0,'2026-10-08T18:01:00Z');assert.equal(await count(refunded),2)
  await sync(refunded,'1010','refunded',refunded.total,'2026-10-08T18:02:00Z')
  assert.equal(await scalar('select status from public.orders where id=$1',[refunded.id]),'refunded')
  assert.equal(await scalar('select bool_and(cancelled) from public.tickets where order_id=$1',[refunded.id]),true)
  const partial=await make('card')
  assert.equal(await sync(partial,'1002','approved',100),'review');assert.equal(await count(partial),0)
  assert.equal(await sync(partial,'1002','approved',0,'2026-10-08T18:01:00Z'),'review');assert.equal(await count(partial),0)
  const declined=await make('card')
  assert.equal(await sync(declined,'1003','rejected'),'recorded');assert.equal(await count(declined),0)
  const retry=await scalar("select public.begin_inline_payment($1,$2,'pix')",[declined.id,buyer]);assert.notEqual(retry.attempt_key,declined.attempt.attempt_key)
  assert.equal(retry.creation_count,0)
  assert.equal(await sync(declined,'1003','approved',0,'2026-10-08T18:01:00Z'),'review');assert.equal(await count(declined),0)
  const expired=await make()
  await db.query("update public.orders set expires_at=now()-interval '1 minute' where id=$1",[expired.id])
  assert.equal(await sync(expired,'1004','approved'),'review');assert.equal(await count(expired),0)
  const invalid=await make()
  await assert.rejects(db.query('select public.reconcile_inline_payment($1,$2,$3,$4,$5,$6,now(),10,0)',[invalid.id,'1005',invalid.attempt.attempt_key,'approved',invalid.total-1,'pix']),/incompatível/)
  assert.equal(await count(invalid),0)
  await sync(invalid,'1005','pending')
  await db.exec("update public.settings set value='false'::jsonb where key='payments_enabled'")
  await assert.rejects(sync(invalid,'1005','approved',0,'2026-10-08T18:01:00Z'),/habilitados/)
  assert.equal(await scalar('select status from public.inline_payment_attempts where order_id=$1',[invalid.id]),'pending')
  assert.equal(await count(invalid),0)
  await db.exec("update public.settings set value='true'::jsonb where key='payments_enabled'")
  assert.equal(await sync(invalid,'1005','cancelled',0,'2026-10-08T18:02:00Z'),'recorded');assert.equal(await count(invalid),0)
  await db.query('select public.cancel_order($1)',[invalid.id])
  const fail=await make(),first=crypto.randomUUID()
  await scalar('select public.claim_inline_creation($1,$2,$3)',[fail.id,fail.attempt.attempt_key,first])
  await db.query('select public.reject_inline_creation($1,$2,$3)',[fail.id,fail.attempt.attempt_key,first])
  assert.equal(await scalar('select status from public.inline_payment_attempts where order_id=$1',[fail.id]),'rejected')
  const ambiguous=await make(),leaseOne=crypto.randomUUID(),leaseTwo=crypto.randomUUID()
  await scalar('select public.claim_inline_creation($1,$2,$3)',[ambiguous.id,ambiguous.attempt.attempt_key,leaseOne])
  await db.query("update public.inline_payment_attempts set creation_lease_until=now()-interval '1 second' where order_id=$1",[ambiguous.id])
  assert.equal(await scalar('select public.claim_inline_creation($1,$2,$3)',[ambiguous.id,ambiguous.attempt.attempt_key,leaseTwo]),2)
  await db.query('select public.reject_inline_creation($1,$2,$3)',[ambiguous.id,ambiguous.attempt.attempt_key,leaseTwo])
  assert.equal(await scalar('select status from public.inline_payment_attempts where order_id=$1',[ambiguous.id]),'creating')
  await db.exec("update public.ticket_types set price_cents=0")
  const free=await scalar("select public.create_order($1,2,$2,'',$3,null,null)",[batch,{name:'Cliente Teste',cpf:'52998224725',phone:'41999999999',birthDate:'2000-01-01',email:'buyer@example.test',participantMode:'same'},crypto.randomUUID()])
  assert.equal(await scalar('select status from public.orders where id=$1',[free]),'approved');assert.equal(await count({id:free}),2)
  await db.exec('set role authenticated')
  await assert.rejects(sync(invalid,'1005','approved'),/permission denied/)
  await assert.rejects(db.query('select public.claim_inline_creation($1,$2,$3)',[invalid.id,invalid.attempt.attempt_key,crypto.randomUUID()]),/permission denied/)
 }finally{await db.close()}
})
