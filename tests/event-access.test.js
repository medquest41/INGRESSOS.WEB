import test from 'node:test'
import assert from 'node:assert/strict'
import {eventAdminRole} from '../src/utils/eventAccess.js'
test('event-only check-in preserves native management and never grants sales on an invited event',()=>{
 const user={role:'organizador',organizerId:'own'},own={id:'a',organizerId:'own'},invited={id:'b',organizerId:'other'},summary=[{event_id:'a'},{event_id:'b'}]
 assert.equal(eventAdminRole(user,own,summary),'organizador')
 assert.equal(eventAdminRole(user,invited,summary),'checkin')
 assert.equal(eventAdminRole(user,invited,[]),'organizador') // The event filter and server then deny this event.
 assert.equal(eventAdminRole({...user,role:'financeiro'},invited,summary),'checkin')
 assert.equal(eventAdminRole({...user,role:'admin'},invited,summary),'admin')
 assert.equal(eventAdminRole(user,undefined,summary),'organizador')
})
