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
