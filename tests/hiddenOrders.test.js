import test from 'node:test'
import assert from 'node:assert/strict'
import {canHideUnpaidOrder} from '../src/utils/hiddenOrders.js'
test('only unpaid orders without tickets or past approval can be hidden',()=>{
 for(const status of ['pending','cancelled','rejected','expired'])assert.equal(canHideUnpaidOrder({status}),true)
 for(const status of ['approved','refunded','charged_back','review'])assert.equal(canHideUnpaidOrder({status}),false)
 for(const paymentStatus of ['approved','in_process','authorized','confirming','refunded'])assert.equal(canHideUnpaidOrder({status:'pending',paymentStatus}),false)
 assert.equal(canHideUnpaidOrder({status:'cancelled',ticketCodes:[{code:'existing-ticket'}]}),false)
 assert.equal(canHideUnpaidOrder({status:'cancelled',orderHistory:[{to_status:'approved'}]}),false)
 assert.equal(canHideUnpaidOrder({status:'pending',paymentReview:true}),false)
})
