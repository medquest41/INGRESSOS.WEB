import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { defaultEvents } from '../src/data/defaultEvents.js'
const org='20000000-0000-4000-8000-000000000001',eventId='30000000-0000-4000-8000-000000000001',batch='40000000-0000-4000-8000-000000000001'
const userId='10000000-0000-4000-8000-000000000001'
const base=defaultEvents[0]
async function mockApi(page,{role='cliente',price=0,error=false}={}){
 const calls=[],orders=[];let logged=false
 const profile={id:userId,email:role==='admin'?'medquest41@gmail.com':'cliente@example.test',name:'Cliente Teste',role,active:true,organization_id:role==='cliente'?null:org,organizations:{name:'Empresa A'}}
 const user={id:userId,email:profile.email,aud:'authenticated',role:'authenticated',email_confirmed_at:new Date().toISOString(),app_metadata:{provider:'email'},user_metadata:{name:profile.name}}
 const token='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({sub:userId,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.synthetic-signature'
 await page.route('https://*.supabase.co/**',async route=>{
  const request=route.request(),url=new URL(request.url()),p=url.pathname,body=request.postDataJSON();calls.push({path:p,body,url:request.url()})
  const send=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)})
  if(p==='/auth/v1/token'){logged=true;return send({access_token:token,refresh_token:'synthetic-refresh',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user})}
  if(p==='/auth/v1/user'){if(request.method()==='PUT')return send({user});return send(user)}
  if(p==='/auth/v1/logout'){logged=false;return send({})}
  if(p==='/auth/v1/signup')return send({user:{...user,id:randomUUID()},session:null})
  if(p==='/auth/v1/recover')return send({})
  if(p==='/rest/v1/profiles')return send(url.searchParams.has('id')?profile:[profile])
  if(p==='/rest/v1/organizations')return send([{id:org,name:'Empresa A',active:true}])
  if(p==='/rest/v1/events'){
   if(error)return send({code:'PGRST205',message:'Tabela não disponível'},404)
   return send([{id:eventId,slug:'reveillon-exclusive-2027',title:base.title,published:true,archived:false,organization_id:org,fee_rate:0.1,details:base,organizations:{name:'Empresa A'},ticket_types:[{id:batch,event_id:eventId,name:'Pista',sector:'Pista',batch:'1º lote',type:'individual',capacity:5,price_cents:price,active:true,position:0,sequential:false}]}])
  }
  if(p==='/rest/v1/rpc/catalog_stock')return send([{id:batch,remaining:5-orders.length,open:true}])
  if(p==='/rest/v1/orders')return send(logged?orders:[])
  if(p==='/rest/v1/rpc/quote_order'){
   const subtotal=price*Number(body.units)/100,discount=body.coupon_code==='PROMO'?subtotal*.1:0,fee=(subtotal-discount)*.1
   return send({subtotal,discount,fee,total:subtotal-discount+fee})
  }
  if(p==='/rest/v1/rpc/create_order'){
   const id=randomUUID(),total=price*body.units*1.1
   orders.push({id,user_id:userId,event_id:eventId,ticket_type_id:batch,quantity:body.units,status:price===0?'approved':'pending',total_cents:total,subtotal_cents:price*body.units,discount_cents:0,fee_cents:price*body.units*.1,buyer:body.buyer_data,source:body.referral,campaign:body.campaign_name,created_at:new Date().toISOString(),expires_at:new Date(Date.now()+900000).toISOString(),snapshot:{eventTitle:base.title,eventImage:base.image,eventDate:base.date,eventTime:base.time,ticketName:'Pista',batch:'1º lote'},tickets:price===0?[{id:randomUUID(),code:randomUUID(),used_at:null,cancelled:false}]:[]})
   return send(id)
  }
  if(p==='/rest/v1/rpc/cancel_order'){const o=orders.find(o=>o.id===body.purchase_id);o.status='cancelled';return send(null)}
  if(p==='/rest/v1/rpc/check_in'){
   const ticket=orders.flatMap(o=>o.tickets).find(t=>t.code===body.ticket_code);if(!ticket)return send('invalid');if(ticket.used_at)return send('used');ticket.used_at=new Date().toISOString();return send('valid')
  }
  if(p==='/rest/v1/rpc/save_event')return send(body.payload.id)
  if(p.startsWith('/rest/v1/'))return send([])
  throw new Error('Unexpected mocked endpoint: '+p)
 })
 return {calls,orders,profile}
}
async function login(page,role='cliente',destination='/ingressos'){
 await page.goto(destination)
 await page.getByLabel('E-mail',{exact:true}).fill(role==='admin'?'medquest41@gmail.com':'cliente@example.test')
 await page.getByLabel('Senha',{exact:true}).fill('Synthetic-Test-123')
 await page.getByRole('button',{name:'Entrar',exact:true}).click()
}


test('email confirmation carries event destination into a fresh browser session',async({page,browser})=>{
 const state=await mockApi(page)
 const target='/evento/reveillon-exclusive-2027?ref=email'
 await page.goto('/login?'+new URLSearchParams({returnTo:target}))
 await page.getByRole('button',{name:'Criar conta',exact:true}).click()
 await page.getByLabel('Seu nome').fill('Cliente Teste')
 await page.getByLabel('E-mail',{exact:true}).fill('novo@example.test')
 await page.getByLabel('Senha',{exact:true}).fill('Synthetic-Test-123')
 await page.getByRole('button',{name:'Criar conta',exact:true}).click()
 await expect(page.getByRole('status')).toContainText('Confirme seu e-mail')
 const call=state.calls.find(c=>c.path==='/auth/v1/signup')
 expect(new URL(call.url).searchParams.get('redirect_to')).toBe('http://127.0.0.1:5199/login?'+new URLSearchParams({returnTo:target}))
 // Supabase serializes emailRedirectTo in the signup request URL.
 const context=await browser.newContext()
 const confirmed=await context.newPage()
 await mockApi(confirmed)
 const token='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({sub:userId,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.synthetic-signature'
 await confirmed.goto('http://127.0.0.1:5199/login?'+new URLSearchParams({returnTo:target})+'#access_token='+token+'&refresh_token=synthetic-refresh&expires_in=3600&token_type=bearer&type=signup')
 await expect(confirmed).toHaveURL('http://127.0.0.1:5199'+target)
 await context.close()
})

test('15.2 Supabase general login, restored session and account button go to events',async({page})=>{
 await mockApi(page);await login(page,'cliente','/login');await expect(page).toHaveURL(/\/eventos$/)
 await page.reload();await expect(page).toHaveURL(/\/eventos$/)
 await page.goto('/login');await expect(page).toHaveURL(/\/eventos$/)
 await page.getByRole('link',{name:'Minha conta',exact:true}).click();await expect(page).toHaveURL(/\/eventos$/)
 await page.goto('/admin/evento/festa/vendas');await expect(page).toHaveURL(/\/eventos$/)
 await page.getByRole('link',{name:'Meus ingressos',exact:true}).first().click();await expect(page).toHaveURL(/\/ingressos$/)
})
test('15.2 Supabase event login preserves referral',async({page})=>{
 await mockApi(page);const target='/evento/reveillon-exclusive-2027?ref=campanha'
 await login(page,'cliente','/login?'+new URLSearchParams({returnTo:target}));await expect(page).toHaveURL('http://127.0.0.1:5199'+target)
})
