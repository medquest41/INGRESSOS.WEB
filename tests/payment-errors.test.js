import test from 'node:test'
import assert from 'node:assert/strict'
import {paymentErrorMessage} from '../src/utils/paymentErrors.js'
test('provider expiration errors are explained in Portuguese without asking for a second payment',()=>{const message=paymentErrorMessage('The following parameters must be valid date and format: date_of_expiration');assert.match(message,/prazo foi recusado/);assert.match(message,/não pague de novo/);assert.doesNotMatch(message,/date_of_expiration/);assert.equal(paymentErrorMessage('A reserva expirou.'),'A reserva expirou.')})
