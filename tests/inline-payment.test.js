import test from 'node:test'
import assert from 'node:assert/strict'
import {paymentBody,safePayment,createInlinePayment,publicPayment} from '../server/inline-payment.mjs'
const order={id:'10000000-0000-4000-8000-000000000001',total_cents:5500,expires_at:new Date(Date.now()+32*60000).toISOString(),buyer:{email:'buyer@example.test',name:'Cliente Teste',cpf:'52998224725'},snapshot:{eventTitle:'Festa'}}
test('Pix uses server amount, identity and deadline; browser totals/card details are ignored',async()=>{
 const body=paymentBody(order,'pix',{transaction_amount:1,payer:{email:'attacker@example.test'}},'https://example.test/webhook')
 assert.equal(body.transaction_amount,55);assert.equal(body.payer.email,'buyer@example.test');assert.equal(body.date_of_expiration,order.expires_at)
 assert.equal(body.payment_method_id,'pix');assert.equal(body.external_reference,order.id)
 let submitted
 await createInlinePayment({accessToken:'synthetic',order,method:'pix',idempotencyKey:'synthetic-unique',webhookUrl:'https://example.test/webhook',fetchImpl:async(url,args)=>{submitted=args;return {ok:true,json:async()=>({id:123})}}})
 assert.equal(submitted.headers['X-Idempotency-Key'],'synthetic-unique');assert.equal(JSON.parse(submitted.body).transaction_amount,55)
})
test('card forwards token only and refuses unsupported installments or malformed token',()=>{
 const body=paymentBody(order,'card',{token:'synthetic-token-123',payment_method_id:'visa',installments:1,card_number:'not-forwarded',security_code:'not-forwarded'},'https://example.test/webhook')
 assert.equal(body.token,'synthetic-token-123');assert.equal(body.installments,1);assert.ok(!('card_number' in body));assert.ok(!('security_code' in body))
 assert.throws(()=>paymentBody(order,'card',{token:'synthetic-token-123',payment_method_id:'visa',installments:2}))
 assert.throws(()=>paymentBody(order,'card',{token:'bad',payment_method_id:'visa',installments:1}))
})
test('provider result cannot approve the browser until database settlement succeeds',()=>{
 const payment={id:123,live_mode:true,collector_id:42,currency_id:'BRL',external_reference:order.id,transaction_amount:55,payment_method_id:'pix',status:'approved',fee_details:[{fee_payer:'collector',amount:2}],point_of_interaction:{transaction_data:{qr_code:'synthetic-qr-payload'}}}
 assert.equal(safePayment(payment,order,'42').providerFee,200)
 assert.throws(()=>safePayment({...payment,transaction_amount:1},order,'42'))
 assert.throws(()=>safePayment({...payment,collector_id:43},order,'42'))
 assert.throws(()=>safePayment({...payment,live_mode:false},order,'42'))
 assert.equal(publicPayment(payment,order,false).status,'confirming')
 assert.equal(publicPayment(payment,order,true).status,'approved')
 assert.equal(publicPayment(payment,order,false).qrCode,'')
 assert.equal(publicPayment({...payment,status:'pending'},order,false).qrCode,'synthetic-qr-payload')
 assert.equal(publicPayment({...payment,status:'pending'},order,false,Date.now()+3600000).status,'expired')
 assert.equal(publicPayment({...payment,status:'pending'},order,false,Date.now()+3600000).qrCode,'')
 const challenge=publicPayment({...payment,status:'pending',status_detail:'pending_challenge',three_ds_info:{external_resource_url:'https://bank.example.test/challenge',creq:'synthetic-challenge'}},order,false)
 assert.equal(challenge.challenge.externalResourceURL,'https://bank.example.test/challenge')
})
