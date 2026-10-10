import test from 'node:test'
import assert from 'node:assert/strict'
import {verifySalesOwner} from '../supabase/functions/_shared/sales-auth.mjs'
test('cleanup requires existing owner identity and rechecks password for the same account',async()=>{
 let loginCalls=0;const owner={id:'owner',email:'ingressosaltatemporada@gmail.com'}
 const client={auth:{getUser:async()=>({data:{user:owner}}),signInWithPassword:async input=>{loginCalls++;return input.password==='valid-test-password'?{data:{user:owner}}:{error:{message:'wrong'}}}}}
 await assert.rejects(verifySalesOwner(client,'token','wrong-password'),/Senha inválida/)
 assert.equal((await verifySalesOwner(client,'token','valid-test-password')).id,'owner');assert.equal(loginCalls,2)
 const outsider={auth:{...client.auth,getUser:async()=>({data:{user:{id:'other',email:'other@example.test'}}})}}
 await assert.rejects(verifySalesOwner(outsider,'token','valid-test-password'),/Admin Geral/);assert.equal(loginCalls,2)
 const mismatch={auth:{...client.auth,signInWithPassword:async()=>({data:{user:{id:'other'}}})}}
 await assert.rejects(verifySalesOwner(mismatch,'token','valid-test-password'),/Senha inválida/)
})
