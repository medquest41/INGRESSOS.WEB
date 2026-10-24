import {test,expect} from './support/offline-network.js'
for(const width of [390,1280])test('group of 15 preserves configured quantity and backend bundle mode '+width,async({page})=>{
 await page.setViewportSize({width,height:900});await page.goto('/tests/fixtures/ticket-setup-preview.html')
 const editor=page.locator('.ticket-batch-editor').first();await editor.locator('summary').first().click()
 await editor.getByLabel('Tipo de entrada').selectOption('individual');await editor.getByLabel('Tipo de entrada').selectOption('group')
 await editor.getByLabel('Pulseiras inclusas',{exact:true}).fill('15')
 await expect(editor.getByLabel('Tipo de entrada')).toHaveValue('group')
 await expect(editor.getByLabel('Quantidade de ingressos',{exact:true})).toHaveValue('1')
 await expect(editor.getByLabel('Quantidade de ingressos',{exact:true})).toBeDisabled()
 await page.getByRole('button',{name:'Validar rascunho de teste'}).click();await expect(page.getByTestId('draft-status')).toHaveText('Válido')
 await editor.locator('summary').first().click();await expect(editor.locator('summary').first()).toContainText('15 ingressos por unidade')
 await editor.locator('summary').first().click();await expect(editor.getByLabel('Pulseiras inclusas',{exact:true})).toHaveValue('15')
})
