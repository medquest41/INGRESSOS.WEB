import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateFees, payoutAmount } from '../src/utils/fees.js'
test('10% buyer-paid, organizer-paid, discounted, zero fee and rounding',()=>{
  assert.deepEqual(calculateFees(50),{fee:5,platformFee:5,total:55,feePayer:'buyer',feeRate:0.1})
  assert.equal(calculateFees(50,0,0.1,'organizer').total,50)
  assert.equal(calculateFees(50,10,0.1,'buyer').total,44)
  assert.equal(calculateFees(50,0,0).total,50)
  assert.equal(calculateFees(19.99,0,0.075).total,21.49)
  assert.equal(calculateFees(50,50).total,0)
  assert.throws(()=>calculateFees(50,0,-0.1))
  assert.throws(()=>calculateFees(50,0,1.01))
  assert.throws(()=>calculateFees(50,0,0.1,'invalid'))
})
test('payout deducts commission and verified Mercado Pago fee, preserves unknown',()=>{
  assert.equal(payoutAmount({total:55,platformFee:5,providerFee:2}),48)
  assert.equal(payoutAmount({total:50,platformFee:5,providerFee:2}),43)
  assert.equal(payoutAmount({total:50,platformFee:5,providerFee:null}),null)
  assert.equal(payoutAmount({total:50,platformFee:5,providerFee:2,paymentReview:true}),null)
})
