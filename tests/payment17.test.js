import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

test('17: Pix and status send order ID and authenticated Bearer; card refuses; expired session refuses',async()=>{
 const calls=[]
 let session={access_token:'test-user-session'}
 globalThis.__payment17={auth:{getSession:async()=>({data:{session}})},functions:{invoke:async(name,options)=>{calls.push({name,...options});return {data:{status:'pending',qrCode:'pix-code'}}}}}
 try{
  const source=(await fs.readFile(new URL('../src/services/inlinePayment.js',import.meta.url),'utf8')).replace("import { supabase } from '../lib/supabase'",'const supabase=globalThis.__payment17')
  const service=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))
  await service.payInline('order-17','pix');await service.pollPayment('order-17')
  assert.deepEqual(calls.map(c=>c.body),[{action:'create_pix',orderId:'order-17'},{action:'status',orderId:'order-17'}])
  assert.ok(calls.every(c=>c.name==='payments'&&c.headers.Authorization==='Bearer test-user-session'))
  await assert.rejects(service.payInline('order-17','card'),/indisponível/)
  session=null
  await assert.rejects(service.pollPayment('order-17'),/sessão expirou/)
  assert.equal(calls.length,2)
 }finally{delete globalThis.__payment17}
})
