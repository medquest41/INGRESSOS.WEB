import { createHmac, timingSafeEqual } from 'node:crypto'
import { Buffer } from 'node:buffer'
// Server-only adapter. Never import this file from src/.
export function verifyWebhook({ signature, requestId, dataId, secret, now = Date.now() }) {
  if (!signature || !requestId || !dataId || !secret) return false
  const parts = Object.fromEntries(signature.split(',').map(part => part.trim().split('=')))
  if (!/^\d+$/.test(parts.ts || '') || !/^[a-f0-9]{64}$/i.test(parts.v1 || '')) return false
  const timestamp = Number(parts.ts)
  const ms = timestamp < 1e12 ? timestamp * 1000 : timestamp
  if (Math.abs(now - ms) > 300000) return false
  const manifest = `id:${String(dataId).toLowerCase()};request-id:${requestId};ts:${parts.ts};`
  const expected = createHmac('sha256', secret).update(manifest).digest()
  return timingSafeEqual(expected, Buffer.from(parts.v1, 'hex'))
}
export async function getVerifiedPayment(paymentId, accessToken) {
  if (!accessToken || !/^\d+$/.test(String(paymentId))) throw new Error('Configure o token do servidor e um ID válido.')
  const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error(`Falha ao consultar pagamento: ${response.status}`)
  return response.json()
}
export async function createCheckoutPreference({ accessToken, order, returnUrl, webhookUrl }) {
  if (!accessToken || !returnUrl?.startsWith('https://') || !webhookUrl?.startsWith('https://')) throw new Error('Checkout real requer configuração HTTPS e credenciais no servidor.')
  // order must come from the authoritative database after stock reservation, never from request totals.
  if (!Number.isInteger(order.totalCents) || order.totalCents <= 0 || !order.id) throw new Error('Pedido inválido.')
  const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method:'POST', signal:AbortSignal.timeout(15000), headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},
    body:JSON.stringify({external_reference:order.id,items:[{id:order.id,title:'Ingressos — '+order.id,quantity:1,currency_id:'BRL',unit_price:order.totalCents/100}],back_urls:{success:returnUrl,pending:returnUrl,failure:returnUrl},notification_url:webhookUrl,auto_return:'approved',...(order.expiresAt?{expires:true,expiration_date_from:new Date().toISOString(),expiration_date_to:order.expiresAt}:{})})
  })
  if (!response.ok) throw new Error(`Falha ao criar checkout: ${response.status}`)
  return response.json()
}
