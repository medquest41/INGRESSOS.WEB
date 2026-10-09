import {test,expect} from '@playwright/test'
for(const width of [1440,1024,390,320]){
 test('16.3 header, selectors, hero and ticker are readable at '+width+'px',async({page})=>{
  await page.setViewportSize({width,height:900});await page.goto('/eventos');await page.getByRole('button',{name:'Somente essenciais',exact:true}).click()
  await expect(page.locator('.hero h1')).toHaveText('Descubra o evento que combina com você');await expect(page.locator('.hero-description')).toBeVisible()
  const geometry=await page.evaluate(()=>{const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right}};return {header:box('.topbar'),tools:box('.public-tools16'),ticker:box('.ticker16'),hero:box('.hero'),width:innerWidth,scrollWidth:document.documentElement.scrollWidth}})
  expect(geometry.tools.top).toBeGreaterThanOrEqual(geometry.header.top);expect(geometry.tools.bottom).toBeLessThanOrEqual(geometry.header.bottom);expect(geometry.tools.right).toBeLessThanOrEqual(geometry.header.right);expect(geometry.tools.right).toBeGreaterThanOrEqual(geometry.header.right-24);expect(geometry.header.bottom).toBeLessThanOrEqual(geometry.ticker.top);expect(geometry.ticker.bottom).toBeLessThanOrEqual(geometry.hero.top);expect(geometry.header.left).toBeGreaterThanOrEqual(0);expect(geometry.header.right).toBeLessThanOrEqual(width);expect(geometry.scrollWidth).toBeLessThanOrEqual(width)
  await expect(page.locator('.ticker-group16').first().locator('span')).toHaveCount(5)
  await page.locator('.public-tools16').getByLabel('Idioma').selectOption('en');await expect(page.locator('.hero h1')).toHaveText('Discover the event that suits you')
  await page.screenshot({path:'../home16.2-'+width+'.png',fullPage:false})
 })
}
test('16.3 reduced motion shows every promotional message without animation',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:390,height:900});await page.goto('/');await page.getByRole('button',{name:'Somente essenciais',exact:true}).click();for(const span of await page.locator('.ticker-group16').first().locator('span').all())await expect(span).toBeVisible();expect(await page.locator('.ticker-track16').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');await expect(page.locator('.ticker-group16').nth(1)).toBeHidden()
})

test('16.4 party effects can be paused and respect reduced motion',async({page})=>{
 await page.goto('/eventos');await page.getByRole('button',{name:'Somente essenciais',exact:true}).click()
 await expect(page.locator('.party-atmosphere')).toHaveAttribute('aria-hidden','true')
 expect(await page.locator('.party-atmosphere').evaluate(el=>getComputedStyle(el).pointerEvents)).toBe('none')
 await page.getByRole('button',{name:'Pausar efeitos de festa'}).click()
 await expect(page.getByRole('button',{name:'Ativar efeitos de festa'})).toHaveAttribute('aria-pressed','true')
 expect(await page.locator('.party-confetti').first().evaluate(el=>getComputedStyle(el).animationPlayState)).toBe('paused')
 await page.getByRole('button',{name:'Ativar efeitos de festa'}).click()
 expect(await page.locator('.party-confetti').first().evaluate(el=>getComputedStyle(el).animationPlayState)).toBe('running')
 await page.emulateMedia({reducedMotion:'reduce'})
 await expect(page.locator('.party-firework').first()).toBeHidden()
 expect(await page.locator('.party-confetti').first().evaluate(el=>getComputedStyle(el).animationName)).toBe('none')
})
