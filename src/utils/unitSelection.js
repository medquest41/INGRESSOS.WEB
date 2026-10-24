import {getReservedCategories,unitKind} from './reservedUnits.js'
export const searchText=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()
export function requiredUnitCategory(event,ticket){
 if(!event||!ticket||ticket.type==='camarote')return null
 const text=searchText([ticket.name,ticket.sector].join(' '))
 const numbered=(event.ticketTypes||[]).filter(t=>t.type==='camarote'&&!t.retiredForSales&&Number.isInteger(Number(t.unitNumber))&&Number(t.unitNumber)>0)
 const kind=value=>/camarote/.test(value)?'camarote':/mesa/.test(value)?'table':null
 return getReservedCategories(event).find(c=>numbered.some(t=>unitKind(t)===c.id)&&(text===searchText(c.name)||text===searchText(c.prefix)||text.includes(searchText(c.name))||kind(text)&&kind(text)===kind(searchText(c.name))))||null
}
export function filterUnits(units,{query='',availableOnly=false,sort='number',status=()=> 'available'}={}){
 const text=searchText(query)
 return units.filter(t=>(!availableOnly||status(t)==='available')&&(!text||searchText(t.name).includes(text)||String(unitMarkerLabel(t))===text)).sort((a,b)=>sort==='price'?Number(a.price)-Number(b.price)||String(a.name).localeCompare(String(b.name),'pt-BR',{numeric:true}):String(a.name).localeCompare(String(b.name),'pt-BR',{numeric:true}))
}
export function unitMarkerLabel(ticket){const number=String(ticket.name||'').trim().match(/(?:^|\s)(\d{1,3})$/);return number?String(Number(number[1])):ticket.unitNumber||ticket.name}
