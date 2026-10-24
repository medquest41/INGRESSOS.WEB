import {test,expect} from './support/offline-network.js'
for(const width of [390,1280]){
 test('sections start closed and preserve edits '+width,async({page})=>{
  await page.setViewportSize({width,height:900});await page.goto('/tests/fixtures/editor-sections-preview.html')
  await expect(page.locator('main > details')).toHaveCount(3);await expect(page.locator('details[open]')).toHaveCount(0)
  const section=page.getByRole('group',{name:'Experiência, classificação e regras',exact:true})
  await section.locator('summary').first().click();await page.getByLabel('Regras do evento',{exact:true}).fill('Regra alterada')
  await section.locator('summary').first().click();await expect(page.getByLabel('Regras do evento',{exact:true})).toBeHidden()
  await section.locator('summary').first().press('Enter');await expect(page.getByLabel('Regras do evento',{exact:true})).toHaveValue('Regra alterada')
  await expect(page.getByRole('group',{name:'Listas VIP',exact:true})).not.toHaveAttribute('open','')
  await section.locator('summary').first().click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 })
 test('close accidental category and unit forms without creating items '+width,async({page})=>{
  await page.setViewportSize({width,height:900});await page.goto('/tests/fixtures/ticket-setup-preview.html')
  const panel=page.locator('.reserved-generator');await panel.locator('summary').click();await page.getByRole('button',{name:'+ Adicionar categoria',exact:true}).click()
  await page.getByLabel('Nome da categoria',{exact:true}).fill('Não criar');await page.getByRole('button',{name:'Cancelar / fechar',exact:true}).click()
  await expect(page.getByLabel('Nome da categoria',{exact:true})).toHaveCount(0);await expect(page.locator('.ticket-batch-editor')).toHaveCount(1)
  await page.getByRole('button',{name:'+ Adicionar categoria',exact:true}).click();await expect(page.getByLabel('Nome da categoria',{exact:true})).toHaveValue('Não criar');await page.getByRole('button',{name:'Fechar nova categoria',exact:true}).click()
  await page.getByRole('button',{name:'Configurar camarotes',exact:true}).click();await page.getByLabel('Quantidade de unidades',{exact:true}).fill('15');await page.getByRole('button',{name:'Fechar configuração',exact:true}).click()
  await expect(page.getByLabel('Quantidade de unidades',{exact:true})).toHaveCount(0);await expect(page.locator('.ticket-batch-editor')).toHaveCount(1)
  await page.getByRole('button',{name:'Configurar camarotes',exact:true}).click();await expect(page.getByLabel('Quantidade de unidades',{exact:true})).toHaveValue('15')
  await page.getByRole('button',{name:'Recolher categorias e unidades',exact:true}).click();await expect(panel).not.toHaveAttribute('open','');await panel.locator('summary').click();await expect(page.getByLabel('Quantidade de unidades',{exact:true})).toHaveValue('15')
 })
}
