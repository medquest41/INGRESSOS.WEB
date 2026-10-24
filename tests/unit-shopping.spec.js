import {test,expect} from './support/offline-network.js'
for(const width of [390,1280])test('search and select numbered unit from list with total '+width,async({page})=>{
 await page.setViewportSize({width,height:900});await page.goto('/tests/fixtures/seating-flow-preview.html');await page.getByRole('button',{name:'Ver mapa e escolher número',exact:true}).click()
 const list=page.getByRole('complementary',{name:'Lista de unidades'});await expect(list.getByRole('button',{name:/Camarote 02/})).toHaveCount(0)
 await list.getByRole('searchbox').fill('15');await expect(list.locator('.unit-results button')).toHaveCount(1);await list.getByRole('button',{name:/Camarote 15/}).click();await expect(list.getByRole('button',{name:/Camarote 15/})).toHaveAttribute('aria-pressed','true')
 await expect(page.locator('.camarote-detail')).toContainText('R$ 1.320,00');await expect(page.locator('.camarote-detail')).toContainText('15 ingressos individuais');await page.getByRole('dialog').screenshot({path:'test-results-seating/selecao-revisada-'+width+'.png'})
 await list.getByRole('searchbox').fill('inexistente');await expect(list.getByText('Nenhuma unidade corresponde aos filtros.')).toBeVisible();await list.getByRole('button',{name:'Ver todos os números'}).click();await expect(list.getByRole('button',{name:/Camarote 02/})).toBeDisabled()
 await page.getByRole('button',{name:'Mesas VIP • 20 disponíveis',exact:true}).click();await expect(list.getByRole('searchbox')).toHaveValue('');await list.getByRole('searchbox').fill('20');await list.getByRole('button',{name:/Mesa VIP 20/}).click();await page.getByRole('button',{name:'Continuar para pagamento',exact:true}).click();await expect(page.getByRole('region',{name:'Conferir unidade e ingressos inclusos'})).toContainText('Mesa VIP 20')
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
})
test('availability failure blocks unknown IDs instead of falling back to local stock',async({page})=>{
 let request=0
 await page.route('**/rest/v1/rpc/camarote_availability',route=>{request++;return request===1?route.fulfill({status:503,json:{message:'offline'}}):route.fulfill({json:Array.from({length:15},(_,i)=>({id:String(i),status:'available'}))})})
 await page.goto('/tests/fixtures/seating-flow-preview.html?remote=1');await page.getByRole('button',{name:'Ver mapa e escolher número',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Não foi possível confirmar a disponibilidade');await expect(page.locator('.camarote-pin:not(:disabled)')).toHaveCount(0)
 await page.getByRole('button',{name:'Consultar novamente',exact:true}).click();await expect(page.getByRole('alert')).toHaveCount(0)
 // Unknown IDs in a response must never become available through the local stock fallback.
 await expect(page.locator('.camarote-pin:not(:disabled)')).toHaveCount(0);expect(request).toBe(2)
 await page.getByRole('button',{name:'Fechar seleção de unidade'}).click();await expect(page.locator('.camarote-pin')).toHaveCount(0)
})
test('Admin search preserves values and a validation error reveals hidden fields',async({page})=>{
 await page.goto('/tests/fixtures/event-error-preview.html');await page.locator('.editor-disclosure>summary').click();await page.getByRole('searchbox').fill('inexistente');await expect(page.locator('.ticket-batch-editor:visible')).toHaveCount(0);await page.getByRole('button',{name:'Salvar teste',exact:true}).click();await expect(page.locator('[data-ticket-index="1"] [data-field="name"]')).toBeFocused();await expect(page.getByRole('searchbox')).toHaveValue('');await page.getByRole('button',{name:'Recolher todos os ingressos'}).click();await expect(page.locator('.ticket-batch-editor[open]')).toHaveCount(0)
})

test('a selected unit cannot continue after refresh fails or reports sold',async({page})=>{
 await page.clock.install();let request=0
 await page.route('**/rest/v1/rpc/camarote_availability',async route=>{request++;if(request===2)return route.fulfill({status:503,json:{message:'offline'}});const ids=await page.locator('.camarote-pin').evaluateAll(pins=>pins.map(pin=>pin.dataset.unitId));return route.fulfill({json:ids.map((id,index)=>({id,status:request>=3&&index===ids.length-1?'sold':'available'}))})})
 await page.goto('/tests/fixtures/seating-flow-preview.html?remote=1');await page.getByRole('button',{name:'Ver mapa e escolher número',exact:true}).click();const pin=page.locator('.camarote-pin').last();await expect(pin).toBeEnabled();await pin.click();const proceed=page.getByRole('button',{name:'Continuar para pagamento'});await expect(proceed).toBeEnabled();await page.clock.fastForward(15000);await expect(page.getByRole('alert').first()).toContainText('Não foi possível confirmar');await expect(proceed).toBeDisabled();await page.getByRole('button',{name:'Consultar novamente'}).click();await expect(pin).toHaveClass(/sold/);await expect(proceed).toBeDisabled();await expect(page.locator('.camarote-detail')).toContainText('Escolha outro número')
})
