import {test,expect} from './support/offline-network.js'
for(const width of [390,1280])test('save opens nested sections, focuses duplicate name and shows Portuguese correction '+width,async({page})=>{
 await page.setViewportSize({width,height:900});await page.goto('/tests/fixtures/event-error-preview.html');await expect(page.locator('details[open]')).toHaveCount(0)
 await page.getByRole('button',{name:'Salvar teste',exact:true}).click()
 const field=page.locator('[data-ticket-index="1"] [data-field="name"]');await expect(field).toBeFocused();await expect(field).toHaveAttribute('aria-invalid','true');await expect(page.locator('.event-field-error')).toContainText('Altere o nome');await expect(page.locator('details[open]')).toHaveCount(2)
 expect(await field.evaluate(el=>getComputedStyle(el).borderTopColor)).toBe('rgb(255, 112, 124)');await field.fill('Camarote 02');await page.getByRole('button',{name:'Salvar teste',exact:true}).click();await expect(page.locator('.event-save-error')).toHaveText('Salvo no teste')
})
