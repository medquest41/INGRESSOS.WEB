// No payment credentials or card data belong in the browser.
export async function mockPayment(method, outcome = 'approved') {
  if (!['pix', 'card'].includes(method)) throw new Error('Forma de pagamento inválida.')
  if (outcome !== 'approved') throw new Error('Pagamento simulado recusado. Nenhuma cobrança ou ingresso foi gerado.')
  return { provider: 'mock', status: 'approved', paymentId: `mock-${crypto.randomUUID()}` }
}
