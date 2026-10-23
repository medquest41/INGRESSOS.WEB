import test from 'node:test'
import assert from 'node:assert/strict'
import {generateReservedUnits} from '../src/utils/reservedUnits.js'
test('generates 15 rooms and 20 tables with exclusive stock, N tickets and unique numbers',()=>{
 const room={kind:'camarote',count:15,start:1,price:1200,wristbands:10},table={kind:'table',count:20,start:1,price:500,wristbands:4}
 const rooms=generateReservedUnits([],room),all=generateReservedUnits(rooms,table)
 assert.equal(all.length,35);assert.equal(new Set(all.map(t=>t.id)).size,35);assert.equal(new Set(all.map(t=>t.name)).size,35)
 assert.ok(all.every(t=>t.type==='camarote'&&t.available===1));assert.equal(all[14].name,'Camarote 15');assert.equal(all[34].name,'Mesa VIP 20');assert.equal(all[34].reservationKind,'table')
 assert.throws(()=>generateReservedUnits(rooms,room),/já existe/);assert.throws(()=>generateReservedUnits([],{...room,price:''}),/preço/);assert.throws(()=>generateReservedUnits([],{...room,wristbands:0}),/ingressos/)
})

import {addReservedCategory,getReservedCategories,unitKind,validateTicketDrafts} from '../src/utils/reservedUnits.js'
test('custom categories preserve legacy units, names, IDs and N QR configuration',()=>{
 const old=generateReservedUnits([],{kind:'camarote',count:1,start:1,price:1200,wristbands:8})
 const {category,event}=addReservedCategory({ticketTypes:old},'Boxes','Box')
 const all=generateReservedUnits(event.ticketTypes,{category,count:3,start:1,price:500,wristbands:10})
 assert.deepEqual(all[0],old[0]);assert.equal(all[3].name,'Box 03');assert.equal(all[3].wristbands,10);assert.equal(all[3].available,1);assert.equal(unitKind(all[3]),category.id)
 assert.equal(getReservedCategories({...event,ticketTypes:all}).length,2);assert.throws(()=>addReservedCategory(event,'boxes','Box'),/já existe/)
 validateTicketDrafts(all);assert.throws(()=>validateTicketDrafts([{...all[3],wristbands:''}]),/informe de 1 a 100/);assert.throws(()=>validateTicketDrafts([{...all[3],price:''}]),/informe o preço/);validateTicketDrafts([{...all[3],price:0}])
})
