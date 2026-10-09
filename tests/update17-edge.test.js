import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {stripTypeScriptTypes} from 'node:module'
import {createHmac} from 'node:crypto'

// Runs the actual Edge handler locally. Every provider and database request is intercepted.
test('17 HTTP Edge: auth/ownership/CORS, Pix/card, lost-response recovery, signed webhook, reversal and no false approval',async()=>{
 const originalFetch=globalThis.fetch,originalDeno=globalThis.Deno
 const buyer=crypto.randomUUID(),id=crypto.randomUUID(),attemptKey=crypto.randomUUID()
 const env={SUPABASE_URL:'https://supabase.example.test',SUPABASE_ANON_KEY:'synthetic',SUPABASE_SERVICE_ROLE_KEY:'synthetic',MP_PUBLIC_KEY:'TEST-00000000-0000-4000-8000-000000000001',MP_ACCESS_TOKEN:'synthetic',MP_COLLECTOR_ID:'42',MP_WEBHOOK_SECRET:'synthetic',MP_WEBHOOK_URL:'https://supabase.example.test/functions/v1/payments?action=webhook',MP_ENVIRONMENT:'sandbox',PAYMENT_ALLOWED_ORIGINS:'https://ingressos.example.test'}
 let order,attempt,payment,handler,created=0,settled=0,leaseCount=1,dbError=false,enabled=true
 const reset=(method='pix')=>{
  order={id,user_id:buyer,total_cents:1100,subtotal_cents:1000,discount_cents:0,fee_cents:100,status:'pending',payment_review:false,expires_at:new Date(Date.now()+32*60000).toISOString(),buyer:{name:'Cliente Teste',email:'buyer@example.test',cpf:'52998224725'},snapshot:{feePayer:'buyer'}}
  attempt=null;payment={id:123,collector_id:42,currency_id:'BRL',live_mode:false,transaction_amount:11,external_reference:id,status:'pending',payment_method_id:method==='pix'?'pix':'visa',payment_type_id:method==='pix'?'bank_transfer':'credit_card',date_last_updated:new Date().toISOString(),metadata:{attempt_key:attemptKey},point_of_interaction:{transaction_data:{qr_code:'synthetic-pix'}},fee_details:[]}
 }
 const client=authorization=>({
  auth:{getUser:async()=>authorization==='Bearer synthetic-user'?{data:{user:{id:buyer}},error:null}:{data:{user:null},error:Error('unauthorized')}},
  from:table=>{
   const filters={};const query={select:()=>query,eq:(key,value)=>{filters[key]=value;return query},maybeSingle:async()=>query.single(),single:async()=>({data:table==='settings'?{value:enabled}:table==='profiles'?{active:true}:table==='orders'?filters.user_id&&filters.user_id!==buyer?null:order:attempt,error:null})};return query
  },
  rpc:async(name,args)=>{
   if(name==='begin_inline_payment'){attempt??={order_id:id,attempt_key:attemptKey,method:args.payment_method,status:'creating',provider_id:null};return {data:attempt}}
   if(name==='claim_inline_creation')return {data:leaseCount}
   if(name==='reject_inline_creation'){attempt.status='rejected';return {data:null}}
   if(name==='reconcile_inline_payment'){
    if(dbError)return {error:Error('database unavailable')}
    attempt??={attempt_key:attemptKey,method:'pix'};attempt.provider_id=args.external_payment_id;attempt.status=args.provider_status;order.payment_status=args.provider_status
    if(['refunded','charged_back'].includes(args.provider_status)||args.refunded_cents){order.payment_review=true;order.status='refunded';return {data:'review'}}
    if(args.provider_status==='approved'){order.status='approved';order.payment_id=args.external_payment_id;settled++}
    return {data:args.provider_status==='approved'?'approved':'recorded'}
   }
   throw Error('Unexpected RPC: '+name)
  }
 })
 globalThis.__payment17CreateClient=(_url,_key,options)=>client(options?.global?.headers?.Authorization)
 globalThis.Deno={env:{get:key=>env[key]},serve:fn=>{handler=fn}}
 globalThis.fetch=async(url,options)=>{
  assert.equal(new URL(url).hostname,'api.mercadopago.com')
  if(String(url).includes('/search'))return Response.json({results:created?[payment]:[],paging:{total:created?1:0}})
  if(options?.method==='POST'){created++;const body=JSON.parse(options.body);assert.equal(body.transaction_amount,11);assert.equal(options.headers['X-Idempotency-Key'],attemptKey);assert.equal(body.card_number,undefined);return Response.json(payment)}
  return Response.json(payment)
 }
 const request=(body,headers={},suffix='')=>handler(new Request('https://supabase.example.test/functions/v1/payments'+suffix,{method:'POST',headers:{'Content-Type':'application/json',origin:'https://ingressos.example.test',authorization:'Bearer synthetic-user',...headers},body:JSON.stringify(body)}))
 try{
  reset()
  let source=await readFile(new URL('../supabase/functions/payments/index.ts',import.meta.url),'utf8')
  source=source.replace(/import \{ createClient \} from [^\n]+/,'const createClient=globalThis.__payment17CreateClient')
  source=source.replace(/from '(\.\.\/_shared\/[^']+)'/g,(_match,path)=>"from '"+new URL(path,new URL('../supabase/functions/payments/index.ts',import.meta.url)).href+"'")
  await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source)).toString('base64'))
  assert.equal((await request({action:'status'},{authorization:''})).status,401)
  assert.equal((await request({action:'status'},{origin:'https://evil.example.test'})).status,403)
  const status=await request({action:'status'});assert.equal(status.headers.get('cache-control'),'no-store');assert.equal((await status.json()).publicKey,env.MP_PUBLIC_KEY)
  const first=await request({action:'pay',orderId:id,method:'pix',total:0});assert.equal((await first.json()).qrCode,'synthetic-pix');assert.equal(created,1);assert.equal(order.status,'pending')
  await request({action:'pay',orderId:id,method:'pix'});assert.equal(created,1)
  payment.status='approved';dbError=true
  assert.equal((await request({action:'poll',orderId:id})).status,400);assert.equal(order.status,'pending')
  dbError=false;assert.equal((await (await request({action:'poll',orderId:id})).json()).status,'approved');assert.equal(settled,1)
  const ts=String(Math.floor(Date.now()/1000)),reqId='synthetic-webhook'
  const signature='ts='+ts+',v1='+createHmac('sha256',env.MP_WEBHOOK_SECRET).update(`id:123;request-id:${reqId};ts:${ts};`).digest('hex')
  const headers={'x-signature':signature,'x-request-id':reqId,origin:''}
  payment.status='charged_back';enabled=false
  assert.equal((await request({type:'payment',data:{id:'123'}},headers,'?action=webhook&data.id=123')).status,200)
  assert.equal(order.payment_review,true)
  assert.equal((await request({type:'payment',data:{id:'999'}},headers,'?action=webhook&data.id=123')).status,400)
  assert.equal((await request({type:'payment',data:{id:'123'}},{...headers,'x-signature':'invalid'},'?action=webhook&data.id=123')).status,503)
  enabled=true;created=0;reset('card')
  const card={token:'synthetic-token',payment_method_id:'visa',installments:1,payer:{email:'holder@example.test',identification:{type:'CPF',number:'11144477735'}}}
  payment.status='rejected';assert.equal((await (await request({action:'pay',orderId:id,method:'card',card})).json()).status,'rejected');assert.equal(order.status,'pending')
  reset('card');created=1;attempt={order_id:id,attempt_key:attemptKey,method:'card',status:'creating',provider_id:null};payment.status='approved'
  const recovered=await request({action:'poll',orderId:id});assert.equal((await recovered.json()).status,'approved');assert.equal(created,1)
  reset();created=0;leaseCount=0
  assert.equal((await (await request({action:'pay',orderId:id,method:'pix'})).json()).status,'creating');assert.equal(created,0)
 }finally{globalThis.fetch=originalFetch;globalThis.Deno=originalDeno;delete globalThis.__payment17CreateClient}
})
