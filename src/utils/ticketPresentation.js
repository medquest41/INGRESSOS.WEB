import {requiredUnitCategory} from './unitSelection.js'
export const ticketHighlights = [
  {value:'',label:'Sem destaque'},
  {value:'popular',label:'Mais vendido'},
  {value:'value',label:'Melhor custo-benefício'},
  {value:'recommended',label:'Recomendado'},
  {value:'special',label:'Oferta especial'},
  {value:'last',label:'Últimos ingressos'},
  {value:'soldout',label:'Esgotado — comemoração'},
  {value:'custom',label:'Texto personalizado'},
]
export const ticketHighlightScope=ticket=>ticket?.numberedCategoryId||ticket?.reservationCategoryId||(ticket?.tableOfferId?'offer:'+ticket.tableOfferId:ticket?.type==='camarote'&&ticket.reservationKind!=='group'&&Number(ticket.unitNumber)>0?(ticket.reservationKind==='table'?'table':'camarote'):null)
export const ticketHighlightScopeForEvent=(event,ticket)=>ticketHighlightScope(ticket)||(event?requiredUnitCategory(event,ticket)?.id:null)
const knownHighlight=value=>ticketHighlights.some(h=>h.value===value&&value)?value:''
function ticketHighlightSource(ticket,event){
 const scope=ticketHighlightScopeForEvent(event,ticket)
 if(!scope||!event)return ticket
 const peers=(event.ticketTypes||[]).filter(t=>!t.retiredForSales&&ticketHighlightScopeForEvent(event,t)===scope)
 const parent=peers.find(t=>(t.numberedCategoryId||t.type!=='camarote')&&knownHighlight(t.highlight))
 const first=peers.filter(t=>knownHighlight(t.highlight)).sort((a,b)=>Number(a.unitNumber||0)-Number(b.unitNumber||0)||String(a.id).localeCompare(String(b.id)))[0]
 return parent||first||ticket
}
export const ticketHighlightValue=(ticket,event)=>knownHighlight(ticketHighlightSource(ticket,event)?.highlight)
export const ticketHighlightText=(ticket,event)=>String(ticketHighlightSource(ticket,event)?.highlightText||'').replace(/\s+/g,' ').trim().slice(0,48)
export const ticketHighlightLabel = (ticket,event) => ticketHighlightValue(ticket,event)==='soldout'?'':ticketHighlightValue(ticket,event)==='custom'?ticketHighlightText(ticket,event):ticketHighlights.find(item=>item.value===ticketHighlightValue(ticket,event))?.label.replace(/^Sem destaque$/,'')||''
export const isNumberedUnit = ticket => ticket.type==='camarote'&&ticket.reservationKind!=='group'&&Number.isInteger(Number(ticket.unitNumber))&&Number(ticket.unitNumber)>0
export function publicTicketOptions(event){
 // Removed SKUs are retained inactive by save_event for historical integrity.
 // Inactive category parents are navigation only and need live child units.
 const availableTickets=(event.ticketTypes||[]).filter(t=>!t.retiredForSales)
 const tickets=availableTickets.filter(t=>t.active!==false||ticketHighlightValue(t,event)==='soldout'||(t.numberedCategoryId&&availableTickets.some(unit=>unit.active!==false&&isNumberedUnit(unit)&&(unit.reservationCategoryId||(unit.reservationKind==='table'?'table':'camarote'))===t.numberedCategoryId)))
 const result=tickets.filter(t=>!isNumberedUnit(t))
 const represented=new Set(result.map(t=>t.numberedCategoryId).filter(Boolean))
 for(const ticket of tickets){
  if(!isNumberedUnit(ticket))continue
  const category=ticket.reservationCategoryId||(ticket.reservationKind==='table'?'table':'camarote')
  if(represented.has(category))continue
  // Public queries can omit the inactive selector SKU. Rebuild only the
  // navigation card; checkout must still use an existing numbered unit.
  const legacySelector=result.some(t=>requiredUnitCategory(event,t)?.id===category)
  if(legacySelector){represented.add(category);continue}
  result.push({id:'unit-category:'+category,name:ticket.reservationCategoryName||(ticket.reservationKind==='table'?'Mesas VIP':'Camarotes'),type:'category',numberedCategoryId:category,price:0})
  represented.add(category)
 }
 return result.map(ticket=>({...ticket,highlight:ticketHighlightValue(ticket,event),highlightText:ticketHighlightText(ticket,event),soldOutDays:ticketHighlightSource(ticket,event)?.soldOutDays}))
}
