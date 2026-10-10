import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { defaultEvents } from '../src/data/defaultEvents.js'
const org='20000000-0000-4000-8000-000000000001',eventId='30000000-0000-4000-8000-000000000001',batch='40000000-0000-4000-8000-000000000001'
const userId='10000000-0000-4000-8000-000000000001'
const base=defaultEvents[0]
test('check-in shows green success, red used/invalid and a separate connection error',async({page})=>{
 await mockApi(page,{role:'admin'})
 let outcome='valid',calls=0
 await page.route('https://*.supabase.co/rest/v1/rpc/check_in_event',route=>{
  calls++
  expect(route.request().postDataJSON().expected_event).toBe(eventId)
  return route.fulfill({status:outcome==='error'?503:200,contentType:'application/json',body:JSON.stringify(outcome==='error'?{message:'Synthetic unavailable'}:outcome)})
 })
 await login(page,'admin','/admin/evento/'+eventId+'/checkin')
 const code=page.getByPlaceholder('ING-...'),button=page.getByRole('button',{name:'Validar',exact:true})
 await code.fill('60000000-0000-4000-8000-000000000001')
 await button.click();await expect(page.locator('.scan-result.valid')).toContainText('Entrada autorizada e registrada')
 outcome='used';await button.click();await expect(page.locator('.scan-result.used')).toContainText('INGRESSO JÁ USADO')
 outcome='invalid';await button.click();await expect(page.locator('.scan-result.invalid')).toContainText('INGRESSO INVÁLIDO')
 outcome='wrong_event';await button.click();await expect(page.locator('.scan-result.wrong_event')).toContainText('INGRESSO DE OUTRO EVENTO')
 outcome='error';await button.click();await expect(page.locator('.scan-result.error')).toContainText('VALIDAÇÃO NÃO CONFIRMADA')
 expect(calls).toBe(5)
})
test('payment lookup error keeps recovery available and accepts only database confirmation',async({page})=>{
 await mockApi(page)
 await login(page)
 let status='pending',polls=0,charges=0
 await page.route('https://*.supabase.co/rest/v1/orders*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({id:userId,status,total_cents:1393,expires_at:new Date(Date.now()+900000).toISOString()})}))
 await page.route('https://*.supabase.co/functions/v1/payments',route=>{
  const action=route.request().postDataJSON().action
  if(action==='create_pix'||action==='create_checkout')charges++
  polls++
  return route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:'Erro interno no pagamento.'})})
 })
 await page.goto('/tests/fixtures/payment17.html')
 await expect(page.getByText('Se você já pagou, não pague novamente.',{exact:false})).toBeVisible()
 await expect(page.getByRole('button',{name:'Verificar pagamento',exact:true})).toBeVisible()
 await expect(page.locator('html')).not.toHaveAttribute('data-confirmed','true')
 await expect.poll(()=>polls).toBeGreaterThan(1)
 status='approved'
 await page.getByRole('button',{name:'Verificar pagamento',exact:true}).click()
 await expect(page.locator('html')).toHaveAttribute('data-confirmed','true')
 expect(charges).toBe(0)
})
async function mockApi(page,{role='cliente',price=0,error=false,owner=false}={}){
 const calls=[],orders=[];let logged=false
 const profile={id:userId,email:owner?'ingressosaltatemporada@gmail.com':role==='admin'?'medquest41@gmail.com':'cliente@example.test',name:'Cliente Teste',role,active:true,organization_id:role==='cliente'?null:org,organizations:{name:'Empresa A'}}
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
async function buyer(page){await page.getByLabel('Nome completo').fill('Cliente Teste');await page.getByLabel('CPF',{exact:true}).fill('52998224725');await page.getByLabel('Telefone com DDD').fill('41999999999');await page.getByLabel('Data de nascimento').fill('2000-01-01')}
test('remote auth session, free order, QR, referral and logout without local storage writes',async({page})=>{
 const state=await mockApi(page);const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await login(page,'cliente','/checkout?event='+eventId+'&ticket='+batch+'&q=1&ref=instagram&campaign=outubro')
 await expect(page.getByText('Finalize sua experiência.')).toBeVisible();await buyer(page)
 await page.getByRole('button',{name:'Confirmar pedido',exact:true}).click()
 await expect(page).toHaveURL(/\/ingressos$/);await expect(page.locator('.my-ticket svg')).toHaveCount(1)
 await page.reload();await expect(page.locator('.my-ticket')).toHaveCount(1)
 expect(state.orders[0].source).toBe('instagram');expect(state.orders[0].campaign).toBe('outubro')
 expect(await page.evaluate(()=>localStorage.getItem('ingressos_platform_v2'))).toBeNull()
 await page.goto('/admin');await expect(page).toHaveURL(/\/ingressos$/)
 await page.getByRole('button',{name:'Sair',exact:true}).click();await page.goto('/ingressos');await expect(page).toHaveURL(/\/login$/)
 expect(errors).toEqual([])
})
test('paid checkout stays pending without emitting a valid QR and can cancel reservation',async({page})=>{
 const state=await mockApi(page,{price:10000})
 await login(page,'cliente','/checkout?event='+eventId+'&ticket='+batch+'&q=1')
 await buyer(page);await page.getByRole('button',{name:'Confirmar pedido',exact:true}).click()
 await expect(page.getByText(/Pendente/)).toBeVisible();await expect(page.locator('.my-ticket svg')).toHaveCount(0)
 expect(state.orders[0].status).toBe('pending');await page.getByRole('button',{name:'Cancelar reserva'}).click();await expect(page.getByText(/Cancelado/)).toBeVisible()
})
test('signup requests confirmation and recovery requests a link without local administrator bootstrap',async({page})=>{
 const state=await mockApi(page)
 await page.goto('/login');await expect(page.getByRole('button',{name:'Criar administrador'})).toHaveCount(0)
 await page.getByRole('button',{name:'Criar conta de cliente'}).click();await page.getByLabel('Seu nome').fill('Cliente Teste');await page.getByLabel('E-mail',{exact:true}).fill('cliente@example.test');await page.getByLabel('Senha',{exact:true}).fill('Synthetic-Test-123');await page.getByRole('button',{name:'Criar conta',exact:true}).click()
 await expect(page.getByText(/Confirme seu e-mail/).first()).toBeVisible()
 await page.getByRole('button',{name:'Esqueci minha senha'}).click();await expect(page.getByText(/link de recuperação/)).toBeVisible()
 expect(state.calls.some(c=>c.path==='/auth/v1/signup')).toBe(true);expect(state.calls.some(c=>c.path==='/auth/v1/recover')).toBe(true)
})
test('remote failures are visible and never masked by default/local events',async({page})=>{
 await mockApi(page,{error:true});await page.goto('/eventos');await expect(page.getByRole('heading',{name:'Não foi possível carregar os dados'})).toBeVisible();await expect(page.locator('.event-card')).toHaveCount(0)
 await page.getByRole('link',{name:'Acessar conta'}).click();await expect(page.getByRole('button',{name:'Entrar',exact:true})).toBeVisible()
})
test('mobile remote checkout and administrator scanner show valid then used without losing tab state',async({page})=>{
 const state=await mockApi(page,{role:'admin'});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:390,height:844})
 await login(page,'admin','/checkout?event='+eventId+'&ticket='+batch+'&q=1');await buyer(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
 await page.getByRole('button',{name:'Confirmar pedido',exact:true}).click();await expect(page.locator('.my-ticket')).toHaveCount(1)
 const code=state.orders[0].tickets[0].code;await page.goto('/admin');await page.getByRole('button',{name:'Check-in',exact:true}).click()
 for(const label of ['INGRESSO VÁLIDO','JÁ UTILIZADO']){await page.getByPlaceholder('ING-...').fill(code);await page.getByRole('button',{name:'Validar',exact:true}).click();await expect(page.locator('.scan-result')).toHaveText(label)}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);expect(errors).toEqual([])
})

