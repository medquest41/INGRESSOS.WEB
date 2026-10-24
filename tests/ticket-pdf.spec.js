import {test,expect} from './support/offline-network.js'
for(const count of [1,4,5,10,15,30])test('PDF has four originals per page; count '+count,async({page})=>{
 await page.goto('/tests/fixtures/support-preview.html?count='+count)
 await page.getByText('Mostrar pedidos',{exact:true}).click();await page.getByText('Detalhes do pedido',{exact:true}).click();await page.getByRole('button',{name:'Ver ingressos / baixar PDF ('+count+')',exact:true}).click()
 await page.evaluate(()=>{window.print=()=>{}});await page.getByRole('button',{name:'PDF de todos os ingressos válidos (4 por página)',exact:true}).click()
 const sheets=page.locator('#ticket-print-document .ticket-print-sheet');await expect(sheets).toHaveCount(Math.ceil(count/4));await expect(page.locator('#ticket-print-document .ticket-print-card')).toHaveCount(count)
 const codes=await page.locator('#ticket-print-document .ticket-print-card').evaluateAll(cards=>cards.map(c=>c.dataset.code));expect(new Set(codes).size).toBe(count)
 await page.pdf({path:'test-results-ticket-pdf/ingressos-'+count+'.pdf',format:'A4',preferCSSPageSize:true,printBackground:true})
 await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));await expect(page.locator('#ticket-print-document')).toHaveCount(0)
})
