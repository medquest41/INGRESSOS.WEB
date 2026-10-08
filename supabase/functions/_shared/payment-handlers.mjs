import { verifyWebhook, getVerifiedPayment, createCheckoutPreference } from './mercadopago.mjs'
// HTTP/Edge host injects authenticated RLS reads and server-only settlement.
// No route is enabled by importing this module. Credentials stay on the server.
export function paymentHandlers({enabled=false,accessToken,webhookSecret,collectorId,returnUrl,webhookUrl,getUser,getOrder,settlePayment,recordReversal,reconcilePayment,fetchPayment=getVerifiedPayment,createPreference=createCheckoutPreference}) {
 function configured(){if(!enabled||!accessToken||!webhookSecret||!collectorId)throw new Error('Pagamento online não habilitado.')}
 return {
  async checkout({authorization,orderId}){
   configured();const user=await getUser(authorization);if(!user?.id)throw new Error('Não autenticado.')
   const order=await getOrder(orderId,user)
   if(!order||order.user_id!==user.id||order.status!=='pending'||new Date(order.expires_at).getTime()<=Date.now())throw new Error('Pedido indisponível.')
   const preference=await createPreference({accessToken,order:{id:order.id,totalCents:order.total_cents,expiresAt:order.expires_at},returnUrl,webhookUrl})
   const destination=new URL(preference.init_point)
   if(destination.protocol!=='https:'||!['www.mercadopago.com.br','www.mercadopago.com'].includes(destination.hostname))throw new Error('Resposta de checkout inválida.')
   return {checkoutUrl:preference.init_point}
  },
  async webhook({signature,requestId,dataId}){
   configured()
   if(!verifyWebhook({signature,requestId,dataId,secret:webhookSecret}))throw new Error('Assinatura inválida.')
   const payment=await fetchPayment(dataId,accessToken)
   if(String(payment.id)!==String(dataId)||String(payment.collector_id)!==String(collectorId)||payment.currency_id!=='BRL'||payment.live_mode!==true)throw new Error('Pagamento incompatível com o vendedor/ambiente.')
   if(reconcilePayment){await reconcilePayment(payment);return {received:true}}
   if(['refunded','charged_back'].includes(payment.status)||Number(payment.transaction_amount_refunded||0)>0){
    if(!recordReversal)throw new Error('Reconciliação de estorno indisponível.')
    if(!/^[0-9a-f-]{36}$/i.test(payment.external_reference||''))throw new Error('Referência inválida.')
    await recordReversal({purchase_id:payment.external_reference,external_payment_id:String(payment.id),provider_status:payment.status,full_reversal:['refunded','charged_back'].includes(payment.status)})
    return {received:true,review:true}
   }
   if(payment.status!=='approved')return {ignored:true}
   if(!/^[0-9a-f-]{36}$/i.test(payment.external_reference||''))throw new Error('Referência inválida.')
   const cents=Math.round(Number(payment.transaction_amount)*100)
   if(!Number.isSafeInteger(cents)||cents<=0)throw new Error('Valor inválido.')
   const fees=payment.fee_details
   let providerFee=null
   if(Array.isArray(fees)){
    if(fees.some(f=>!Number.isFinite(Number(f.amount))||Number(f.amount)<0))throw new Error('Tarifa inválida.')
    providerFee=Math.round(fees.filter(f=>f.fee_payer==='collector').reduce((sum,f)=>sum+Number(f.amount),0)*100)
    if(!Number.isSafeInteger(providerFee)||providerFee>cents)throw new Error('Tarifa inválida.')
   }
   await settlePayment({purchase_id:payment.external_reference,external_payment_id:String(payment.id),paid_cents:cents,currency_code:'BRL',provider_fee:providerFee,method:payment.payment_method_id||payment.payment_type_id||'mercadopago'})
   return {received:true}
  },
 }
}
