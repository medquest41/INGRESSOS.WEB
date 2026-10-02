import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { verifyWebhook } from '../server/mercadopago.mjs'
test('payment signature rejects tampering and replay',()=>{
 const now=Date.now(),ts=String(Math.floor(now/1000)),secret='test-only',requestId='request-1',dataId='123'
 const v1=createHmac('sha256',secret).update(`id:123;request-id:request-1;ts:${ts};`).digest('hex')
 const params={signature:`ts=${ts},v1=${v1}`,requestId,dataId,secret,now}
 assert.equal(verifyWebhook(params),true)
 assert.equal(verifyWebhook({...params,dataId:'456'}),false)
 assert.equal(verifyWebhook({...params,now:now+600000}),false)
 assert.equal(verifyWebhook({...params,signature:'bad'}),false)
})
