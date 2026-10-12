import {test} from 'node:test'
import assert from 'node:assert/strict'
import {normalizeEventWhatsapp,eventContactPhone} from '../src/utils/eventContact.js'
test('event contact requires DDD, accepts formatted/local/international Brazilian phone',()=>{
 for(const phone of ['(45) 99999-1234','45999991234','+55 (45) 99999-1234'])assert.equal(normalizeEventWhatsapp(phone),'5545999991234')
 for(const phone of ['', '999991234','00123456789','+1 212 555 1234'])assert.throws(()=>normalizeEventWhatsapp(phone))
 assert.equal(eventContactPhone({whatsapp:'(11) 98888-1234',organizerWhatsapp:'45999991234'}),'5511988881234')
 assert.equal(eventContactPhone({}), '')
})
