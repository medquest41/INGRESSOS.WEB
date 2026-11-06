import test from 'node:test'
import assert from 'node:assert/strict'
import {applyTableQuantities,configureNumberedTables} from '../src/utils/numberedTables.js'
import {requiredUnitCategory} from '../src/utils/unitSelection.js'
import {publicTicketOptions} from '../src/utils/ticketPresentation.js'
const source={id:'original-table',type:'camarote',reservationKind:'table',name:'COMBO VIP',price:389,wristbands:4,available:1,active:true,mapX:33,mapY:66}
const initial={id:'e',venueMapImage:'https://example.test/map.png',ticketTypes:[source,{id:'room',type:'camarote',name:'Camarote 01',unitNumber:1,available:1,price:1500,wristbands:15}]}
const ids=()=>{let n=0;return()=>`id-${++n}`}
test('saving a quantity draft creates sixteen tables once and clears pending fields',()=>{
 const input={...initial,ticketTypes:[{...source,tableQuantityDraft:'16',tableStartDraft:'1'},initial.ticketTypes[1]]}
 const output=applyTableQuantities(input),parent=output.ticketTypes.find(t=>t.numberedCategoryId)
 assert.equal(output.ticketTypes.filter(t=>t.tableOfferId===parent.id).length,16)
 assert.ok(output.ticketTypes.every(t=>!Object.hasOwn(t,'tableQuantityDraft')&&!Object.hasOwn(t,'tableStartDraft')))
 assert.equal(applyTableQuantities(output),output)
 assert.throws(()=>applyTableQuantities({...initial,ticketTypes:[{...source,tableQuantityDraft:''}]}),error=>error.field==='tableQuantityDraft'&&error.ticketIndex===0)
})
test('quantity creates ten exclusive tables and preserves original identity, stock and map',()=>{
 const before=JSON.stringify(initial),{event,parentId}=configureNumberedTables(initial,source.id,{count:10},ids())
 const tables=event.ticketTypes.filter(t=>t.tableOfferId===parentId),parent=event.ticketTypes.find(t=>t.id===parentId)
 assert.equal(tables.length,10);assert.equal(tables[0].id,source.id);assert.equal(tables[0].mapX,33);assert.equal(event.venueMapImage,initial.venueMapImage)
 assert.ok(event.ticketTypes.indexOf(tables[0])<event.ticketTypes.indexOf(parent))
 assert.ok(tables.every(t=>t.available===1&&t.wristbands===4&&t.price===389));assert.equal(parent.active,false)
 assert.equal(new Set(tables.map(t=>t.id)).size,10);assert.equal(new Set(tables.map(t=>t.name)).size,10)
 assert.equal(requiredUnitCategory(event,parent).id,parent.numberedCategoryId);assert.deepEqual(publicTicketOptions(event).map(t=>t.id),[parentId,'unit-category:camarote']);assert.equal(JSON.stringify(initial),before)
 assert.equal(tables[1].mapPositioned,false)
})
test('reapplying is idempotent, growth preserves all existing edits and shrinking cannot erase sold stock',()=>{
 let next=configureNumberedTables(initial,source.id,{count:10},ids());const parentId=next.parentId
 const first=next.event.ticketTypes.find(t=>t.id===source.id);first.active=false;first.price=450;first.mapX=42
 const repeat=configureNumberedTables(next.event,parentId,{count:10},ids());assert.deepEqual(repeat.event,next.event)
 const grown=configureNumberedTables(next.event,parentId,{count:12},(()=>{let n=100;return()=>`id-${++n}`})())
 assert.equal(grown.event.ticketTypes.filter(t=>t.tableOfferId===parentId).length,12);assert.deepEqual(grown.event.ticketTypes.find(t=>t.id===source.id),first)
 assert.throws(()=>configureNumberedTables(grown.event,parentId,{count:9}),/preservadas/)
 assert.throws(()=>configureNumberedTables(grown.event,parentId,{count:12,start:2}),/preservadas/)
 for(const count of ['',0,101,2.5])assert.throws(()=>configureNumberedTables(initial,source.id,{count}),/Informe/)
})

test('choosing no numbering clears generation draft and preserves the original unit',()=>{const input={...initial,ticketTypes:[{...source,tableQuantityDraft:undefined,tableStartDraft:undefined},initial.ticketTypes[1]]};const result=applyTableQuantities(input);assert.equal(result,input);assert.equal(result.ticketTypes[0].id,'original-table');assert.equal(result.ticketTypes.length,2);assert.equal(result.ticketTypes[0].wristbands,4)})
