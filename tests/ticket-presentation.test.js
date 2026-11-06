import test from 'node:test'
import assert from 'node:assert/strict'
import {publicTicketOptions,ticketHighlightLabel} from '../src/utils/ticketPresentation.js'
test('new groups and unnumbered units stay visible; numbered units use map and retired history stays hidden',()=>{
 const ticketTypes=[{id:'individual',type:'individual'},{id:'group',type:'camarote',reservationKind:'group'},{id:'unit',type:'camarote'},{id:'room',type:'camarote',unitNumber:15},{id:'table',type:'camarote',reservationKind:'table',unitNumber:1},{id:'old',type:'individual',retiredForSales:true}]
 assert.deepEqual(publicTicketOptions({ticketTypes}).map(t=>t.id),['individual','group','unit','unit-category:camarote','unit-category:table'])
})
test('highlight is optional and limited to known editorial choices',()=>{
 assert.equal(ticketHighlightLabel({highlight:'popular'}),'Mais vendido')
 assert.equal(ticketHighlightLabel({highlight:'value'}),'Melhor custo-benefício')
 assert.equal(ticketHighlightLabel({}),'')
 assert.equal(ticketHighlightLabel({highlight:'<script>'}),'')
})

test('numbered tables remain discoverable when public API omits inactive parent',()=>{
 const tables=Array.from({length:16},(_,i)=>({id:'mesa-'+(i+1),name:'COMBO — Mesa '+(i+1),type:'camarote',reservationKind:'table',reservationCategoryId:'tables-offer',reservationCategoryName:'COMBO VIP',tableOfferId:'offer',unitNumber:i+1,active:true,wristbands:4,available:1,price:389}))
 const event={ticketTypes:tables}
 const cards=publicTicketOptions(event)
 assert.equal(cards.length,1);assert.equal(cards[0].name,'COMBO VIP');assert.equal(cards[0].numberedCategoryId,'tables-offer');assert.equal(cards[0].type,'category')
 assert.equal(publicTicketOptions({ticketTypes:[...tables,{id:'offer',name:'COMBO VIP',numberedCategoryId:'tables-offer',active:false}]}).length,1)
 assert.equal(publicTicketOptions({ticketTypes:tables.map(t=>({...t,retiredForSales:true}))}).length,0)
 assert.equal(event.ticketTypes.length,16);assert.equal(event.ticketTypes[0].id,'mesa-1')
})
