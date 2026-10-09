// Optional worker. Deploy with JWT verification disabled ONLY when EMAIL_WORKER_SECRET
// is set; the worker validates that secret before reading any order data.
import { createClient } from 'npm:@supabase/supabase-js@2'
const escapeHtml = (value: string) => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
Deno.serve(async request => {
  const workerSecret = Deno.env.get('EMAIL_WORKER_SECRET')
  if (!workerSecret || request.headers.get('Authorization') !== 'Bearer ' + workerSecret) return new Response('Unauthorized', {status:401})
  if (request.method !== 'POST') return new Response('Method not allowed', {status:405})
  const key = Deno.env.get('RESEND_API_KEY'), from = Deno.env.get('TICKET_EMAIL_FROM'), origin = Deno.env.get('PUBLIC_SITE_URL')
  if (!key || !from || !origin || !origin.startsWith('https://')) return Response.json({configured:false,sent:false}, {status:503})
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {auth:{persistSession:false}})
  const {data:job,error} = await client.rpc('claim_ticket_email')
  if (error) return Response.json({error:'Não foi possível obter a fila'}, {status:500})
  if (!job) return Response.json({sent:false,queue:'empty'})
  try {
    // Check again after claiming. Reversal invalidates every link at read time, too.
    const {data:order,error:orderError}=await client.from('orders').select('status,payment_review,user_id,buyer').eq('id',job.orderId).single()
    if (orderError || order.status!=='approved' || order.payment_review) throw Error('Pedido indisponível')
    const {data:tickets,error:ticketError}=await client.from('tickets').select('id,holder,code,cancelled,used_at').eq('order_id',job.orderId)
    if(ticketError||!tickets?.length)throw Error('Ingressos indisponíveis')
    const links=[]
    for (const ticket of tickets) {
      if(ticket.cancelled||ticket.used_at)continue
      const token=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','')
      const {error:shareError}=await client.from('ticket_shares').insert({secret:token,ticket_id:ticket.id,expires_at:new Date(Date.now()+86400000).toISOString(),created_by:order.user_id})
      if(shareError)throw Error('Não foi possível preparar o ingresso')
      links.push('<li>'+escapeHtml(ticket.holder?.name||order.buyer.name)+' — <a href="'+escapeHtml(new URL('/ingresso-compartilhado#'+token,origin).href)+'">Visualizar ingresso e salvar PDF</a></li>')
    }
    if(!links.length)throw Error('Sem ingressos disponíveis')
    const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','Idempotency-Key':'ingressos-'+job.orderId},body:JSON.stringify({from,to:[job.email],subject:'Seus ingressos • '+job.eventTitle,html:'<main style="background:#092418;color:#ead7a7;padding:32px;font-family:Arial"><h1>Seu próximo rolê está confirmado 🎟️</h1><h2>'+escapeHtml(job.eventTitle)+'</h2><ul>'+links.join('')+'</ul><p>Links protegidos válidos por 24 horas. Não publique nem encaminhe a desconhecidos. Acesse Meus ingressos com este mesmo e-mail para recuperar o pedido.</p><p>Ingressos Experiences • Pato Branco-PR • CNPJ 65.586.495/0001-28</p></main>'}),signal:AbortSignal.timeout(20000)})
    const result=await response.json()
    if(!response.ok||!result.id)throw Error('O provedor não confirmou o envio')
    const {error:saveError}=await client.from('ticket_email_outbox').update({status:'sent',sent_at:new Date().toISOString(),provider_id:result.id,last_error:null}).eq('order_id',job.orderId)
    if(saveError)throw Error('Não foi possível registrar o envio')
    await client.from('orders').update({email_delivery_status:'sent'}).eq('id',job.orderId)
    return Response.json({sent:true})
  } catch {
    await client.from('ticket_email_outbox').update({status:'failed',last_error:'Falha de envio; verificar infraestrutura do provedor.'}).eq('order_id',job.orderId)
    await client.from('orders').update({email_delivery_status:'failed'}).eq('id',job.orderId)
    return Response.json({sent:false}, {status:502})
  }
})
