import test from 'node:test'
import assert from 'node:assert/strict'
import {editTicketDraft} from '../src/utils/groupUpgrade.js'
test('legacy sale becomes a new group SKU without reducing historical stock or changing old QR',()=>{
 const original={id:'legacy',name:'Camarote',type:'individual',price:100,available:50,active:true}
 const event={ticketTypes:[{...original,reservationKind:'group'}]}
 const orders=[{id:'paid',ticketId:'legacy',quantity:3,ticketCodes:[{code:'original'}]}]
 const options={originalTickets:[original],orders,id:()=> 'new-group'}
 let next=editTicketDraft(event,0,'type','camarote',options)
 assert.equal(next.ticketTypes[0].id,'new-group');assert.equal(next.ticketTypes[0].available,1)
 assert.deepEqual(next.ticketTypes[1],{...original,active:false,retiredForSales:true})
 next=editTicketDraft(next,0,'wristbands','15',options)
 assert.equal(next.ticketTypes[0].wristbands,15);assert.equal(next.ticketTypes.length,2)
 assert.equal(orders[0].ticketId,'legacy');assert.equal(orders[0].ticketCodes[0].code,'original');assert.equal(original.active,true)
})
test('unsold or existing numbered rooms never fork automatically',()=>{
 for(const original of [{id:'unsold',type:'individual',available:50},{id:'room',type:'camarote',available:1,wristbands:10},{id:'numbered',type:'individual',unitNumber:15,available:1}]){
  const next=editTicketDraft({ticketTypes:[original]},0,'type','camarote',{originalTickets:[original],orders:original.id==='unsold'?[]:[{ticketId:original.id}],id:()=> 'unexpected'})
  assert.equal(next.ticketTypes.length,1);assert.equal(next.ticketTypes[0].id,original.id)
 }
})

test('editing or clearing a numbered offer highlight updates its siblings only',()=>{
 const event={ticketTypes:[{id:'parent',numberedCategoryId:'a',highlight:''},{id:'m1',reservationCategoryId:'a',highlight:''},{id:'m2',reservationCategoryId:'a',highlight:''},{id:'other',reservationCategoryId:'b',highlight:'popular'}]}
 const changed=editTicketDraft(event,1,'highlight','value');assert.deepEqual(changed.ticketTypes.map(t=>t.highlight),['value','value','value','popular']);const cleared=editTicketDraft(changed,0,'highlight','');assert.deepEqual(cleared.ticketTypes.map(t=>t.highlight),['','','','popular']);assert.equal(event.ticketTypes[1].highlight,'')
})

test('custom offer text is propagated and clearing does not change other offers',()=>{const event={ticketTypes:[{id:'m1',reservationCategoryId:'a',highlight:'custom'},{id:'m2',reservationCategoryId:'a',highlight:'custom'},{id:'other',reservationCategoryId:'b',highlight:'value'}]};const next=editTicketDraft(event,0,'highlightText','Grupo de amigos');assert.equal(next.ticketTypes[1].highlightText,'Grupo de amigos');assert.equal(next.ticketTypes[2].highlightText,undefined);assert.equal(editTicketDraft(next,1,'highlightText','').ticketTypes[0].highlightText,'')})
