export function canHideUnpaidOrder(order) {
  if (order.paymentReview || order.ticketCodes?.length) return false
  if (!['pending', 'cancelled', 'rejected', 'expired'].includes(order.status)) return false
  if (order.paymentStatus && !['pending', 'not_started', 'rejected', 'cancelled', 'expired'].includes(order.paymentStatus)) return false
  return !(order.orderHistory || []).some(item => ['approved', 'refunded', 'charged_back'].includes(item.to_status))
}
export const hiddenOrdersKey = userId => 'ingressos_hidden_unpaid_orders_v1:' + userId
export function readHiddenOrders(userId) {
  try {
    const value = JSON.parse(localStorage.getItem(hiddenOrdersKey(userId)) || '[]')
    return Array.isArray(value) ? value.filter(id => typeof id === 'string') : []
  } catch { return [] }
}
