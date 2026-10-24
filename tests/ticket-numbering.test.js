import test from 'node:test'
import assert from 'node:assert/strict'
import {orderedTickets,ticketOrdinal} from '../src/utils/ticketNumbering.js'
import {matchesBuyerSearch} from '../src/utils/buyerSearch.js'
test('15 QR retain persisted ordinal independent of response order',()=>{
 const originals=Array.from({length:15},(_,i)=>({ticket_number:i+1,code:'qr-'+(i+1)})).reverse()
 const ordered=orderedTickets(originals)
 assert.deepEqual(ordered.map(t=>t.ticket_number),Array.from({length:15},(_,i)=>i+1))
 assert.equal(originals[0].ticket_number,15)
 assert.equal(new Set(ordered.map(t=>t.code)).size,15)
 assert.equal(ticketOrdinal({number:12},0),12)
 assert.equal(ticketOrdinal({},0),1)
})
test('Admin buyer search finds phone, CPF, email and name',()=>{
 const record={buyer:{name:'Ana Oliveira',email:'ana@example.test',cpf:'52998224725',phone:'(45) 99999-1234'}}
 for(const term of ['Oliveira','ana@example','529.982.247-25','(45) 99999-1234'])assert.equal(matchesBuyerSearch(record,term),true,term)
 assert.equal(matchesBuyerSearch(record,'desconhecido'),false)
})