test('authenticated recovery page saves a new password and signs out',async({page})=>{
 const state=await mockApi(page);await login(page);await expect(page.getByRole('heading',{name:'Meus ingressos.'})).toBeVisible()
 await page.goto('/redefinir-senha');await page.getByLabel('Nova senha',{exact:true}).fill('New-Synthetic-123');await page.getByLabel('Confirmar senha',{exact:true}).fill('New-Synthetic-123');await page.getByRole('button',{name:'Salvar senha'}).click()
 await expect(page.getByText('Senha atualizada. Entre novamente.')).toBeVisible();expect(state.calls.some(c=>c.path==='/auth/v1/user'&&c.body?.password)).toBe(true)
 await page.getByRole('link',{name:'Voltar para entrar'}).click();await expect(page.getByRole('button',{name:'Entrar',exact:true})).toBeVisible()
})

 test('owner manages check-in staff by email inside the selected event',async({page})=>{
  await mockApi(page,{role:'organizador'})
  let members=[]
  await page.route('https://*.supabase.co/rest/v1/rpc/event_checkin_team',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(members)}))
  await page.route('https://*.supabase.co/rest/v1/rpc/set_event_checkin_member',route=>{
   const body=route.request().postDataJSON();expect(body.target_event).toBe(eventId);expect(body.member_email).toBe('portaria@example.test')
   members=body.enabled?[{id:'staff',name:'Portaria',email:body.member_email,active:true}]:[]
   return route.fulfill({contentType:'application/json',body:'null'})
  })
  await login(page,'organizador','/admin/evento/'+eventId+'/event_team')
  await expect(page.getByRole('link',{name:'Gerenciar equipe',exact:true})).toBeVisible()
  await page.context().grantPermissions(['clipboard-read','clipboard-write'])
  await page.getByRole('button',{name:'Copiar link',exact:true}).click()
  await expect(page.getByText('Link da portaria copiado.',{exact:true})).toBeVisible()
  expect(await page.evaluate(()=>navigator.clipboard.readText())).toContain('/admin/evento/'+eventId+'/checkin')
  await page.getByLabel('E-mail da pessoa').fill('portaria@example.test')
  await page.getByRole('button',{name:'Autorizar portaria'}).click()
  await expect(page.getByText('Acesso à portaria autorizado.',{exact:true})).toBeVisible()
  await expect(page.getByText('portaria@example.test • Acesso ativo')).toBeVisible()
  await page.getByRole('button',{name:'Remover acesso'}).click()
  await expect(page.getByText('Pessoas autorizadas (0)',{exact:true})).toBeVisible()
 })

