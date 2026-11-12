import {requiredUnitCategory} from './unitSelection.js'
import {unitKind} from './reservedUnits.js'

// The organizer supplies the optional duration; never infer it from a visitor's clock.
export function soldOutCelebration(event,ticket,now=Date.now(),release=null){
 if(ticket.highlight!=='soldout'||release)return null
 const category=requiredUnitCategory(event,ticket)
 const units=category?(event.ticketTypes||[]).filter(t=>t.type==='camarote'&&!t.numberedCategoryId&&!t.retiredForSales&&t.active!==false&&unitKind(t)===category.id):[ticket]
 if(!units.length||units.some(t=>Number(t.remaining??t.available)>0||new Date(t.startsAt||'').getTime()>now))return null
 const days=Number(ticket.soldOutDays)
 const validDays=Number.isInteger(days)&&days>=1&&days<=3650
 return {daysLabel:validDays?`Esgotado em ${days} ${days===1?'dia':'dias'}`:''}
}
