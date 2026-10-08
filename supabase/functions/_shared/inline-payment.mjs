export function safePayment(payment, order, collectorId, method) {
  if(!/^\d+$/.test(String(payment.id))||!['pending','in_process','authorized','approved','rejected','cancelled','refunded','charged_back'].includes(payment.status))throw new Error('Resposta de pagamento inválida.')
  if(String(payment.collector_id)!==String(collectorId)||payment.live_mode!==true||payment.currency_id!=='BRL'||payment.external_reference!==order.id||Math.round(Number(payment.transaction_amount)*100)!==order.total_cents)throw new Error('Pagamento incompatível com o pedido.')
  if(method==='pix'&&payment.payment_method_id!=='pix'||method==='card'&&!['credit_card','debit_card','prepaid_card'].includes(payment.payment_type_id))throw new Error('Forma de pagamento incompatível.')
  const fees=payment.fee_details
  let providerFee=null
  if(Array.isArray(fees)){
    if(fees.some(f=>!Number.isFinite(Number(f.amount))||Number(f.amount)<0))throw new Error('Tarifa inválida.')
    providerFee=Math.round(fees.filter(f=>f.fee_payer==='collector').reduce((s,f)=>s+Number(f.amount),0)*100)
    if(!Number.isSafeInteger(providerFee)||providerFee>order.total_cents)throw new Error('Tarifa inválida.')
  }
  return {providerFee,status:payment.status}
}

export function paymentBody(order,method,card,webhookUrl) {
  if(!['pix','card'].includes(method)||!Number.isSafeInteger(order.total_cents)||order.total_cents<=0)throw new Error('Forma ou valor inválido.')
  const name=String(order.buyer?.name||'').trim().split(/\s+/)
  const body={transaction_amount:order.total_cents/100,description:'Ingresso — '+String(order.snapshot?.eventTitle||order.id).slice(0,180),external_reference:order.id,notification_url:webhookUrl,payer:{email:order.buyer.email,first_name:name[0],last_name:name.slice(1).join(' '),identification:{type:'CPF',number:order.buyer.cpf}}}
  if(method==='pix')return {...body,payment_method_id:'pix',date_of_expiration:order.expires_at}
  if(typeof card?.token!=='string'||!/^[a-zA-Z0-9_-]{8,200}$/.test(card.token)||typeof card.payment_method_id!=='string'||!/^[a-zA-Z0-9_-]{1,40}$/.test(card.payment_method_id)||card.payment_method_id==='pix'||!Number.isInteger(card.installments)||card.installments!==1)throw new Error('Confira os dados do cartão. Apenas pagamento à vista está disponível.')
  return {...body,token:card.token,payment_method_id:card.payment_method_id,installments:1,three_d_secure_mode:'optional',...(card.issuer_id?{issuer_id:String(card.issuer_id)}:{})}
}

export async function createInlinePayment({accessToken,order,method,card,idempotencyKey,webhookUrl,fetchImpl=fetch}) {
  if(!accessToken||!idempotencyKey||!webhookUrl?.startsWith('https://'))throw new Error('Configuração de pagamento inválida.')
  const body=paymentBody(order,method,card,webhookUrl)
  body.metadata={order_id:order.id,attempt_key:idempotencyKey}
  const response=await fetchImpl('https://api.mercadopago.com/v1/payments',{method:'POST',headers:{Authorization:'Bearer '+accessToken,'Content-Type':'application/json','X-Idempotency-Key':idempotencyKey},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)})
  if(!response.ok)throw new Error('Não foi possível processar o pagamento. Confira os dados ou tente novamente.')
  return response.json()
}

export function orderPaymentStatus(order,now=Date.now()) {
  if(order.payment_review)return 'review'
  if(order.status!=='pending')return order.status
  if(new Date(order.expires_at).getTime()<=now)return 'expired'
  return order.payment_status==='approved'?'confirming':order.payment_status||'pending'
}

export function publicPayment(payment,order,confirmed=false,now=Date.now()) {
  const transaction=payment.point_of_interaction?.transaction_data
  const challenge=payment.status_detail==='pending_challenge'&&payment.three_ds_info?.external_resource_url?.startsWith('https:')?{externalResourceURL:payment.three_ds_info.external_resource_url,creq:payment.three_ds_info.creq}:null
  const status=confirmed?'approved':order.payment_review?'review':payment.status==='approved'?'confirming':new Date(order.expires_at).getTime()<=now&&['pending','in_process','authorized'].includes(payment.status)?'expired':payment.status
  return {paymentId:String(payment.id),status,challenge,method:payment.payment_method_id==='pix'?'pix':'card',expiresAt:order.expires_at,qrCode:payment.payment_method_id==='pix'&&status==='pending'?transaction?.qr_code||'':'',total:order.total_cents/100}
}
