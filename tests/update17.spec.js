import {test,expect} from '@playwright/test'
const id='10000000-0000-4000-8000-000000000001'
async function fixture(page){
 const state={status:'not_started',payCalls:[],pollCalls:0,total:55}
 await page.route('https://payment17test.supabase.co/**',async route=>{
  const body=route.request().postDataJSON();let data
  if(body.action==='order')data={id,total:state.total,expiresAt:new Date(Date.now()+32*60000).toISOString(),email:'buyer@example.test',status:'pending',publicKey:'TEST-00000000-0000-4000-8000-000000000001'}
  else if(body.action==='pay'){state.payCalls.push(body);state.status=body.method==='pix'?'pending':'rejected';data={status:state.status,method:body.method,qrCode:body.method==='pix'?'000201-synthetic-pix-test':'',expiresAt:new Date(Date.now()+32*60000).toISOString()}}
  else {state.pollCalls++;data={status:state.status,method:state.payCalls.at(-1)?.method,qrCode:state.status==='pending'?'000201-synthetic-pix-test':''}}
  await route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(data)})
 })
 await page.route('https://sdk.mercadopago.com/js/v2',route=>route.fulfill({contentType:'text/javascript',body:`window.MercadoPago=class {bricks(){return {create:async(type,id,config)=>{window.syntheticBrick=config;const button=document.createElement('button');button.textContent='Enviar cartão de teste';button.onclick=()=>config.callbacks.onSubmit({token:'synthetic-token-only',payment_method_id:'visa',installments:1,payer:{email:'holder@example.test',identification:{type:'CPF',number:'11144477735'}}});document.getElementById(id).appendChild(button);config.callbacks.onReady();return {unmount:()=>button.remove()}}}}}` }))
 return state
}
test('Pix mobile: QR/copy, amount/deadline, approval only after server result',async({page})=>{
 await page.setViewportSize({width:390,height:844});const state=await fixture(page)
 await page.goto('/tests/fixtures/payment17.html');await expect(page.getByText('R$ 55,00')).toBeVisible()
 await page.getByRole('button',{name:'Gerar QR Code Pix'}).click();await expect(page.locator('.inline-pix svg[role="img"]')).toBeVisible();await expect(page.getByLabel('Pix copia e cola')).toHaveValue('000201-synthetic-pix-test')
 await expect(page.locator('html')).not.toHaveAttribute('data-confirmed','true');expect(state.payCalls).toHaveLength(1)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 state.status='approved';await expect(page.locator('html')).toHaveAttribute('data-confirmed','true',{timeout:10000});await expect(page.locator('.inline-pix')).toHaveCount(0)
})
test('card SDK passes token and holder; declined payment may retry with Pix',async({page})=>{
 const state=await fixture(page);await page.goto('/tests/fixtures/payment17.html')
 await page.getByRole('button',{name:'Cartão Formulário seguro'}).click();await page.getByRole('button',{name:'Enviar cartão de teste'}).click()
 await expect(page.getByText('Pagamento recusado.',{exact:false})).toBeVisible();await expect(page.locator('html')).not.toHaveAttribute('data-confirmed','true')
 expect(state.payCalls[0].card.payer.identification.number).toBe('11144477735');expect(state.payCalls[0].card.card_number).toBeUndefined()
 await page.getByRole('button',{name:'Pix QR Code e copia e cola'}).click();await page.getByRole('button',{name:'Gerar QR Code Pix'}).click();await expect(page.locator('.inline-pix svg[role="img"]')).toBeVisible()
})
for(const status of ['expired','refunded','charged_back','review'])test('terminal '+status+' hides payment codes and blocks payment controls',async({page})=>{
 const state=await fixture(page);await page.goto('/tests/fixtures/payment17.html');await page.getByRole('button',{name:'Gerar QR Code Pix'}).click()
 state.status=status;await expect(page.locator('.inline-pix')).toHaveCount(0,{timeout:10000});await expect(page.getByRole('button',{name:'Pix QR Code e copia e cola'})).toBeDisabled();await expect(page.locator('html')).not.toHaveAttribute('data-confirmed','true')
})
