import { calculateFees } from './fees.js'
export const money = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100
export const ownsEvent = (user, event) => Boolean(user && event && (user.role === 'admin' || (user.role !== 'cliente' && user.organizerId && user.organizerId === event.organizerId)))
export const canManage = (user, event) => ['admin', 'organizador'].includes(user?.role) && ownsEvent(user, event)
export const approved = order => order.status === 'approved' && !order.paymentReview
export const ownsOrder = (user, order) => Boolean(user && (order.userId ? order.userId === user.id || (!user.guest&&order.status==='approved'&&!order.paymentReview&&order.buyer?.email?.trim().toLowerCase()===user.email?.trim().toLowerCase()) : order.buyer?.email?.trim().toLowerCase() === user.email))
export function validCPF(value) {
  const cpf = String(value).replace(/\D/g, '')
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1+$/.test(cpf)) return false
  return [9, 10].every(length => {
    const sum = [...cpf.slice(0, length)].reduce((total, digit, i) => total + Number(digit) * (length + 1 - i), 0)
    return Number(cpf[length]) === ((sum * 10) % 11) % 10
  })
}
export function validateBuyer(buyer) {
  if (!buyer.name?.trim() || buyer.name.trim().length > 120) throw new Error('Informe seu nome.')
  if (!validCPF(buyer.cpf)) throw new Error('Informe um CPF válido.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyer.email || '')) throw new Error('Informe um e-mail válido.')
  if (!/^\d{10,13}$/.test(String(buyer.phone).replace(/\D/g, ''))) throw new Error('Informe telefone com DDD.')
  const date = new Date(`${buyer.birthDate}T12:00:00`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(buyer.birthDate || '') || !Number.isFinite(date.getTime()) || date > new Date() || date.getFullYear() < 1900 || date.toISOString().slice(0, 10) !== buyer.birthDate) throw new Error('Informe uma data de nascimento válida.')
}
export function remaining(event, ticket, orders) {
  return Math.max(0, Number(ticket.available) - orders.filter(order => (approved(order)||!order.status) && String(order.eventId) === String(event.id) && order.ticketId === ticket.id).reduce((sum, order) => sum + Number(order.quantity), 0))
}
export function quote(event, ticket, quantity, couponCode, coupons, orders) {
  if (!event?.published || event.archived || !ticket) throw new Error('Este ingresso não está disponível para compra.')
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) throw new Error('Escolha entre 1 e 10 unidades.')
  if (quantity > remaining(event, ticket, orders)) throw new Error('Quantidade indisponível. Atualize sua seleção.')
  const subtotal = money(ticket.price * quantity)
  let discount = 0
  const code = String(couponCode || '').trim().toUpperCase()
  if (code) {
    const coupon = coupons.find(item => item.code === code && item.eventId === event.id && item.active !== false)
    if (!coupon || (coupon.expiresAt && coupon.expiresAt < new Date().toISOString().slice(0, 10)) || (coupon.limit > 0 && orders.filter(order => (approved(order)||!order.status) && order.coupon === code && order.eventId === event.id).length >= coupon.limit)) throw new Error('Cupom inválido, expirado ou esgotado.')
    discount = money(Math.min(subtotal, coupon.type === 'fixed' ? coupon.value : subtotal * coupon.value / 100))
  }
  return { subtotal, discount, ...calculateFees(subtotal, discount, event.feeRate ?? 0.1, event.feePayer ?? 'buyer'), coupon: code }
}
export function checkTicket(orders, events, user, code) {
  if (!['admin', 'organizador', 'checkin'].includes(user?.role)) return { found: false, forbidden: true }
  const order = orders.find(item => item.ticketCodes?.some(ticket => ticket.code === code))
  if (!order) return { found: false }
  if (!ownsEvent(user, events.find(event => event.id === order.eventId))) return { found: false, forbidden: true }
  const ticket = order.ticketCodes.find(item => item.code === code)
  return { found: true, alreadyUsed: Boolean(ticket.used), cancelled: !approved(order) || ticket.status === 'cancelled', order, ticket }
}
