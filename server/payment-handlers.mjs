import { verifyWebhook, getVerifiedPayment, createCheckoutPreference } from './mercadopago.mjs'
// HTTP/Edge host injects authenticated RLS reads and server-only settlement.
// No route is enabled by importing this module. Credentials stay on the server.
export function paymentHandlers({enabled=false,accessToken,webhookSecret,collectorId,returnUrl,webhookUrl,getUser,getOrder,settlePayment,fetchPayment=getVerifiedPayment,createPreference=createCheckoutPreference}) {
 function configured(){if(!enabled||!accessToken||!webhookSecret||!collectorId)throw new Error('Pagamento online não habilitado.')}
 return {
  async checkout({authorization,orderId}){
   configured();const user=await getUser(authorization);if(!user?.id)throw new Error('Não autenticado.')
   const order=await getOrder(orderId,user)
   if(!order||order.user_id!==user.id||order.status!=='pending'||new Date(order.expires_at).getTime()<=Date.now())throw new Error('Pedido indisponível.')
   const preference=await createPreference({accessToken,order:{id:order.id,totalCents:order.total_cents},returnUrl,webhookUrl})
   if(!preference.init_point?.startsWith('https://'))throw new Error('Resposta de checkout inválida.')
   return {checkoutUrl:preference.init_point}
  },
  async webhook({signature,requestId,dataId}){
   configured()
   if(!verifyWebhook({signature,requestId,dataId,secret:webhookSecret}))throw new Error('Assinatura inválida.')
   const payment=await fetchPayment(dataId,accessToken)
   if(String(payment.id)!==String(dataId)||String(payment.collector_id)!==String(collectorId)||payment.currency_id!=='BRL'||payment.live_mode!==true)throw new Error('Pagamento incompatível com o vendedor/ambiente.')
   if(payment.status!=='approved')return {ignored:true}
   if(!/^[0-9a-f-]{36}$/i.test(payment.external_reference||''))throw new Error('Referência inválida.')
   const cents=Math.round(Number(payment.transaction_amount)*100)
   if(!Number.isSafeInteger(cents)||cents<=0)throw new Error('Valor inválido.')
   await settlePayment({purchase_id:payment.external_reference,external_payment_id:String(payment.id),paid_cents:cents,currency_code:'BRL'})
   return {received:true}
  },
 }
}
