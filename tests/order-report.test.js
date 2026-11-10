import test from 'node:test'
import assert from 'node:assert/strict'
import {matchesOrderStatus,reportAmount,reportOrdersHref,reportMetrics,orderFilterStatus} from '../src/utils/orderReport.js'
test('report drilldown matches approved totals and combined cancellation definition',()=>{
 const paid={status:'approved',total:104.5,subtotal:100,discount:5,platformFee:9.5}
 assert.equal(matchesOrderStatus(paid,'paid'),true)
 assert.equal(matchesOrderStatus({...paid,paymentReview:true},'paid'),false)
 for(const status of ['pending','cancelled','refunded'])assert.equal(matchesOrderStatus({status},'paid'),false)
 for(const status of ['cancelled','refunded'])assert.equal(matchesOrderStatus({status},'cancelled_refunded'),true)
 assert.equal(reportAmount(paid,'fees'),9.5);assert.equal(reportAmount(paid,'net'),95);assert.equal(reportAmount(paid,'total'),104.5)
 assert.equal(reportAmount({platformFee:0,fee:10},'fees'),0)
 assert.equal(orderFilterStatus('unknown'),'')
})
test('metric links retain event scope or global scope and identify the corresponding amounts',()=>{
 for(const metric of reportMetrics){const url=new URL(reportOrdersHref('e/1',metric),'https://test.invalid');assert.equal(url.pathname,'/admin/evento/e%2F1/orders');assert.equal(url.searchParams.get('status'),metric.status)}
 const global=new URL(reportOrdersHref('',reportMetrics[1]),'https://test.invalid');assert.equal(global.searchParams.get('tab'),'orders');assert.equal(global.searchParams.get('detail'),'fees')
})
