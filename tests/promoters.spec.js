import {test,expect} from './support/offline-network'
import {readFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {defaultEvents} from '../src/data/defaultEvents.js'
const org='20000000-0000-4000-8000-000000000001',eventId='30000000-0000-4000-8000-000000000001',batch='40000000-0000-4000-8000-000000000001',userId='10000000-0000-4000-8000-000000000001',base=defaultEvents[0]
async function mockApi(page,{role='cliente',price=0,error=false,owner=false,signupDuplicate=false}={}){
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
  if(p==='/auth/v1/signup')return send({user:{...user,id:randomUUID(),identities:signupDuplicate?[]:[{provider:'email'}]},session:null})
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
 await page.goto('/login?returnTo=%2Fpromotores')
 await page.getByLabel('E-mail',{exact:true}).fill(role==='admin'?'medquest41@gmail.com':'cliente@example.test')
 await page.getByLabel('Senha',{exact:true}).fill('Synthetic-Test-123')
 await page.getByRole('button',{name:'Entrar',exact:true}).click();await expect(page).toHaveURL(/\/promotores$/);if(destination!=='/promotores')await page.goto(destination)
}
async function reviewedLegal(page,ready=true){
 const drafts=JSON.parse(await readFile(new URL('../src/legal/documents.json',import.meta.url),'utf8'))
 const documents=Object.entries(drafts).map(([slug,d])=>({slug,version:d.content.version,content:d.canonical,content_hash:d.hash,published:ready}))
 await page.route('https://*.supabase.co/rest/v1/legal_config*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({company:{legalName:'Empresa de teste',address:'Endereço fictício de teste',tradeName:'Ingressos Experiences',cnpj:'65.586.495/0001-28',supportEmail:'support@example.test',privacyEmail:'privacy@example.test',legalEmail:'legal@example.test',reviewed:ready},active_versions:Object.fromEntries(documents.map(d=>[d.slug,d.version])),enforce_signup:ready,program_enabled:false})}))
 await page.route('https://*.supabase.co/rest/v1/legal_documents*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(ready?documents:[])}))
 return documents
}

const rate='70000000-0000-4000-8000-000000000001',token='a'.repeat(64)
async function program(page,{enabled=true,profile=null,owner=false,validLink=true}={}){
 const state={calls:[],profile,enabled};
 const info=()=>({enabled:state.enabled,rateVersion:rate,firstRateBps:500,recurringRateBps:400,firstEvents:15})
 const dashboard=target=>({owner,program:info(),profile:state.profile,rates:[],promoters:owner&&!target?[{user_id:userId,display_name:'DJ Aurora',email:'dj@example.test',status:'approved'}]:[],referrals:profile?[{organization_id:org,name:'Organizador Indicado',created_at:'2026-10-01T12:00:00Z'}]:[],events:profile?[{id:eventId,title:'Evento Indicado',ordinal:16,rate_bps:400,commission_cents:400,reconciled_at:'2026-10-09T12:00:00Z',needs_reconciliation:false}]:[],entries:[],payments:[],balanceCents:400,audit:[],page:0})
 await page.route('https://*.supabase.co/rest/v1/rpc/promoter_*',route=>{const method=route.request().url().split('/').at(-1),args=route.request().postDataJSON();state.calls.push({method,args});let data=null;
 if(method==='promoter_program_info')data=info();else if(method==='promoter_dashboard')data=dashboard(args.target);else if(method==='promoter_link_info')data=validLink&&state.enabled?{valid:true,name:'DJ Aurora'}:null;else if(method==='promoter_apply')state.profile={...args,user_id:userId,status:'pending'};else if(method==='promoter_set_enabled')state.enabled=args.enabled;
 return route.fulfill({contentType:'application/json',body:JSON.stringify(data)})});return state;
}
const djProfile={user_id:userId,display_name:'DJ Aurora',status:'approved',link_token:token,email:'dj@example.test',phone:'45999999999',pix_kind:'email',pix_key:'dj@example.test',pix_holder:'DJ Aurora',rate_version:rate}
for(const viewport of [{name:'desktop',width:1366,height:900},{name:'mobile',width:390,height:844}]){
 test.describe(viewport.name,()=>{
 test.use({viewport:{width:viewport.width,height:viewport.height}})
 test('public chooser opens direct signup and promoter login at the top',async({page})=>{
 await mockApi(page);await reviewedLegal(page);await program(page);await page.goto('/promotores');await page.getByRole('button',{name:'Somente essenciais'}).click();
 await page.getByRole('button',{name:'Quero ser promotor →',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.screenshot({path:'test-results/promoter-choices-'+viewport.name+'.png'});
 await page.getByRole('link',{name:/Criar conta como promotor/}).click();await expect(page.getByRole('heading',{name:'Criar minha conta de promotor',exact:true})).toBeVisible();await expect(page.getByLabel('Confirmar e-mail',{exact:true})).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(await page.evaluate(()=>scrollY)).toBe(0);await page.screenshot({path:'test-results/promoter-signup-'+viewport.name+'.png',fullPage:true});
 await page.goto('/promotores');await page.getByRole('button',{name:'Quero ser promotor →',exact:true}).click();await page.getByRole('link',{name:/Cadastrar minha conta como promotor/}).click();await expect(page.getByRole('heading',{name:'Entrar como promotor',exact:true})).toBeVisible();await expect(page).toHaveURL(/participar%3D1/);
 await page.goto('/promotores');await page.getByRole('button',{name:'Quero ser promotor →',exact:true}).click();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();await page.getByRole('button',{name:'Quero ser promotor →',exact:true}).click();await page.getByRole('link',{name:/Entrar no meu painel de promotor/}).click();await expect(page.getByRole('heading',{name:'Entrar como promotor',exact:true})).toBeVisible();await expect(page).toHaveURL(/returnTo=%2Fpromotores$/);
 })
 test('existing signup directs to login without claiming an email was sent',async({page})=>{
 await mockApi(page,{signupDuplicate:true});await reviewedLegal(page);await program(page);await page.goto('/login?cadastro=1&returnTo=%2Fpromotores%3Fparticipar%3D1');await page.getByRole('button',{name:'Somente essenciais'}).click();await page.getByLabel('Seu nome',{exact:true}).fill('Pessoa Teste');await page.getByLabel('E-mail',{exact:true}).fill('existente@example.test');await page.getByLabel('Senha',{exact:true}).fill('Synthetic-Password-123');await page.getByLabel('CPF',{exact:true}).fill('52998224725');await page.getByLabel('Data de nascimento',{exact:true}).fill('1990-01-01');await page.getByLabel('Celular com DDD',{exact:true}).fill('45999999999');await page.getByRole('checkbox',{name:/Li e concordo/}).check();await page.getByRole('button',{name:'Criar conta',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Você já possui uma conta.'})).toBeVisible();await expect(page.getByRole('heading',{name:'Entrar como promotor',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Entrar na minha conta',exact:true})).toBeVisible();await expect(page.getByLabel('E-mail',{exact:true})).toHaveValue('existente@example.test');await expect(page.getByLabel('Senha',{exact:true})).toHaveValue('');await expect(page.getByRole('button',{name:'Esqueci minha senha',exact:true})).toBeVisible();await expect(page).toHaveURL(/participar%3D1/);
 })
 test('organizer sees own approved promoter link in existing dashboard',async({page,context})=>{
 await context.grantPermissions(['clipboard-read','clipboard-write']);await mockApi(page,{role:'organizador'});await reviewedLegal(page);await program(page,{profile:djProfile});await page.goto('/login');await page.getByRole('button',{name:'Somente essenciais'}).click();await page.getByLabel('E-mail',{exact:true}).fill('cliente@example.test');await page.getByLabel('Senha',{exact:true}).fill('Synthetic-Test-123');await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.goto('/admin?tab=dashboard');const card=page.getByRole('region',{name:'Minha conta de promotor'});await expect(card.getByLabel('Meu link de promotor',{exact:true})).toHaveValue(new RegExp('/indicacao/'+token));await card.getByRole('button',{name:'Copiar meu link de promotor',exact:true}).click();await expect(card.getByText('Link copiado!',{exact:true})).toBeVisible();expect(await page.evaluate(()=>navigator.clipboard.readText())).toContain(token);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 })
 test('enrollment captures complementary data and current consent',async({page})=>{
 await mockApi(page);await reviewedLegal(page);const s=await program(page);await login(page,'cliente','/promotores');await page.getByRole('button',{name:'Somente essenciais'}).click();
 await page.getByRole('button',{name:'Quero ser promotor →',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByRole('link',{name:/Criar conta como promotor/})).toBeVisible();await expect(page.getByRole('link',{name:/Entrar no meu painel de promotor/})).toBeVisible();await page.getByRole('link',{name:/Cadastrar minha conta como promotor/}).click();await expect(page.getByRole('dialog')).not.toBeVisible();await expect(page.getByRole('heading',{name:'Complete seu cadastro.'})).toBeVisible();await expect(page.getByRole('region',{name:'Texto integral dos termos do programa'})).toBeVisible();await expect(page.getByRole('heading',{name:'Configurar comissões'})).toHaveCount(0);const submit=page.getByRole('button',{name:'Solicitar aprovação'});await expect(submit).toBeDisabled();await page.getByLabel('Nome artístico / nome do promotor').fill('DJ Aurora');await page.getByLabel('Telefone com DDD',{exact:true}).fill('45999999999');await page.getByLabel('Chave Pix',{exact:true}).fill('dj@example.test');await page.getByLabel('Nome do titular Pix').fill('DJ Aurora');await page.getByRole('checkbox',{name:/Li e aceito os/}).check();await submit.click();await expect(page.getByText('Cadastro enviado para aprovação.')).toBeVisible();await expect(page).toHaveURL(/\/promotores$/);await expect(page.getByRole('heading',{name:'Meu painel de promotor.',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Cadastro concluído!',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Copiar meu link',exact:true})).toHaveCount(0);const call=s.calls.find(c=>c.method==='promoter_apply');expect(call.args.claims[0].slug).toBe('promotores');expect(call.args.pix_key).toBe('dj@example.test');expect(call.args.rate_version).toBe(rate);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 })
 test('DJ dashboard copies and shares private link without financial admin controls',async({page,context})=>{
 await context.grantPermissions(['clipboard-read','clipboard-write']);await mockApi(page);await reviewedLegal(page);await program(page,{profile:djProfile});await page.goto('/promotores');await page.getByRole('button',{name:'Somente essenciais'}).click();await login(page,'cliente','/promotores');await expect(page.getByRole('dialog',{name:'Copie seu link de promotor e comece a indicar!'})).toBeVisible();await page.getByRole('button',{name:'Copiar meu link',exact:true}).click();await expect(page.getByText('Pronto! Agora você pode compartilhar seu link.')).toBeVisible();await page.getByRole('button',{name:'Ir para meu painel',exact:true}).click();await expect(page.getByRole('dialog',{name:'Copie seu link de promotor e comece a indicar!'})).not.toBeVisible();await page.reload();await expect(page.getByRole('dialog',{name:'Copie seu link de promotor e comece a indicar!'})).not.toBeVisible();await expect(page.getByText('Organizador Indicado',{exact:true})).toBeVisible();await expect(page.getByText('16º evento elegível • 4%')).toBeVisible();await page.getByRole('button',{name:'Copiar link'}).click();await expect(page.getByText('Link copiado.')).toBeVisible();expect(await page.evaluate(()=>navigator.clipboard.readText())).toContain('/indicacao/'+token);await page.evaluate(()=>{Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{window.__shared=data.url}})});await page.getByRole('button',{name:'Compartilhar',exact:true}).click();expect(await page.evaluate(()=>window.__shared)).toContain('/indicacao/'+token);await expect(page.getByText('Registrar Pix já realizado')).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'docs/promotores/painel-dj-'+viewport.name+'.png',fullPage:true})
 })
 test('referral signup sends immutable capture token and approved legal versions',async({page})=>{
 const api=await mockApi(page);await reviewedLegal(page);await program(page);await page.goto('/indicacao/'+token);await page.getByRole('button',{name:'Somente essenciais'}).click();await page.getByLabel('Nome completo',{exact:true}).fill('Organizador Novo');await page.getByLabel('E-mail',{exact:true}).fill('novo@example.test');await page.getByLabel('CPF',{exact:true}).fill('52998224725');await page.getByLabel('Telefone com DDD').fill('45999999999');await page.getByLabel('Data de nascimento').fill('1990-01-01');await page.getByLabel('Senha',{exact:true}).fill('Synthetic-Password-123');const button=page.getByRole('button',{name:'Criar conta pela indicação'});await expect(button).toBeDisabled();await page.getByRole('checkbox',{name:/Li e aceito os/}).check();await button.click();await expect(page.getByRole('heading',{name:'Confira seu e-mail'})).toBeVisible();const call=api.calls.find(c=>c.path==='/auth/v1/signup');expect(call.body.data.promoterReferral).toBe(token);expect(call.body.data.legalAcceptances.map(c=>c.slug)).toEqual(['termos','privacidade']);expect(call.body.data.marketing).toBe(false);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 })
 test('owner panel reviews promoters and records only a manual payment request',async({page})=>{
 await mockApi(page,{role:'admin',owner:true});await reviewedLegal(page);const s=await program(page,{profile:djProfile,owner:true});await login(page,'admin','/admin/promotores');await page.getByRole('button',{name:'Somente essenciais'}).click();await page.getByRole('button',{name:'Gerenciar',exact:true}).click();const review=page.getByRole('form',{name:'Decisão de aprovação'});await review.getByLabel('Justificativa').fill('Dados e titularidade conferidos no teste');await review.getByRole('button',{name:'Registrar decisão'}).click();await expect(page.getByText('Decisão registrada no histórico.')).toBeVisible();
 const form=page.getByRole('form',{name:'Registro de comprovante Pix'});await form.getByLabel('Valor efetivamente pago (R$)').fill('1,00');await form.getByLabel('Identificador único do comprovante Pix').fill('PIX-TEST-001');await form.getByLabel('Data e hora do Pix realizado').fill('2026-10-09T12:00');await form.getByLabel('Observação / conferência do pagamento').fill('Comprovante sintético sem transferência real');const submit=form.getByRole('button',{name:'Registrar comprovante de pagamento'});await expect(submit).toBeDisabled();await form.getByRole('checkbox').check();await submit.click();await expect(page.getByText(/Pagamento manual registrado; nenhuma transferência/)).toBeVisible();const call=s.calls.find(c=>c.method==='promoter_record_payment');expect(call.args.amount_cents).toBe(100);expect(call.args.target).toBe(userId);expect(call.args.request_id).toMatch(/^[0-9a-f-]{36}$/);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'docs/promotores/painel-admin-'+viewport.name+'.png',fullPage:true})
 })
 test('non-owner admin cannot access promoter management',async({page})=>{await mockApi(page,{role:'admin'});await reviewedLegal(page);const s=await program(page);await login(page,'admin','/admin/promotores');await expect(page.getByRole('heading',{name:'Acesso restrito'})).toBeVisible();expect(s.calls.some(c=>['promoter_review','promoter_set_rates','promoter_record_payment'].includes(c.method))).toBe(false);await expect(page.getByText('Registrar Pix já realizado')).toHaveCount(0)})
 test('disabled program and invalid link never submit applications or signup',async({page})=>{const api=await mockApi(page);await reviewedLegal(page);const s=await program(page,{enabled:false});await page.goto('/indicacao/'+token);await expect(page.getByRole('heading',{name:'Link indisponível'})).toBeVisible();await login(page,'cliente','/promotores?participar=1');await expect(page.getByText(/O programa está desativado/)).toBeVisible();await expect(page.getByRole('button',{name:'Solicitar aprovação'})).toBeDisabled();expect(s.calls.some(c=>c.method==='promoter_apply')).toBe(false);expect(api.calls.some(c=>c.path==='/auth/v1/signup')).toBe(false)})
 })
}
