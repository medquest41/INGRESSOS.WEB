import { createClient } from 'npm:@supabase/supabase-js@2.117.2'
import { createInlinePayment, safePayment, publicPayment, orderPaymentStatus } from '../_shared/inline-payment.mjs'
import { getVerifiedPayment } from '../_shared/mercadopago.mjs'
import { paymentHandlers } from '../_shared/payment-handlers.mjs'

const env = (key: string) => Deno.env.get(key) || ''
// Public keys have a UUID suffix; never echo a private access token from a misconfigured field.
const publicKey = () => /^(APP_USR|TEST)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(env('MP_PUBLIC_KEY')) ? env('MP_PUBLIC_KEY') : ''
const allowedOrigins = () => env('PAYMENT_ALLOWED_ORIGINS').split(',').map(s=>s.trim()).filter(Boolean)
Deno.serve(async req => {
  const origin = req.headers.get('origin') || ''
  const allowed = allowedOrigins().includes(origin)
  const cors: Record<string,string> = { 'Content-Type':'application/json', 'Vary':'Origin', ...(allowed ? { 'Access-Control-Allow-Origin':origin, 'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods':'POST, OPTIONS' } : {}) }
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), {status,headers:cors})
  if(req.method==='OPTIONS')return new Response(null,{status:allowed?204:403,headers:cors})
  if(req.method!=='POST')return reply(405,{error:'Método inválido.'})
  try {
    const url = new URL(req.url)
    const webhook = url.searchParams.get('action') === 'webhook'
    const authorization = req.headers.get('authorization') || ''
    const database = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {auth:{persistSession:false,autoRefreshToken:false}})
    const settings = await database.from('settings').select('value').eq('key','payments_enabled').maybeSingle()
    if(settings.error)throw new Error('Configuração indisponível.')
    const configured = settings.data?.value===true && Boolean(env('MP_ACCESS_TOKEN')&&env('MP_WEBHOOK_SECRET')&&env('MP_COLLECTOR_ID')&&env('MP_WEBHOOK_URL'))
    const reconcile = async (payment: any) => {
      if(!/^[0-9a-f-]{36}$/i.test(payment.external_reference||''))throw new Error('Referência inválida.')
      const purchase=await database.from('orders').select('*').eq('id',payment.external_reference).single()
      if(purchase.error)throw new Error('Pedido indisponível.')
      const method=payment.payment_method_id==='pix'?'pix':'card'
      const verified=safePayment(payment,purchase.data,env('MP_COLLECTOR_ID'),method)
      const recorded=await database.rpc('record_verified_inline_payment',{
        purchase_id:purchase.data.id,external_payment_id:String(payment.id),attempt_id:payment.metadata?.attempt_key||null,
        provider_status:payment.status,paid_cents:purchase.data.total_cents,payment_method:method,provider_updated:payment.date_last_updated||null,
      })
      if(recorded.error)throw new Error('Cobrança não reconciliada.')
      if(recorded.data==='review'||recorded.data==='stale')return
      if(['refunded','charged_back'].includes(payment.status)||Number(payment.transaction_amount_refunded||0)>0){
        const result=await database.rpc('record_payment_reversal',{purchase_id:purchase.data.id,external_payment_id:String(payment.id),provider_status:payment.status,full_reversal:['refunded','charged_back'].includes(payment.status)})
        if(result.error)throw new Error('Estorno em reconciliação.')
      } else if(payment.status==='approved'){
        const result=await database.rpc('settle_marketplace_payment',{purchase_id:purchase.data.id,external_payment_id:String(payment.id),paid_cents:purchase.data.total_cents,currency_code:'BRL',provider_fee:verified.providerFee,method:payment.payment_method_id||payment.payment_type_id})
        if(result.error)throw new Error('Pagamento recebido aguardando reconciliação.')
      }
    }
    const handlers = paymentHandlers({
      enabled:configured,accessToken:env('MP_ACCESS_TOKEN'),webhookSecret:env('MP_WEBHOOK_SECRET'),collectorId:env('MP_COLLECTOR_ID'),returnUrl:env('MP_RETURN_URL'),webhookUrl:env('MP_WEBHOOK_URL'),
      getUser:async () => {
        const {data,error}=await database.auth.getUser(authorization.replace(/^Bearer\s+/i,''))
        if(error||!data.user)throw new Error('Sessão inválida.')
        const profile=await database.from('profiles').select('active').eq('id',data.user.id).maybeSingle()
        if(profile.error||!profile.data?.active)throw new Error('Conta inativa.')
        return data.user
      },
      getOrder:async (id: string, user: {id:string}) => {
        const result=await database.from('orders').select('id,user_id,total_cents,status,expires_at').eq('id',id).eq('user_id',user.id).maybeSingle()
        if(result.error)throw new Error('Pedido indisponível.')
        return result.data
      },
      settlePayment:async (args: Record<string,unknown>) => { const result=await database.rpc('settle_marketplace_payment',args);if(result.error)throw new Error(result.error.message) },
      recordReversal:async (args: Record<string,unknown>) => { const result=await database.rpc('record_payment_reversal',args);if(result.error)throw new Error(result.error.message) },
      reconcilePayment:reconcile,
    })
    if(webhook){
      const body=await req.json()
      const dataId=url.searchParams.get('data.id')||body.data?.id
      if(body.type!=='payment'&&body.action?.startsWith('payment.')!==true)return reply(200,{ignored:true})
      try { return reply(200,await handlers.webhook({signature:req.headers.get('x-signature'),requestId:req.headers.get('x-request-id'),dataId})) }
      catch { console.error('Falha ao reconciliar notificação Mercado Pago. Confira o pedido no provedor e no banco; pode exigir estorno.');return reply(503,{error:'Notificação não reconciliada.'}) }
    }
    if(!allowed)return reply(403,{error:'Origem não autorizada.'})
    const userClient=createClient(env('SUPABASE_URL'),env('SUPABASE_ANON_KEY'),{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}})
    const user=await userClient.auth.getUser()
    if(user.error||!user.data.user)return reply(401,{error:'Entre na sua conta.'})
    const body=await req.json()
    if(body.action==='status')return reply(200,{enabled:configured,mode:'inline',cardEnabled:Boolean(publicKey()),publicKey:publicKey()})

    if(!['order','pay','poll'].includes(body.action)||!/^[0-9a-f-]{36}$/i.test(body.orderId||''))return reply(400,{error:'Atualize a página e escolha Pix ou cartão dentro do site.'})
    if(!configured)return reply(503,{error:'Pagamentos ainda não configurados.'})
    const profile=await database.from('profiles').select('active').eq('id',user.data.user.id).maybeSingle()
    if(profile.error||!profile.data?.active)return reply(403,{error:'Conta inativa.'})
    const readOrder=async()=>{const q=await database.from('orders').select('*').eq('id',body.orderId).eq('user_id',user.data.user!.id).maybeSingle();if(q.error||!q.data)throw new Error('Pedido indisponível.');return q.data}
    let order=await readOrder()
    const attemptQuery=await database.from('inline_payment_attempts').select('*').eq('order_id',order.id).maybeSingle()
    if(attemptQuery.error)throw new Error('Integração não instalada.')
    let attempt=attemptQuery.data
    if(body.action==='order')return reply(200,{id:order.id,total:order.total_cents/100,subtotal:order.subtotal_cents/100,discount:order.discount_cents/100,fee:order.snapshot?.feePayer==='organizer'?0:order.fee_cents/100,feePayer:order.snapshot?.feePayer||'buyer',expiresAt:order.expires_at,email:order.buyer.email,status:orderPaymentStatus(order),publicKey:publicKey(),activeMethod:attempt&& !['rejected','cancelled'].includes(attempt.status)?attempt.method:null})
    if(order.status==='approved'&&!order.payment_review)return reply(200,{status:'approved',total:order.total_cents/100})
    if(order.payment_review||['cancelled','refunded'].includes(order.status))return reply(200,{status:order.payment_review?'review':order.status,total:order.total_cents/100})
    if(body.action==='pay'){
      if(body.method==='card'&&!publicKey())return reply(503,{error:'Cartão ainda não configurado.'})
      const claim=await database.rpc('begin_inline_payment',{purchase_id:order.id,buyer_id:user.data.user.id,payment_method:body.method})
      if(claim.error)return reply(409,{error:claim.error.message})
      attempt=claim.data
      order=await readOrder()
    }
    if(!attempt||!attempt.provider_id&&body.action==='poll')return reply(200,{status:new Date(order.expires_at).getTime()<=Date.now()?'expired':attempt?'creating':'not_started',method:attempt?.method,total:order.total_cents/100,expiresAt:order.expires_at})
    const payment=attempt.provider_id ? await getVerifiedPayment(attempt.provider_id,env('MP_ACCESS_TOKEN')) : await createInlinePayment({accessToken:env('MP_ACCESS_TOKEN'),order,method:attempt.method,card:body.card,idempotencyKey:attempt.attempt_key,webhookUrl:env('MP_WEBHOOK_URL')})
    safePayment(payment,order,env('MP_COLLECTOR_ID'),attempt.method)
    await reconcile(payment)
    order=await readOrder()
    const confirmed=order.status==='approved'&&!order.payment_review&&order.payment_id===String(payment.id)
    return reply(200,publicPayment(payment,order,confirmed))

  } catch { return reply(400,{error:'Pagamento indisponível. Confira sua sessão, o pedido e a configuração.'}) }
})



