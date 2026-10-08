import { supabase } from '../lib/supabase'
// No payment credentials or card data belong in the browser.
async function invoke(action, orderId) {
  const { data, error } = await supabase.functions.invoke('payments', { body: { action, orderId } })
  if (error || data?.error) throw new Error(data?.error || 'Pagamento indisponível. Confira o pedido em Minha conta e tente novamente.')
  return data
}
export const paymentAvailability = () => invoke('status')
export async function startPayment(orderId) { window.location.assign('/ingressos?payment='+encodeURIComponent(orderId)) }
