// Server-only recovery: never trust a browser payment ID or search result alone.
export async function recoverInlinePayment({orderId,attemptKey,accessToken,fetchImpl=fetch}) {
  const url=new URL('https://api.mercadopago.com/v1/payments/search')
  url.searchParams.set('external_reference',orderId)
  url.searchParams.set('sort','date_created');url.searchParams.set('criteria','desc');url.searchParams.set('limit','100')
  const response=await fetchImpl(url,{headers:{Authorization:'Bearer '+accessToken},signal:AbortSignal.timeout(15000)})
  if(!response.ok)throw new Error('Não foi possível recuperar a cobrança. Aguarde e consulte novamente.')
  const data=await response.json()
  if(!Array.isArray(data.results))throw new Error('Consulta de cobrança inválida.')
  const matches=data.results.filter(p=>p.external_reference===orderId&&p.metadata?.attempt_key===attemptKey)
  if(matches.length>1||Number(data.paging?.total)>100)throw new Error('Cobrança requer revisão no provedor.')
  return matches.length?String(matches[0].id):null
}

export function reconciliationArgs(payment,order,providerFee) {
  const refunded=Number(payment.transaction_amount_refunded||0)
  if(!Number.isFinite(refunded)||refunded<0||refunded>Number(payment.transaction_amount))throw new Error('Estorno inválido.')
  return {purchase_id:order.id,external_payment_id:String(payment.id),attempt_id:payment.metadata?.attempt_key||null,
    provider_status:payment.status,paid_cents:order.total_cents,payment_method:payment.payment_method_id==='pix'?'pix':'card',
    provider_updated:payment.date_last_updated||null,provider_fee:providerFee,refunded_cents:Math.round(refunded*100)}
}
