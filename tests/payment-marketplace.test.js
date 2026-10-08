import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { paymentHandlers } from '../server/payment-handlers.mjs'
const id='10000000-0000-4000-8000-000000000001'
test('verified fee and method come from provider, not browser; invalid redirects rejected',async()=>{
  let args, preferenceOrder
  const config={enabled:true,accessToken:'synthetic',webhookSecret:'synthetic',collectorId:'42',getUser:async()=>({id:'buyer'}),getOrder:async()=>({id,user_id:'buyer',status:'pending',expires_at:new Date(Date.now()+60000).toISOString(),total_cents:5500}),createPreference:async({order})=>{preferenceOrder=order;return {init_point:'https://www.mercadopago.com.br/checkout/test'}},settlePayment:async value=>{args=value},fetchPayment:async()=>({id:123,collector_id:42,live_mode:true,currency_id:'BRL',status:'approved',external_reference:id,transaction_amount:55,payment_method_id:'pix',fee_details:[{fee_payer:'collector',amount:2},{fee_payer:'payer',amount:1}]})}
  await paymentHandlers(config).checkout({orderId:id})
  assert.equal(preferenceOrder.totalCents,5500);assert.ok(preferenceOrder.expiresAt)
  await assert.rejects(paymentHandlers({...config,createPreference:async()=>({init_point:'https://evil.example.com/'})}).checkout({orderId:id}),/inválida/)
  const ts=String(Math.floor(Date.now()/1000)),requestId='req',dataId='123'
  const v1=createHmac('sha256',config.webhookSecret).update(`id:123;request-id:${requestId};ts:${ts};`).digest('hex')
  const notice={signature:`ts=${ts},v1=${v1}`,requestId,dataId}
  await paymentHandlers(config).webhook(notice)
  assert.equal(args.provider_fee,200);assert.equal(args.method,'pix');assert.equal(args.paid_cents,5500)
  await assert.rejects(paymentHandlers({...config,fetchPayment:async()=>({...await config.fetchPayment(),fee_details:[{fee_payer:'collector',amount:-1}]})}).webhook(notice),/Tarifa/)
  let reversal
  await paymentHandlers({...config,recordReversal:async value=>{reversal=value},fetchPayment:async()=>({...await config.fetchPayment(),status:'refunded'})}).webhook(notice)
  assert.equal(reversal.full_reversal,true);assert.equal(reversal.external_payment_id,'123')
  await paymentHandlers({...config,recordReversal:async value=>{reversal=value},fetchPayment:async()=>({...await config.fetchPayment(),transaction_amount_refunded:5})}).webhook(notice)
  assert.equal(reversal.full_reversal,false)
})
