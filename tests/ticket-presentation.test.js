import test from 'node:test'
import assert from 'node:assert/strict'
import {publicTicketOptions,ticketHighlightLabel} from '../src/utils/ticketPresentation.js'
test('new groups and unnumbered units stay visible; numbered units use map and retired history stays hidden',()=>{
 const ticketTypes=[{id:'individual',type:'individual'},{id:'group',type:'camarote',reservationKind:'group'},{id:'unit',type:'camarote'},{id:'room',type:'camarote',unitNumber:15},{id:'table',type:'camarote',reservationKind:'table',unitNumber:1},{id:'old',type:'individual',retiredForSales:true}]
 assert.deepEqual(publicTicketOptions({ticketTypes}).map(t=>t.id),['individual','group','unit'])
})
test('highlight is optional and limited to known editorial choices',()=>{
 assert.equal(ticketHighlightLabel({highlight:'popular'}),'Mais vendido')
 assert.equal(ticketHighlightLabel({highlight:'value'}),'Melhor custo-benefício')
 assert.equal(ticketHighlightLabel({}),'')
 assert.equal(ticketHighlightLabel({highlight:'<script>'}),'')
})
