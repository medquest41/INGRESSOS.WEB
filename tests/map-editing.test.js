import test from 'node:test'
import assert from 'node:assert/strict'
import {moveMarker,nudgeMarker,mapCoordinate,markerSize} from '../src/utils/mapEditing.js'
import {prepareMapItems} from '../src/utils/mapItems.js'
test('drag retains fractional coordinates and clamps only to the map bounds',()=>{
 assert.deepEqual(moveMarker({x:20,y:30},12.5,.25,{width:1000,height:500}),{x:21.25,y:30.05})
 assert.deepEqual(moveMarker({x:99,y:1},300,-300,{width:500,height:500}),{x:100,y:0})
 assert.equal(mapCoordinate(55.123456),55.123)
})
test('keyboard uses rendered map pixels: 1, shift 10 and alt quarter pixel',()=>{
 const p={x:50,y:50},rect={width:1000,height:500}
 assert.deepEqual(nudgeMarker(p,'ArrowRight',rect),{x:50.1,y:50})
 assert.deepEqual(nudgeMarker(p,'ArrowUp',rect,{shiftKey:true}),{x:50,y:48})
 assert.deepEqual(nudgeMarker(p,'ArrowLeft',rect,{altKey:true}),{x:49.975,y:50})
 assert.equal(nudgeMarker(p,'Enter',rect),null)
 assert.equal(markerSize(3.5),3.5);assert.equal(markerSize(-1),5)
})
test('map menu continues an existing category without overwriting old units',()=>{
 const old={id:'old',type:'camarote',reservationKind:'table',name:'Mesa VIP 20',unitNumber:20,wristbands:4,mapX:12.345,mapY:67.89}
 let counter=0
 const result=prepareMapItems({ticketTypes:[old]},{name:'Mesas VIP',count:3,price:'350',wristbands:'4',start:'',size:3.5},()=>String(++counter))
 assert.equal(result.newCategory,false);assert.deepEqual(result.units.map(t=>t.unitNumber),[21,22,23])
 assert.equal(result.units[0].name,'Mesa VIP 21');assert.ok(result.units.every(t=>t.type==='camarote'&&t.available===1&&t.wristbands===4&&t.mapSize===3.5))
 assert.equal(old.mapX,12.345);assert.equal(old.unitNumber,20)
})
test('new map category requires valid sale configuration and rejects duplicates',()=>{
 const input={name:'Mesas VIP',prefix:'Mesa VIP',count:2,price:'350',wristbands:'4',start:'',size:5}
 let counter=0;const result=prepareMapItems({ticketTypes:[]},input,()=>String(++counter))
 assert.equal(result.newCategory,true);assert.deepEqual(result.units.map(t=>t.name),['Mesa VIP 01','Mesa VIP 02'])
 for(const patch of [{count:0},{price:''},{wristbands:0},{size:99}])assert.throws(()=>prepareMapItems({ticketTypes:[]},{...input,...patch}))
 assert.throws(()=>prepareMapItems({ticketTypes:result.units,reservationCategories:[result.category]},{...input,start:1}),/já existe/)
})
