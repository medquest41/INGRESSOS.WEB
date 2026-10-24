import test from 'node:test'
import assert from 'node:assert/strict'
import {groupTicketsForPrint} from '../src/utils/ticketPrint.js'
for(const count of [1,4,5,10,15,30])test(count+' originals are grouped four per page without duplication',()=>{
 const tickets=Array.from({length:count},(_,i)=>({code:'qr-'+i})),groups=groupTicketsForPrint(tickets)
 assert.equal(groups.length,Math.ceil(count/4));assert.ok(groups.every(g=>g.length<=4));assert.deepEqual(groups.flat(),tickets);assert.equal(new Set(groups.flat().map(t=>t.code)).size,count)
})
