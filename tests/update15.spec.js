import { test, expect } from '@playwright/test'
import { createHash } from 'node:crypto'
import { defaultEvents } from '../src/data/defaultEvents.js'
import { safeReturnTo, loginPath, authDestination } from '../src/utils/authReturn.js'
test('destinations reject external, encoded, malformed and unknown redirects',()=>{
 for(const value of ['https://evil.test','//evil.test','/\\evil.test','/%2f%2fevil.test','/evento/%5cevil','/login','/eventos\n','/evento/%ZZ','/evento/a#x','/unknown']) expect(safeReturnTo(value)).toBeNull()
 expect(authDestination('?returnTo=https://evil.test','/ingressos')).toBe('/eventos')
 expect(authDestination('')).toBe('/eventos')
 expect(loginPath('/evento/festa?ref=link')).toBe('/login?returnTo=%2Fevento%2Ffesta%3Fref%3Dlink')
})
async function seed(page){
 await page.goto('/')
 await page.evaluate(({events,hash})=>{
 localStorage.setItem('ingressos_auth_users_v1',JSON.stringify([{id:'cliente',name:'Cliente Teste',email:'cliente@example.test',passwordHash:hash,role:'cliente',active:true}]))
 localStorage.setItem('ingressos_events_v1',JSON.stringify(events.map((e,i)=>({...e,published:i!==2,archived:i===1}))))
 },{events:defaultEvents,hash:createHash('sha256').update('Teste-local-123').digest('hex')})
}
async function enter(page){await page.getByLabel('E-mail',{exact:true}).fill('cliente@example.test');await page.getByLabel('Senha',{exact:true}).fill('Teste-local-123');await page.getByRole('button',{name:'Entrar',exact:true}).click()}
test('general Entrar always carries an explicit public catalog destination',async({page})=>{
 await seed(page);await page.goto('/');
 const href=await page.getByRole('link',{name:'Entrar',exact:true}).getAttribute('href');
 expect(href).toBe('/login?returnTo=%2Feventos')
})
test('general Entrar shows only published nonarchived events',async({page})=>{
 await seed(page);await page.goto('/');await page.getByRole('link',{name:'Entrar',exact:true}).click();await enter(page)
 await expect(page).toHaveURL(/\/eventos$/);await expect(page.locator('.event-card')).toHaveCount(1)
 await page.getByRole('link',{name:'Meus ingressos',exact:true}).first().click();await expect(page).toHaveURL(/\/ingressos$/)
})
test('event login preserves event and referral through reload',async({page})=>{
 await seed(page);await page.goto('/eventos');const href=await page.locator('.event-card').first().getAttribute('href')
 await page.goto(href+'?ref=campanha');await page.getByRole('link',{name:'Entrar',exact:true}).click();await page.reload();await enter(page)
 await expect(page).toHaveURL(new RegExp(href+'\\?ref=campanha$'))
})
test('explicit Meus ingressos still opens tickets after login',async({page})=>{
 await seed(page);await page.goto('/');await page.getByRole('link',{name:'Meus ingressos',exact:true}).first().click();await enter(page);await expect(page).toHaveURL(/\/ingressos$/)
})
test('event signup retains returnTo and returns to event',async({page})=>{
 await seed(page);await page.goto('/eventos');const href=await page.locator('.event-card').first().getAttribute('href');await page.goto(loginPath(href));await page.getByRole('button',{name:'Criar conta',exact:true}).click();await page.getByLabel('Seu nome').fill('Novo Cliente');await page.getByLabel('E-mail',{exact:true}).fill('novo@example.test');await page.getByLabel('Senha',{exact:true}).fill('Teste-local-123');await page.getByLabel('CPF',{exact:true}).fill('52998224725');await page.getByLabel('Data de nascimento').fill('2000-01-01');await page.getByLabel('Celular com DDD').fill('41999999999');await page.getByLabel('Confirmar e-mail').fill('novo@example.test');await page.getByRole('button',{name:'Criar conta',exact:true}).click();await expect(page).toHaveURL(new RegExp(href+'$'))
})
test('malicious returnTo falls back to public catalog',async({page})=>{
 await seed(page);await page.goto('/login?returnTo='+encodeURIComponent('//evil.test'));await enter(page);await expect(page).toHaveURL(/\/eventos$/)
})

test('15.2 bare login and restored session stay on public catalog',async({page})=>{
 await seed(page);await page.goto('/login');await enter(page);await expect(page).toHaveURL(/\/eventos$/)
 await page.goto('/login');await expect(page).toHaveURL(/\/eventos$/)
 await page.getByRole('link',{name:'Minha conta',exact:true}).click();await expect(page).toHaveURL(/\/eventos$/)
})
test('15.2 nested admin denial never redirects customer to tickets',async({page})=>{
 await seed(page)
 await page.evaluate(()=>{const users=JSON.parse(localStorage.getItem('ingressos_auth_users_v1'));users.push({id:'admin',email:'ingressosaltatemporada@gmail.com',role:'admin',active:true});localStorage.setItem('ingressos_auth_users_v1',JSON.stringify(users))})
 await page.goto('/admin/evento/festa/vendas');await enter(page);await expect(page).toHaveURL(/\/eventos$/)
 await page.goto('/admin');await expect(page).toHaveURL(/\/eventos$/)
})
test('15.2 canonical tickets alias remains an explicit destination',async({page})=>{
 await seed(page);await page.goto('/meus-ingressos');await enter(page);await expect(page).toHaveURL(/\/meus-ingressos$/)
})