test('ticket print contains QR and hides order history and page controls',async({page})=>{
 const state=await mockApi(page)
 await page.route('https://*.supabase.co/functions/v1/payments',route=>route.fulfill({contentType:'application/json',body:'{"pixEnabled":true,"cardEnabled":false}'}))
 state.orders.push({id:randomUUID(),user_id:userId,event_id:eventId,ticket_type_id:batch,quantity:1,status:'approved',total_cents:1000,buyer:{name:'Cliente Teste',cpf:'52998224725'},created_at:new Date().toISOString(),snapshot:{eventTitle:base.title,eventImage:base.image,eventDate:base.date,eventTime:base.time,ticketName:'Pista',batch:'1º lote'},tickets:[{id:randomUUID(),code:randomUUID(),used_at:null,cancelled:false}]})
 await login(page)
 await expect(page.locator('.my-ticket svg')).toHaveCount(1)
 await expect(page.getByRole('button',{name:'Imprimir / salvar PDF',exact:true})).toBeEnabled()
 await page.emulateMedia({media:'print'})
 await expect(page.locator('.my-ticket svg')).toBeVisible()
 await expect(page.getByRole('heading',{name:'Meus ingressos.'})).not.toBeVisible()
 await expect(page.locator('.customer-order-heading')).not.toBeVisible()
 await page.screenshot({path:'test-results-print-proof.png',fullPage:true})
})

test('portaria has only validation even when opening financial links directly',async({page})=>{
 await mockApi(page,{role:'checkin'})
 await page.route('https://*.supabase.co/rest/v1/rpc/checkin_summary',route=>route.fulfill({contentType:'application/json',body:JSON.stringify([{event_id:eventId,issued:2,checked_in:0}])}))
 await login(page,'checkin','/admin/evento/'+eventId+'/finance')
 await expect(page.getByRole('button',{name:'Validar',exact:true})).toBeVisible()
 const tabs=page.getByRole('navigation',{name:'Abas do evento'})
 await expect(tabs.getByRole('link')).toHaveCount(1)
 await expect(tabs.getByRole('link',{name:'Check-in',exact:true})).toBeVisible()
 await expect(page.getByText('Financeiro',{exact:true})).toHaveCount(0)
 await expect(page.getByText('Vendas confirmadas',{exact:true})).toHaveCount(0)
 await expect(page.getByRole('button',{name:'Autorizar portaria'})).toHaveCount(0)
})

