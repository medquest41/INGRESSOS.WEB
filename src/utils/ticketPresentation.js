import {requiredUnitCategory} from './unitSelection.js'
export const ticketHighlights = [
  {value:'',label:'Sem destaque'},
  {value:'popular',label:'Mais vendido'},
  {value:'value',label:'Melhor custo-benefício'},
  {value:'recommended',label:'Recomendado'},
  {value:'special',label:'Oferta especial'},
]
export const ticketHighlightLabel = ticket => ticketHighlights.find(item=>item.value===ticket?.highlight)?.label.replace(/^Sem destaque$/,'')||''
export const isNumberedUnit = ticket => ticket.type==='camarote'&&ticket.reservationKind!=='group'&&Number.isInteger(Number(ticket.unitNumber))&&Number(ticket.unitNumber)>0
export function publicTicketOptions(event){
 const tickets=(event.ticketTypes||[]).filter(t=>!t.retiredForSales)
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
 return result
}
