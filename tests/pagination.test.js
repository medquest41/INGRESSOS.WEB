import test from 'node:test'
import assert from 'node:assert/strict'
import { paged } from '../src/lib/pagination.js'
test('reports collect every permitted row even when the API cap is below the requested page size',async()=>{
 const permitted=[1,2,3,4,5,6,7];let calls=0
 const response=await paged(()=>({range:async start=>{calls++;return {data:permitted.slice(start,start+3),count:7,error:null}}}),200)
 assert.deepEqual(response.data,permitted);assert.equal(calls,3)
 const failure=await paged(()=>({range:async()=>({data:null,error:{message:'database unavailable'}})}))
 assert.equal(failure.error.message,'database unavailable')
})
