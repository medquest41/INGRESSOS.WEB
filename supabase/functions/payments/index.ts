import { createClient } from 'npm:@supabase/supabase-js@2.117.2'
import { createInlinePayment, paymentBody, safePayment, publicPayment, orderPaymentStatus } from '../_shared/inline-payment.mjs'
import { getVerifiedPayment } from '../_shared/mercadopago.mjs'
import { recoverInlinePayment, reconciliationArgs } from '../_shared/payment-recovery.mjs'
import { paymentHandlers } from '../_shared/payment-handlers.mjs'

const env = (key: string) => Deno.env.get(key) || ''
// Public keys have a UUID suffix; never echo a private access token from a misconfigured field.
const publicKey = () => /^(APP_USR|TEST)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(env('MP_PUBLIC_KEY')) ? env('MP_PUBLIC_KEY') : ''
// Fail closed: sandbox accepts only live_mode=false; production only true.
const liveMode = () => env('MP_ENVIRONMENT') !== 'sandbox'
const validEnvironment = () => ['production','sandbox'].includes(env('MP_ENVIRONMENT'))
const allowedOrigins = () => env('PAYMENT_ALLOWED_ORIGINS').split(',').map(s=>s.trim()).filter(Boolean)
Deno.serve(async req => {
  const origin = req.headers.get('origin') || ''
  const allowed = allowedOrigins().includes(origin)
  const cors: Record<string,string> = { 'Content-Type':'application/json', 'Cache-Control':'no-store', 'Vary':'Origin', ...(allowed ? { 'Access-Control-Allow-Origin':origin, 'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods':'POST, OPTIONS' } : {}) }
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
    const credentialsConfigured = validEnvironment() && Boolean(env('MP_ACCESS_TOKEN')&&env('MP_WEBHOOK_SECRET')&&env('MP_COLLECTOR_ID')&&env('MP_WEBHOOK_URL'))
    const configured = settings.data?.value===true && credentialsConfigured
    const reconcile = async (payment: any) => {
      if(!/^[0-9a-f-]{36}$/i.test(payment.external_reference||''))throw new Error('Referência inválida.')
      const purchase=await database.from('orders').select('*').eq('id',payment.external_reference).single()
      if(purchase.error)throw new Error('Pedido indisponível.')
      const method=payment.payment_method_id==='pix'?'pix':'card'
      const verified=safePayment(payment,purchase.data,env('MP_COLLECTOR_ID'),method,liveMode())
      const recorded=await database.rpc('reconcile_inline_payment',reconciliationArgs(payment,purchase.data,verified.providerFee))
      if(recorded.error)throw new Error('Pagamento recebido aguardando reconciliação.')
      return recorded.data

    }
    const handlers = paymentHandlers({
      enabled:webhook?credentialsConfigured:configured,liveMode:liveMode(),accessToken:env('MP_ACCESS_TOKEN'),webhookSecret:env('MP_WEBHOOK_SECRET'),collectorId:env('MP_COLLECTOR_ID'),returnUrl:env('MP_RETURN_URL'),webhookUrl:env('MP_WEBHOOK_URL'),
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
      const dataId=url.searchParams.get('data.id')
      if(!dataId||body.data?.id!=null&&String(body.data.id)!==dataId)return reply(400,{error:'Notificação inválida.'})
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
    if(['refunded','charged_back'].includes(order.payment_status))return reply(200,{status:order.payment_status,total:order.total_cents/100})
    if(order.status==='approved'&&!order.payment_review)return reply(200,{status:'approved',total:order.total_cents/100})
    if(order.payment_review||['cancelled','refunded'].includes(order.status))return reply(200,{status:order.payment_review?'review':order.status,total:order.total_cents/100})
    if(body.action==='pay'){
      if(body.method==='card'&&!publicKey())return reply(503,{error:'Cartão ainda não configurado.'})
      paymentBody(order,body.method,body.card,env('MP_WEBHOOK_URL'))
      const claim=await database.rpc('begin_inline_payment',{purchase_id:order.id,buyer_id:user.data.user.id,payment_method:body.method})
      if(claim.error)return reply(409,{error:claim.error.message})
      attempt=claim.data
      order=await readOrder()
    }
    // A lost HTTP response must be recovered by its bound attempt, including card token submissions.
    if(attempt&&!attempt.provider_id){
      const recoveredId=await recoverInlinePayment({orderId:order.id,attemptKey:attempt.attempt_key,accessToken:env('MP_ACCESS_TOKEN')})
      if(recoveredId)attempt={...attempt,provider_id:recoveredId}
    }
    if(!attempt||!attempt.provider_id&&body.action==='poll')return reply(200,{status:new Date(order.expires_at).getTime()<=Date.now()?'expired':attempt?'creating':'not_started',method:attempt?.method,total:order.total_cents/100,expiresAt:order.expires_at})
    let payment
    if(attempt.provider_id)payment=await getVerifiedPayment(attempt.provider_id,env('MP_ACCESS_TOKEN'))
    else {
      const leaseId=crypto.randomUUID()
      const lease=await database.rpc('claim_inline_creation',{purchase_id:order.id,attempt_id:attempt.attempt_key,lease_id:leaseId})
      if(lease.error)throw new Error('Tentativa indisponível.')
      if(!lease.data)return reply(200,{status:'creating',method:attempt.method,total:order.total_cents/100,expiresAt:order.expires_at})
      try {
        payment=await createInlinePayment({accessToken:env('MP_ACCESS_TOKEN'),order,method:attempt.method,card:body.card,idempotencyKey:attempt.attempt_key,webhookUrl:env('MP_WEBHOOK_URL')})
      } catch(error) {
        if((error as {definitive?:boolean}).definitive&&lease.data===1){
          const rejected=await database.rpc('reject_inline_creation',{purchase_id:order.id,attempt_id:attempt.attempt_key,lease_id:leaseId})
          if(rejected.error)throw new Error('Tentativa em reconciliação.')
          return reply(200,{status:'rejected',method:attempt.method,total:order.total_cents/100,expiresAt:order.expires_at})
        }
        // Never rotate an unknown attempt; subsequent polls recover the original charge.
        return reply(200,{status:'creating',method:attempt.method,total:order.total_cents/100,expiresAt:order.expires_at})
      }
    }
    safePayment(payment,order,env('MP_COLLECTOR_ID'),attempt.method,liveMode())
    await reconcile(payment)
    order=await readOrder()
    const confirmed=order.status==='approved'&&!order.payment_review&&order.payment_id===String(payment.id)
    return reply(200,publicPayment(payment,order,confirmed))

  } catch { return reply(400,{error:'Pagamento indisponível. Confira sua sessão, o pedido e a configuração.'}) }
})



