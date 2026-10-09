import test from 'node:test'
import assert from 'node:assert/strict'
import {withOptionalOrganizerContact} from '../src/services/catalogCompatibility.js'
test('16.1 optional WhatsApp column cannot block the existing catalog',async()=>{
 for(const error of [{code:'42703',message:'column organizations_1.whatsapp does not exist'},{code:'PGRST204',message:"Could not find the 'whatsapp' column of 'organizations' in the schema cache"}]){
  const calls=[],rows=[{id:'event',organizations:{name:'Organizador'},details:{title:'Evento'}}]
  const result=await withOptionalOrganizerContact(async enabled=>{calls.push(enabled);return enabled?{data:null,error}:{data:rows,error:null}})
  assert.deepEqual(calls,[true,false]);assert.deepEqual(result.data,rows);assert.equal(result.error,null)
 }
})
test('16.1 retains contact on migrated databases and never hides other failures',async()=>{
 const good={data:[{organizations:{name:'Org',whatsapp:'5546999999999'}}],error:null};let calls=0
 assert.equal(await withOptionalOrganizerContact(async()=>{calls++;return good}),good);assert.equal(calls,1)
 for(const error of [{code:'42501',message:'permission denied'},{code:'42703',message:'column events.title does not exist'},{code:'PGRST205',message:'events missing'},{code:'FETCH_ERROR',message:'network failure'}]){
  calls=0;const response={data:null,error};assert.equal(await withOptionalOrganizerContact(async()=>{calls++;return response}),response);assert.equal(calls,1)
 }
 const originalError=Error('Network failure');await assert.rejects(withOptionalOrganizerContact(async()=>{throw originalError}),originalError)
})
