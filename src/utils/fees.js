export function calculateFees(subtotal, discount = 0, rate = 0.1, payer = 'buyer') {
  if (!Number.isFinite(Number(rate)) || Number(rate) < 0 || Number(rate) > 1 || !['buyer', 'organizer'].includes(payer)) throw new Error('Confira a taxa e quem paga.')
  const base = Math.round((Number(subtotal) - Number(discount)) * 100)
  if (!Number.isSafeInteger(base) || base < 0) throw new Error('Valor inválido.')
  const commission = Math.round(base * Number(rate))
  const buyerFee = payer === 'buyer' ? commission : 0
  return { fee: buyerFee / 100, platformFee: commission / 100, feePayer: payer, feeRate: Number(rate), total: (base + buyerFee) / 100 }
}

export function payoutAmount(order) {
  if (order.providerFee == null || order.paymentReview) return null
  return Math.round((Number(order.total) - Number(order.platformFee ?? order.fee ?? 0) - Number(order.providerFee)) * 100) / 100
}
