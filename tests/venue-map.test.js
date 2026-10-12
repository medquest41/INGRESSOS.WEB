import {test} from 'node:test'
import assert from 'node:assert/strict'
import {venueMapUrl} from '../src/utils/venueMap.js'
test('venue map accepts public HTTPS images and rejects executable or insecure URLs',()=>{
 assert.equal(venueMapUrl(' https://example.test/mapa.png '),'https://example.test/mapa.png')
 assert.equal(venueMapUrl(''), '')
 for(const url of ['javascript:alert(1)','http://example.test/a.png','https://user:pass@example.test/a.png','data:text/html,hi'])assert.throws(()=>venueMapUrl(url))
 assert.throws(()=>venueMapUrl('data:image/png;base64,AA=='))
 assert.equal(venueMapUrl('data:image/png;base64,AA==',{local:true}),'data:image/png;base64,AA==')
})