test('portaria link offers account creation and keeps event on confirmation redirect',async({page})=>{
 const state=await mockApi(page,{role:'checkin'});await reviewedLegal(page)
 await page.goto('/admin/evento/'+eventId+'/checkin')
 await expect(page.getByRole('heading',{name:'Acesso à portaria do evento.'})).toBeVisible()
 await page.getByRole('button',{name:'Criar conta',exact:true}).click()
 await page.getByLabel('Seu nome',{exact:true}).fill('Equipe Portaria')
 await page.getByLabel('E-mail',{exact:true}).fill('portaria@example.test')
 await page.getByLabel('Senha',{exact:true}).fill('Synthetic-Test-123')
 await page.getByLabel('CPF',{exact:true}).fill('52998224725')
 await page.getByLabel('Celular com DDD',{exact:true}).fill('41999999999')
 await page.getByLabel('Data de nascimento',{exact:true}).fill('2000-01-01')
 await page.getByLabel('Confirmar e-mail',{exact:true}).fill('portaria@example.test')
 await page.getByRole('checkbox',{name:/Li e concordo/}).check()
 await page.getByRole('button',{name:'Criar conta',exact:true}).last().click()
 await expect(page.getByRole('status')).toContainText('voltar à validação deste evento')
 const signup=state.calls.find(c=>c.path==='/auth/v1/signup')
 const redirect=new URL(new URL(signup.url).searchParams.get('redirect_to'))
 expect(redirect.searchParams.get('returnTo')).toBe('/admin/evento/'+eventId+'/checkin')
})

