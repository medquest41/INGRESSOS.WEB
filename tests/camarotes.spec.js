import {test,expect} from './support/offline-network.js'
import {defaultEvents} from '../src/data/defaultEvents.js'

async function seed(page,role='cliente'){
 await page.goto('/')
 await page.evaluate(({base,role})=>{
  const user={id:'camarote-user',name:'Cliente Teste',email:'cliente@example.test',role,active:true,organizerId:'org-main'}
  const event={...base,id:'room-event',slug:'teste-camarotes',title:'Festa Camarotes',whatsapp:'41999999999',published:true,archived:false,allowSameCpf:true,organizerId:'org-main',ticketTypes:[{id:'c01',name:'Camarote 01',sector:'Camarotes',type:'camarote',batch:'Único',price:1200,available:1,wristbands:8,active:true,mapX:25,mapY:50},{id:'c02',name:'Camarote 02',sector:'Camarotes',type:'camarote',batch:'Único',price:1500,available:1,wristbands:12,active:false,mapX:75,mapY:50}]}
  localStorage.clear();localStorage.setItem('ingressos_auth_users_v1',JSON.stringify([user]));localStorage.setItem('ingressos_auth_session_v1',user.id)
  localStorage.setItem('ingressos_platform_v2',JSON.stringify({events:[event],orders:[],coupons:[],history:[]}))
 },{base:defaultEvents[0],role})
}
for(const width of [390,1366])test('map to checkout and 8 independent tickets at '+width,async({page})=>{
 await page.setViewportSize({width,height:900});const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await seed(page);await page.goto('/evento/teste-camarotes')
 await page.getByRole('button',{name:'Somente essenciais'}).click()
 await page.screenshot({path:'test-results-camarotes/mapa-'+width+'.png',fullPage:true})
 await expect(page.getByRole('button',{name:/Camarote 02 • Bloqueado/})).toBeDisabled()
 await page.getByRole('button',{name:/Camarote 01 • Disponível/}).click()
 await expect(page.locator('.camarote-detail')).toContainText('8 pulseiras')
 await page.getByRole('button',{name:/Continuar para checkout/}).click()
 await expect(page.getByLabel('Quantidade',{exact:true})).toBeDisabled()
 await page.getByLabel('Nome (sobrenome opcional)',{exact:true}).fill('Cliente Teste')
 await page.getByLabel('CPF',{exact:true}).fill('52998224725')
 await page.getByLabel('Telefone com DDD').fill('41999999999')
 await page.getByLabel('Data de nascimento',{exact:true}).fill('2000-01-01')
 await page.getByRole('button',{name:'Confirmar compra simulada'}).click()
 await expect(page.getByRole('dialog')).toBeVisible()
 await page.getByRole('button',{name:'Salvar / Confirmar participantes'}).click()
 await expect(page).toHaveURL(/\/ingressos$/)
 await expect(page.locator('.my-ticket')).toHaveCount(8)
 await expect(page.locator('.my-ticket').first()).toContainText('1/8')
 await expect(page.locator('.my-ticket').first().getByRole('button',{name:'PDF / Salvar'})).toBeVisible()
 const order=await page.evaluate(()=>JSON.parse(localStorage.getItem('ingressos_platform_v2')).orders[0])
 expect(order.quantity).toBe(1);expect(order.subtotal).toBe(1200);expect(new Set(order.ticketCodes.map(t=>t.code)).size).toBe(8)
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'test-results-camarotes/ingressos-'+width+'.png',fullPage:false})
 await page.goto('/evento/teste-camarotes');await expect(page.getByRole('button',{name:/Camarote 01 • Indisponível/})).toBeDisabled()
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
 expect(errors).toEqual([])
})

test('Admin edits modality, price, wristbands and map coordinates',async({page})=>{
 await seed(page,'admin');await page.goto('/admin/evento/room-event/events')
 // Event list is also available to the event administrator.
 await page.goto('/admin');await page.getByRole('button',{name:'Eventos',exact:true}).click()
 await page.getByRole('button',{name:'Editar',exact:true}).first().click()
 await expect(page.getByLabel('Pulseiras inclusas').first()).toHaveValue('8')
 await page.getByLabel('Pulseiras inclusas').first().fill('10')
 await page.getByText('Mapa do evento e setores',{exact:true}).click()
 await page.getByLabel('Camarote a posicionar').selectOption('c01')
 await page.getByLabel('Posição horizontal (%)').fill('35')
 await page.getByRole('button',{name:'Salvar ingressos e preços',exact:true}).click()
 await expect(page.getByLabel('Pulseiras inclusas').first()).toHaveCount(0)
 const room=await page.evaluate(()=>JSON.parse(localStorage.getItem('ingressos_platform_v2')).events[0].ticketTypes[0])
 expect(room.wristbands).toBe(10);expect(room.mapX).toBe(35);expect(room.available).toBe(1)
})
