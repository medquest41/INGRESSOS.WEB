import test from 'node:test'
import assert from 'node:assert/strict'
import {createDemoLocalSale,localSaleBuyer,localSaleTerms} from '../src/utils/localSale.js'
import {payoutAmount} from '../src/utils/fees.js'
const admin={id:'a',role:'admin',active:true},event={id:'e',published:true,organizerId:'org',feeRate:.1,feePayer:'buyer',ticketTypes:[{id:'t',name:'Mesa 01',type:'camarote',reservationKind:'table',wristbands:4,available:1,price:389}]}
test('optional identity, cash zero fee, individual originals and retry use one order',()=>{
 const state={events:[event],orders:[]},input={eventId:'e',ticketId:'t',quantity:1,buyer:{},requestId:crypto.randomUUID(),received:true,eligible:true,expectedCents:38900}
 const order=createDemoLocalSale(state,admin,input)
 assert.equal(order.buyer.name,'Venda local');assert.equal(order.buyer.cpf,null);assert.equal(order.total,389);assert.equal(order.platformFee,0);assert.equal(order.ticketCodes.length,4);assert.equal(new Set(order.ticketCodes.map(t=>t.code)).size,4);assert.equal(payoutAmount(order),null)
 assert.equal(createDemoLocalSale(state,admin,input),order);assert.equal(state.orders.length,1)
 assert.throws(()=>createDemoLocalSale(state,admin,{...input,buyer:{name:'Outro'}}),/outros dados/)
 assert.throws(()=>createDemoLocalSale(state,admin,{...input,requestId:crypto.randomUUID()}),/Estoque/)
})
test('only responsible manager, explicit receipt, stock and optional data validation',()=>{
 const input={eventId:'e',ticketId:'t',quantity:1,buyer:{},requestId:crypto.randomUUID(),received:true,eligible:true,expectedCents:38900},state={events:[event],orders:[]}
 for(const user of [{id:'c',role:'cliente',active:true},{id:'f',role:'financeiro',active:true},{id:'x',role:'organizador',organizerId:'other',active:true},{...admin,active:false}])assert.throws(()=>createDemoLocalSale(state,user,input),/organizador/)
 assert.throws(()=>createDemoLocalSale(state,admin,{...input,received:false}),/Confirme/)
 assert.throws(()=>createDemoLocalSale(state,admin,{...input,expectedCents:1}),/preço/)
 assert.throws(()=>localSaleBuyer({cpf:'11111111111'}),/CPF/)
 assert.throws(()=>localSaleBuyer({email:'invalido'}),/e-mail/)
 assert.equal(localSaleBuyer({name:'  Teste  ',cpf:'529.982.247-25'}).cpf,'52998224725')
})

test('sale name and amount can change without modifying the numbered catalog unit',()=>{
 const state={events:[structuredClone(event)],orders:[]},ticket=state.events[0].ticketTypes[0]
 const input={eventId:'e',ticketId:'t',quantity:1,buyer:{},requestId:crypto.randomUUID(),received:true,eligible:true,expectedCents:30000,saleOverrides:{name:'Mesa especial',unitPriceCents:30000}}
 const order=createDemoLocalSale(state,admin,input)
 assert.equal(order.total,300);assert.equal(order.ticketName,'Mesa especial');assert.equal(order.ticketCodes.length,4)
 assert.equal(ticket.price,389);assert.equal(ticket.name,'Mesa 01');assert.equal(order.localCatalogPriceCents,38900)
 assert.equal(createDemoLocalSale(state,admin,input).id,order.id)
 assert.throws(()=>createDemoLocalSale(state,admin,{...input,saleOverrides:{...input.saleOverrides,name:'Outro nome'}}),/outros dados/)
 assert.throws(()=>localSaleTerms(ticket,{name:'',unitPriceCents:30000}),/nome/)
 assert.throws(()=>localSaleTerms(ticket,{name:'Nome',unitPriceCents:-1}),/valor/)
})
