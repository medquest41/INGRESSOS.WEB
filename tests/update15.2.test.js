import test from 'node:test'
import assert from 'node:assert/strict'
import { authDestination, loginPath } from '../src/utils/authReturn.js'

test('15.2 general authentication and stale ticket state always select public events', () => {
  for (const from of [undefined, '/ingressos', '/ingressos?payment=old', '/meus-ingressos']) {
    assert.equal(authDestination('', from), '/eventos')
    assert.equal(authDestination('?returnTo=invalid', from), '/eventos')
  }
})
test('15.2 explicit tickets and event context survive authentication', () => {
  for (const target of ['/ingressos', '/meus-ingressos', '/checkout?event=abc', '/evento/festa?ref=campanha', '/admin/evento/festa/vendas']) {
    assert.equal(authDestination(loginPath(target).split('?')[1]), target)
  }
  assert.equal(authDestination('', '/evento/festa?ref=campanha'), '/evento/festa?ref=campanha')
})
