import test from 'node:test'
import assert from 'node:assert/strict'
import {prepareEventVisual} from '../src/utils/eventVisual.js'
test('save activates experience with logo, respects intro confirmation, and never enables empty intro',()=>{
 const logo='https://example.com/logo.png'
 assert.equal(prepareEventVisual({logo,enabled:false,intro:true,density:8}).enabled,true)
 assert.equal(prepareEventVisual({logo,intro:true}).intro,true)
 assert.equal(prepareEventVisual({logo,intro:false}).intro,false)
 assert.equal(prepareEventVisual({logo:' ',enabled:true,intro:true}).intro,false)
 assert.equal(prepareEventVisual({logo:'',enabled:true,intro:true}).enabled,false)
})
