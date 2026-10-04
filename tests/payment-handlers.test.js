import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { paymentHandlers } from '../server/payment-handlers.mjs'
test('payment boundary refuses disabled configuration, other buyers, bad seller and tampered webhook',async()=>{
 await assert.rejects(paymentHandlers({}).checkout({}),/não habilitado/)
 let settled=0;const id='10000000-0000-4000-8000-000000000001'
 const config={enabled:true,accessToken:'synthetic-test-token',webhookSecret:'synthetic-test-secret',collectorId:'42',getUser:async()=>({id:'buyer'}),getOrder:async()=>({id,user_id:'other',status:'pending',expires_at:new Date(Date.now()+60000).toISOString(),total_cents:100}),settlePayment:async()=>{settled++},fetchPayment:async()=>({id:123,collector_id:42,live_mode:true,currency_id:'BRL',status:'approved',external_reference:id,transaction_amount:1})}
 await assert.rejects(paymentHandlers(config).checkout({orderId:id}),/indisponível/)
 await assert.rejects(paymentHandlers(config).webhook({signature:'bad',requestId:'req',dataId:'123'}),/Assinatura/)
 const ts=String(Math.floor(Date.now()/1000));const v1=createHmac('sha256',config.webhookSecret).update('id:123;request-id:req;ts:'+ts+';').digest('hex')
 const notice={signature:'ts='+ts+',v1='+v1,requestId:'req',dataId:'123'}
 await assert.rejects(paymentHandlers({...config,collectorId:'99'}).webhook(notice),/vendedor/)
 await paymentHandlers(config).webhook(notice);assert.equal(settled,1)
})
