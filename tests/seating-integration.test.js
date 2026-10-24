import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
test('real event places seating after attractions and before sale section',async()=>{
 const source=await readFile(new URL('../src/pages/Evento.jsx',import.meta.url),'utf8')
 assert.ok(source.indexOf('<AttractionList')<source.indexOf('<EventSeating'))
 assert.ok(source.indexOf('<EventSeating')<source.indexOf('<section className="ticket-section"'))
})
test('real checkout includes selected-unit review before buyer form',async()=>{
 const source=await readFile(new URL('../src/pages/Checkout.jsx',import.meta.url),'utf8')
 assert.ok(source.indexOf('<CheckoutSeating')<source.indexOf('<form ref={buyerForm}'))
})
