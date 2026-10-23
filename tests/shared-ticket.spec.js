import {test,expect} from './support/offline-network.js'
import {QRCodeReader,RGBLuminanceSource,HybridBinarizer,BinaryBitmap} from '@zxing/library'
for(const width of [390,1280])test('shared QR remains centered and readable at '+width,async({page})=>{
 await page.setViewportSize({width,height:1100})
 await page.route('https://camarotes-test.supabase.co/**',route=>{
  const path=new URL(route.request().url()).pathname
  const response=path.endsWith('/read_ticket_share')?{eventTitle:'RÉVEILLON 2027',holderName:'Participante de teste',ticketName:'CAMAROTE 01',batch:'8 pulseiras',eventDate:'1 de janeiro de 2027',eventTime:'22:00',code:'00000000-0000-4000-8000-000000000001'}:path.includes('/events')||path.includes('/catalog_stock')?[]:{}
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(response)})
 })
 await page.goto('/ingresso-compartilhado#'+'a'.repeat(64))
 await expect(page.getByRole('img',{name:'QR Code do ingresso'})).toBeVisible()
 await page.getByRole('button',{name:'Somente essenciais',exact:true}).click()
 const card=await page.locator('.shared-ticket-card').boundingBox(),qr=await page.getByRole('img',{name:'QR Code do ingresso'}).boundingBox()
 expect(Math.abs((card.x+card.width/2)-(qr.x+qr.width/2))).toBeLessThan(1)
 expect(qr.width).toBe(200)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 const screenQR=await page.locator('.shared-ticket-qr').screenshot()
 const raster=await page.evaluate(async data=>{
  const img=new Image();img.src=data;await img.decode()
  const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height
  const context=canvas.getContext('2d');context.drawImage(img,0,0)
  const rgba=context.getImageData(0,0,img.width,img.height).data
  return {width:img.width,height:img.height,luminance:Array.from({length:img.width*img.height},(_,i)=>(rgba[i*4]*306+rgba[i*4+1]*601+rgba[i*4+2]*117)>>10)}
 },'data:image/png;base64,'+screenQR.toString('base64'))
 const decoded=new QRCodeReader().decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(Uint8ClampedArray.from(raster.luminance),raster.width,raster.height))))
 expect(decoded.getText()).toBe('00000000-0000-4000-8000-000000000001')
 await page.locator('.shared-ticket-page').screenshot({path:'test-results-shared-ticket/compartilhado-'+width+'.png'})
 await page.emulateMedia({media:'print'})
 await expect(page.getByRole('button',{name:'PDF / Salvar ingresso'})).toBeHidden()
 await expect(page.getByRole('img',{name:'QR Code do ingresso'})).toBeVisible()
})

