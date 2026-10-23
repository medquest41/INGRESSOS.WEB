import test from 'node:test'
import assert from 'node:assert/strict'
import {printTicket,printOrderTickets} from '../src/utils/ticketPrint.js'
test('PDF of room includes ten distinct eligible tickets, excludes other orders and cleans selection',()=>{
 const classes=()=>{const set=new Set();return {add:v=>set.add(v),remove:v=>set.delete(v),contains:v=>set.has(v)}}
 const cards=Array.from({length:10},(_,i)=>({dataset:{orderId:'room',code:'qr-'+i,printable:'true'},classList:classes()}))
 cards.push({dataset:{orderId:'other',code:'other',printable:'true'},classList:classes()},{dataset:{orderId:'room',code:'cancelled',printable:'false'},classList:classes()})
 const originalDocument=globalThis.document,originalWindow=globalThis.window,listeners=new Map();let prints=0
 globalThis.document={body:{classList:classes()},querySelectorAll:()=>cards}
 globalThis.window={addEventListener:(n,f)=>listeners.set(n,f),removeEventListener:n=>listeners.delete(n),print:()=>prints++}
 try{
 printOrderTickets('room')
 assert.equal(cards.filter(c=>c.classList.contains('selected-print16')).length,10)
 assert.equal(cards[10].classList.contains('selected-print16'),false)
 assert.equal(cards[11].classList.contains('selected-print16'),false)
 listeners.get('afterprint')();assert.equal(cards.some(c=>c.classList.contains('selected-print16')),false)
 printTicket('qr-4');assert.equal(cards.filter(c=>c.classList.contains('selected-print16')).length,1)
 listeners.get('afterprint')();printOrderTickets('missing');assert.equal(prints,2)
 }finally{globalThis.document=originalDocument;globalThis.window=originalWindow}
})