async function reviewedLegal(page,ready=true){
 const drafts=JSON.parse(await readFile(new URL('../src/legal/documents.json',import.meta.url),'utf8'))
 const documents=Object.entries(drafts).map(([slug,d])=>({slug,version:d.content.version,content:d.canonical,content_hash:d.hash,published:ready}))
 await page.route('https://*.supabase.co/rest/v1/legal_config*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({company:{legalName:'Empresa de teste',address:'Endereço fictício de teste',tradeName:'Ingressos Experiences',cnpj:'65.586.495/0001-28',supportEmail:'support@example.test',privacyEmail:'privacy@example.test',legalEmail:'legal@example.test',reviewed:ready},active_versions:Object.fromEntries(documents.map(d=>[d.slug,d.version])),enforce_signup:ready,program_enabled:false})}))
 await page.route('https://*.supabase.co/rest/v1/legal_documents*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(ready?documents:[])}))
 return documents
}
test('legal signup requires unchecked mandatory acceptance and marketing remains optional',async({page})=>{
 const state=await mockApi(page);const documents=await reviewedLegal(page)
 await page.goto('/login?cadastro=1')
 await page.getByLabel('Seu nome').fill('Cliente Teste');await page.getByLabel('E-mail',{exact:true}).fill('cliente@example.test');await page.getByLabel('Senha',{exact:true}).fill('Synthetic-Test-123');await page.getByLabel('CPF',{exact:true}).fill('52998224725');await page.getByLabel('Data de nascimento').fill('2000-01-01');await page.getByLabel('Celular com DDD').fill('41999999999');await page.getByLabel('Confirmar e-mail').fill('cliente@example.test')
 const accept=page.getByRole('checkbox',{name:/Li e concordo/}),marketing=page.getByRole('checkbox',{name:/Desejo receber/}),submit=page.getByRole('button',{name:'Criar conta',exact:true})
 await expect(accept).not.toBeChecked();await expect(marketing).not.toBeChecked();await expect(submit).toBeDisabled()
 await expect(page.getByRole('link',{name:'Termos de Uso',exact:true}).first()).toHaveAttribute('href','/institucional/termos')
 await accept.check();await expect(submit).toBeEnabled();await submit.click();await expect(page.getByText(/Cadastro recebido/)).toBeVisible()
 const signup=state.calls.find(c=>c.path==='/auth/v1/signup');expect(signup.body.data.marketing).toBe(false);expect(signup.body.data.legalAcceptances).toEqual(['termos','privacidade'].map(slug=>({slug,version:documents.find(d=>d.slug===slug).version,hash:documents.find(d=>d.slug===slug).content_hash,accepted:true})))
})
test('draft documents cannot be accepted and legal pages fit mobile',async({page})=>{
 const state=await mockApi(page);await reviewedLegal(page,false);await page.setViewportSize({width:390,height:844})
 await page.goto('/login?cadastro=1');await page.getByRole('checkbox',{name:/Li e concordo/}).check();await expect(page.getByRole('button',{name:'Criar conta',exact:true})).toBeDisabled();expect(state.calls.some(c=>c.path==='/auth/v1/signup')).toBe(false)
 await page.goto('/institucional/termos');await expect(page.getByRole('heading',{name:'Termos Gerais de Uso da Plataforma'})).toBeVisible();await expect(page.getByText(/MINUTA PARA REVISÃO/)).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 await page.locator('.legal-layout nav a').first().click();await expect(page).toHaveURL(/#s1$/)
 await page.screenshot({path:'juridico-mobile.jpg',fullPage:false})
})
test('promoter application requires specific acceptance and never activates a link',async({page})=>{
 const state=await mockApi(page);await reviewedLegal(page);await login(page,'cliente','/login?returnTo=%2Fpromotores')
 const checkbox=page.getByRole('checkbox',{name:/Li e aceito os Termos do Programa/}),button=page.getByRole('button',{name:'Solicitar participação'})
 await expect(checkbox).not.toBeChecked();await expect(button).toBeDisabled();await checkbox.check();await expect(button).toBeEnabled();await button.click();await expect(page.getByText(/Nenhum link foi ativado/)).toBeVisible();expect(state.calls.some(c=>c.path==='/rest/v1/rpc/accept_legal_documents'&&c.body.purpose==='promoter.application')).toBe(true)
})
test('sales cleanup is owner only and requires selection password and confirmation',async({page})=>{
 await mockApi(page,{role:'admin',owner:true});await reviewedLegal(page)
 const orderId='50000000-0000-4000-8000-000000000001'
 await page.route('https://*.supabase.co/rest/v1/orders*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify([{id:orderId,event_id:eventId,user_id:userId,quantity:1,status:'pending',total_cents:1000,fee_cents:100,subtotal_cents:900,discount_cents:0,buyer:{name:'Teste'},snapshot:{eventTitle:base.title},tickets:[]}])}))
 let payload
 await page.route('https://*.supabase.co/functions/v1/sales-maintenance',route=>{payload=route.request().postDataJSON();return route.fulfill({contentType:'application/json',body:JSON.stringify({count:1})})})
 await login(page,'admin','/admin/evento/'+eventId+'/orders');await page.getByRole('button',{name:'Somente essenciais'}).click();await page.getByRole('button',{name:'Revisar vendas de teste'}).click()
 const confirm=page.getByRole('button',{name:'Confirmar limpeza das vendas selecionadas'});await expect(confirm).toBeDisabled();await page.locator('.sales-cleanup-orders input').check();await page.getByLabel('Sua senha de Admin Geral').fill('Synthetic-Test-123');await page.getByLabel('Digite LIMPAR VENDAS DE TESTE').fill('LIMPAR VENDAS DE TESTE');await expect(confirm).toBeEnabled();await page.locator('.sales-cleanup').screenshot({path:'limpeza-vendas-previa.jpg'});await confirm.click();await expect(page.getByText(/1 pedido\(s\) de teste arquivado/)).toBeVisible();expect(payload.eventId).toBe(eventId);expect(payload.orderIds).toEqual([orderId]);expect(payload.confirmation).toBe('LIMPAR VENDAS DE TESTE')
})
test('other admins and organizers never see sales cleanup controls',async({page})=>{
 await mockApi(page,{role:'admin'});await login(page,'admin','/admin/evento/'+eventId+'/orders');await expect(page.getByRole('button',{name:'Revisar vendas de teste'})).toHaveCount(0)
})
