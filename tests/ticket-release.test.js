import test from 'node:test'
import assert from 'node:assert/strict'
import {scheduledTicketRelease} from '../src/utils/ticketRelease.js'
const now=Date.parse('2026-11-06T12:00:00Z'),ticket={active:true,available:50,startsAt:'2026-11-10T21:00:00Z'}
test('future release uses the saved instant and Brasilia time',()=>{
 const release=scheduledTicketRelease(ticket,now);assert.equal(release.iso,'2026-11-10T21:00:00.000Z');assert.match(release.label,/10 de novembro de 2026/);assert.match(release.label,/18:00/)
})
test('no invented date for disabled, archived, empty stock, invalid or elapsed schedules',()=>{
 for(const patch of [{active:false},{retiredForSales:true},{available:0},{startsAt:''},{startsAt:'bad'},{startsAt:'2026-11-05T12:00:00Z'},{endsAt:'2026-11-09T12:00:00Z'}])assert.equal(scheduledTicketRelease({...ticket,...patch},now),null)
 assert.equal(scheduledTicketRelease(ticket,Date.parse(ticket.startsAt)),null)
})

import {publicTicketRelease} from '../src/utils/ticketRelease.js'
test('category shows earliest date only while every active unit is future',()=>{const units=[1,2].map(n=>({id:'c'+n,type:'camarote',name:'Camarote 0'+n,reservationKind:'camarote',unitNumber:n,active:true,available:1,remaining:1,startsAt:'2026-11-'+(n===1?'10':'11')+'T21:00:00Z'}));const selector={id:'alias',type:'individual',name:'CAMAROTE',available:16};const event={ticketTypes:[selector,...units]};assert.equal(publicTicketRelease(event,selector,now).iso,'2026-11-10T21:00:00.000Z');assert.equal(publicTicketRelease(event,selector,Date.parse(units[0].startsAt)),null);assert.equal(publicTicketRelease({ticketTypes:[selector,{...units[0],active:false}]},selector,now),null);assert.equal(publicTicketRelease({ticketTypes:[selector,{...units[0],remaining:0}]},selector,now),null);assert.equal(publicTicketRelease({ticketTypes:[selector,{...units[0],startsAt:null},units[1]]},selector,now),null)})
