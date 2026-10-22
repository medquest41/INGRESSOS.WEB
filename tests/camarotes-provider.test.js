import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {stripTypeScriptTypes} from 'node:module'
import {createHmac} from 'node:crypto'

test('deployed Checkout Pro adaptation: mocked Pix deadline, payment ownership, review, refund and unchanged common checkout',async()=>{
 const original=await readFile(new URL('../supabase/deployment/payments-checkout-pro.ts',import.meta.url),'utf8')
 const code=stripTypeScriptTypes(original.replace(/^import .*;\r?\n/gm,''))
 const id=crypto.randomUUID(),userId=crypto.randomUUID(),calls=[],providerCalls=[]
 let handler,order,payment,fail=false,roomResult='pending'
 const reset=(room=true)=>{
  order={id,user_id:userId,total_cents:132000,status:'pending',snapshot:room?{wristbands:8}:{},expires_at:new Date(Date.now()+15*60000).toISOString(),buyer:{name:'Teste',email:'test@example.test',cpf:'52998224725'}}
  payment={id:8001,external_reference:id,collector_id:42,currency_id:'BRL',live_mode:false,transaction_amount:1320,status:'pending',payment_method_id:'pix',point_of_interaction:{transaction_data:{qr_code:'synthetic-pix'}},fee_details:[]}
  calls.length=0;providerCalls.length=0;fail=false;roomResult='pending'
 }
 const client={auth:{getUser:async()=>({data:{user:{id:userId,email:'test@example.test'}},error:null})},from:()=>{
  let patch=null;const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:order,error:null}),update:value=>{patch=value;return q},then:resolve=>{Object.assign(order,patch||{});resolve({data:order,error:null})}};return q
 },rpc:async(name,args)=>{
  calls.push({name,args})
  if(name==='prepare_camarote_payment')return {data:{...order,expires_at:new Date(Date.now()+32*60000).toISOString()},error:null}
  if(name==='reconcile_camarote_payment'){order.payment_id=String(payment.id);return {data:roomResult,error:fail?Error('synthetic-db-failure'):null}}
  return {data:null,error:null}
 }}
 const providerFetch=async(url,options={})=>{
  const parsed=new URL(url),body=options.body?JSON.parse(options.body):null
  providerCalls.push({path:parsed.pathname,body})
  if(parsed.pathname==='/users/me')return Response.json({id:42})
  return Response.json(payment)
 }
 const env={SUPABASE_URL:'https://synthetic.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'synthetic',SUPABASE_ANON_KEY:'synthetic',MERCADOPAGO_ACCESS_TOKEN:'TEST-synthetic',MERCADOPAGO_WEBHOOK_SECRET:'synthetic-webhook'}
 new Function('createClient','Deno','fetch',code)(()=>client,{env:{get:key=>env[key]},serve:fn=>{handler=fn}},providerFetch)
 const invoke=async(action)=>handler(new Request('https://synthetic.test/payments',{method:'POST',headers:{Authorization:'Bearer synthetic-user','Content-Type':'application/json'},body:JSON.stringify({action,orderId:id})}))
 reset();let response=await invoke('create_pix'),data=await response.json()
 assert.equal(data.status,'pending');assert.equal(data.qrCode,'synthetic-pix');assert.equal(order.payment_id,'8001')
 assert.equal(providerCalls.find(c=>c.path==='/v1/payments').body.date_of_expiration,order.expires_at)
 assert.equal(calls.filter(c=>c.name==='reconcile_camarote_payment').length,1)
 assert.equal(calls.some(c=>c.name==='settle_payment'),false)
 roomResult='approved';payment.status='approved';response=await invoke('status');assert.equal((await response.json()).status,'approved')
 fail=true;response=await invoke('status');assert.equal(response.status,500)
 reset();payment.collector_id=99;response=await invoke('create_pix');assert.equal(response.status,500);assert.equal(calls.some(c=>c.name==='reconcile_camarote_payment'),false)
 reset();payment.live_mode=true;response=await invoke('create_pix');assert.equal(response.status,500)
 reset();roomResult='review';payment.status='approved';response=await invoke('create_pix');assert.equal((await response.json()).status,'review')
 reset();roomResult='review';payment.status='refunded'
 const ts=String(Math.floor(Date.now()/1000)),rid='synthetic-request'
 const sig=createHmac('sha256',env.MERCADOPAGO_WEBHOOK_SECRET).update(`id:8001;request-id:${rid};ts:${ts};`).digest('hex')
 response=await handler(new Request('https://synthetic.test/payments?type=payment&data.id=8001',{method:'POST',headers:{'x-signature':`ts=${ts},v1=${sig}`,'x-request-id':rid}}))
 assert.equal((await response.json()).status,'review');assert.equal(calls.some(c=>c.name==='reconcile_camarote_payment'),true)
 reset(false);response=await invoke('create_pix');data=await response.json();assert.equal(data.status,'pending')
 assert.equal(providerCalls.find(c=>c.path==='/v1/payments').body.date_of_expiration,undefined)
 assert.equal(calls.some(c=>c.name==='prepare_camarote_payment'),false)
 assert.equal(calls.some(c=>c.name==='reconcile_camarote_payment'),false)
})
