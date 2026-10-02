/* oxlint-disable react/only-export-components -- Context provider and shared hook are intentionally colocated. */
import { createContext, useContext, useEffect, useState } from 'react'
import { defaultEvents } from '../data/defaultEvents'
import { getEventSlug } from '../utils/eventSlug'
import { useAuth } from './AuthStore'
import { canManage, ownsEvent, ownsOrder, quote, validateBuyer, checkTicket, approved, remaining } from '../utils/commerce'
import { mockPayment } from '../services/payment'
const EventContext = createContext(null)
const KEY = 'ingressos_platform_v2'
function read(key, fallback) {
  const raw = localStorage.getItem(key)
  if (!raw) return fallback
  try { return JSON.parse(raw) } catch { throw new Error('Dados locais inválidos. Preserve o armazenamento e restaure um backup: ' + key) }
}
function normalize(event) {
  return { ...event, id: String(event.id), slug: getEventSlug(event), archived: Boolean(event.archived), published: event.published !== false, organizerId: event.organizerId || 'org-main', organizerName: event.organizerName || 'Organização principal', ticketTypes: (event.ticketTypes || []).map(t => ({ ...t, id: String(t.id), price: Number(t.price) || 0, available: Number(t.available) || 0 })) }
}
function load() {
  return read(KEY, null) || { events: read('ingressos_events_v1', defaultEvents).map(normalize), orders: read('ingressos_orders_v1', []), coupons: [], history: [] }
}
async function transaction(callback) {
  if (!navigator.locks) throw new Error('Use um navegador atualizado em localhost ou HTTPS para comprar e fazer check-in.')
  return navigator.locks.request('ingressos-platform', callback)
}
export function EventProvider({ children }) {
  const { currentUser } = useAuth()
  const [data, setData] = useState(load)
  useEffect(() => {
    const sync = e => { if (e.key === KEY) setData(load()) }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])
  async function mutate(action, eventId, callback) {
    return transaction(async () => {
      const fresh = load()
      const result = await callback(fresh)
      fresh.history.unshift({ id: crypto.randomUUID(), at: new Date().toISOString(), action, eventId, actor: currentUser?.name || 'Visitante' })
      localStorage.setItem(KEY, JSON.stringify(fresh))
      setData(fresh)
      return result
    })
  }
  async function saveEvent(input) {
    return mutate('Evento salvo', input.id, fresh => {
      const old = fresh.events.find(e => e.id === input.id)
      if (!canManage(currentUser, old || input)) throw new Error('Sem permissão para editar este evento.')
      const event = normalize(input)
      if (currentUser.role !== 'admin') { event.organizerId = currentUser.organizerId; event.organizerName = currentUser.organizerName }
      if (!event.title?.trim() || !event.slug) throw new Error('Informe o nome e o slug do evento.')
      if (fresh.events.some(e => e.id !== event.id && e.slug === event.slug)) throw new Error('Este link já pertence a outro evento.')
      if (new Set(event.ticketTypes.map(t => t.id)).size !== event.ticketTypes.length || event.ticketTypes.some(t => !t.name?.trim() || !Number.isFinite(t.price) || t.price < 0 || !Number.isInteger(t.available) || t.available < 0)) throw new Error('Verifique nomes, preços e quantidades dos lotes.')
      for (const ticket of old?.ticketTypes || []) {
        const sold = fresh.orders.filter(o => approved(o) && o.eventId === event.id && o.ticketId === ticket.id).reduce((n, o) => n + o.quantity, 0)
        const updated = event.ticketTypes.find(t => t.id === ticket.id)
        if (sold && (!updated || updated.available < sold)) throw new Error('Não remova lotes vendidos nem reduza a capacidade abaixo das vendas.')
      }
      fresh.events = old ? fresh.events.map(e => e.id === event.id ? event : e) : [event, ...fresh.events]
    })
  }
  async function placeOrder(input) {
    if (!currentUser) throw new Error('Entre na sua conta para comprar.')
    return mutate('Pedido aprovado (simulação)', input.eventId, async fresh => {
      const duplicate = fresh.orders.find(o => o.idempotencyKey === input.idempotencyKey && o.userId === currentUser.id)
      if (duplicate) return duplicate
      const event = fresh.events.find(e => e.id === input.eventId)
      const ticket = event?.ticketTypes.find(t => t.id === input.ticketId)
      const buyer = { ...input.buyer, email: currentUser.email }
      validateBuyer(buyer)
      const totals = quote(event, ticket, input.quantity, input.coupon, fresh.coupons, fresh.orders)
      const payment = await mockPayment(input.method, input.outcome)
      const order = { id: 'PED-' + crypto.randomUUID(), idempotencyKey: input.idempotencyKey, createdAt: new Date().toISOString(), userId: currentUser.id, eventId: event.id, organizerId: event.organizerId, eventTitle: event.title, eventImage: event.image, eventDate: event.date, eventTime: event.time, ticketId: ticket.id, ticketName: ticket.name, sector: ticket.sector || ticket.name, batch: ticket.batch, unitLabel: ticket.type === 'table' ? 'Mesa/camarote — entrada única do grupo' : 'Individual', quantity: input.quantity, buyer, method: input.method, source: String(input.source || 'direto').slice(0, 120), ...totals, ...payment, ticketCodes: Array.from({ length: input.quantity }, () => ({ code: 'ING-' + crypto.randomUUID().toUpperCase(), used: false })) }
      fresh.orders.unshift(order)
      return order
    })
  }
  async function markTicketUsed(code) {
    return transaction(() => {
      const fresh = load()
      const result = checkTicket(fresh.orders, fresh.events, currentUser, code.trim())
      if (result.found && !result.alreadyUsed && !result.cancelled) {
        result.ticket.used = true
        result.ticket.usedAt = new Date().toISOString()
        result.ticket.usedBy = currentUser.id
        fresh.history.unshift({ id: crypto.randomUUID(), at: result.ticket.usedAt, eventId: result.order.eventId, action: 'Check-in confirmado', actor: currentUser.name })
        localStorage.setItem(KEY, JSON.stringify(fresh))
        setData(fresh)
      }
      return result
    })
  }
  async function cancelOrder(id) {
    return mutate('Pedido cancelado (simulação)', data.orders.find(o => o.id === id)?.eventId, fresh => {
      const order = fresh.orders.find(o => o.id === id)
      if (!order || !['admin', 'organizador', 'financeiro'].includes(currentUser?.role) || !ownsEvent(currentUser, fresh.events.find(e => e.id === order.eventId))) throw new Error('Sem permissão para cancelar.')
      if (order.ticketCodes.some(t => t.used)) throw new Error('Pedido com entrada utilizada não pode ser cancelado.')
      order.status = 'cancelled'
      order.cancelledAt = new Date().toISOString()
    })
  }
  async function saveCoupon(coupon) {
    return mutate('Cupom atualizado', coupon.eventId, fresh => {
      if (!canManage(currentUser, fresh.events.find(e => e.id === coupon.eventId))) throw new Error('Sem permissão.')
      const item = { ...coupon, code: coupon.code.trim().toUpperCase(), value: Number(coupon.value), limit: Number(coupon.limit) || 0, id: coupon.id || crypto.randomUUID() }
      if (!/^[A-Z0-9_-]{2,30}$/.test(item.code) || !Number.isFinite(item.value) || item.value <= 0 || !['percent', 'fixed'].includes(item.type) || (item.type === 'percent' && item.value > 100) || !Number.isInteger(item.limit) || item.limit < 0) throw new Error('Informe código, valor e limite válidos.')
      if (fresh.coupons.some(c => c.id !== item.id && c.eventId === item.eventId && c.code === item.code)) throw new Error('Cupom já cadastrado neste evento.')
      fresh.coupons = [item, ...fresh.coupons.filter(c => c.id !== item.id)]
    })
  }
  const events = data.events.filter(e => (e.published && !e.archived) || ownsEvent(currentUser, e))
  const orders = data.orders.filter(o => ownsOrder(currentUser, o) || (['admin', 'organizador', 'financeiro', 'checkin'].includes(currentUser?.role) && ownsEvent(currentUser, data.events.find(e => e.id === o.eventId))))
  return <EventContext.Provider value={{ events, orders, saveEvent, placeOrder, cancelOrder, markTicketUsed, saveCoupon, coupons: data.coupons.filter(c => ownsEvent(currentUser, data.events.find(e => e.id === c.eventId))), history: data.history.filter(h => currentUser?.role === 'admin' || ownsEvent(currentUser, data.events.find(e => e.id === h.eventId))), getRemaining: (event, ticket) => remaining(event, ticket, data.orders), getQuote: (event, ticket, quantity, coupon) => quote(event, ticket, quantity, coupon, data.coupons, data.orders) }}>{children}</EventContext.Provider>
}
export function useEventStore() {
  const ctx = useContext(EventContext)
  if (!ctx) throw new Error('useEventStore precisa estar dentro de EventProvider')
  return ctx
}
