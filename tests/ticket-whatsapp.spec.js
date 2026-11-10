import {test,expect} from './support/offline-network.js'
async function mock(page){
 const rpc=[],destinations=[]
 await page.route('https://camarotes-test.supabase.co/**',route=>{rpc.push({path:new URL(route.request().url()).pathname,body:route.request().postDataJSON()});return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify('a'.repeat(64))})})
 await page.route('https://wa.me/**',route=>{destinations.push(route.request().url());return route.fulfill({status:200,contentType:'text/html',body:'WhatsApp simulado; nenhuma mensagem enviada'})})
 await page.addInitScript(()=>{window.nativeShares=0;Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{window.nativeShares++}})})
 await page.goto('/tests/fixtures/support-preview.html')
 return {rpc,destinations}
}
test('individual Admin button opens WhatsApp addressed to the buyer with original ticket link',async({page})=>{
 const {rpc,destinations}=await mock(page)
 await page.getByText('Mostrar pedidos',{exact:true}).click();await page.getByText('Detalhes do pedido',{exact:true}).click()
 await page.getByRole('button',{name:'Ver ingressos / baixar PDF (10)',exact:true}).click()
 const card=page.getByRole('dialog').locator('.my-ticket').first();const code=await card.getAttribute('data-code')
 await card.getByRole('button',{name:'Compartilhar no WhatsApp',exact:true}).click()
 await expect.poll(()=>destinations.length).toBe(1)
 const url=new URL(destinations[0]);expect(url.pathname).toBe('/5545999999999');expect(url.searchParams.get('text')).toContain('/ingresso-compartilhado#'+'a'.repeat(64));expect(url.searchParams.get('text')).toContain('ingresso 1 de 10')
 expect(rpc).toHaveLength(1);expect(rpc[0].path).toContain('/create_admin_ticket_share');expect(rpc[0].body.ticket_code).toBe(code)
})
for(const admin of [false,true])test('WhatsApp opens directly without native share or mandatory buyer phone; admin='+admin,async({page})=>{
 const {rpc,destinations}=await mock(page)
 await page.evaluate(async({admin})=>{const {shareTicket}=await import('/src/services/ticketShare.js');const ticket={code:'00000000-0000-4000-8000-000000000002',number:2,status:'valid',used:false};await shareTicket({id:'order',status:'approved',eventTitle:'Evento teste',ticketName:'Mesa 16',buyer:{},wristbands:4,ticketCodes:[ticket]},ticket,{admin});if(window.nativeShares)throw Error('Unexpected native share')},{admin})
 await expect.poll(()=>destinations.length).toBe(1)
 const url=new URL(destinations[0]);expect(url.pathname).toBe('/');expect(url.searchParams.get('text')).toContain('ingresso 2 de 4')
 expect(rpc).toHaveLength(1);expect(rpc[0].path).toContain(admin?'/create_admin_ticket_share':'/create_ticket_share')
})
test('failed secure share does not open WhatsApp or create another ticket',async({page})=>{
 const {destinations}=await mock(page)
 await page.route('https://camarotes-test.supabase.co/rest/v1/rpc/create_ticket_share',route=>route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({message:'Ingresso indisponível',code:'P0001'})}))
 const error=await page.evaluate(async()=>{const {shareTicket}=await import('/src/services/ticketShare.js');try{await shareTicket({id:'order',status:'approved',eventTitle:'Evento teste',ticketName:'Pista'},{code:'00000000-0000-4000-8000-000000000002',status:'valid'})}catch(e){return e.message}})
 expect(error).toBe('Ingresso indisponível');expect(destinations).toHaveLength(0)
})
