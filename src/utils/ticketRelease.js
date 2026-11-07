import {requiredUnitCategory} from './unitSelection.js'
import {unitKind} from './reservedUnits.js'
export function scheduledTicketRelease(ticket,now=Date.now()){
 const date=new Date(ticket?.startsAt||'').getTime()
 if(ticket?.active===false||ticket?.retiredForSales||Number(ticket?.remaining??ticket?.available)<=0||!Number.isFinite(date)||date<=now)return null
 const end=new Date(ticket.endsAt||'').getTime()
 if(Number.isFinite(end)&&end<=date)return null
 return {iso:new Date(date).toISOString(),date,label:new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(date))}
}
export function publicTicketRelease(event,ticket,now=Date.now()){
 const category=requiredUnitCategory(event,ticket)
 if(!category)return scheduledTicketRelease(ticket,now)
 const units=(event.ticketTypes||[]).filter(t=>t.type==='camarote'&&!t.numberedCategoryId&&!t.retiredForSales&&t.active!==false&&unitKind(t)===category.id&&Number(t.remaining??t.available)>0&&(!t.endsAt||new Date(t.endsAt).getTime()>now))
 if(!units.length)return null
 const releases=units.map(t=>scheduledTicketRelease(t,now))
 if(releases.some(r=>!r))return null
 return releases.sort((a,b)=>a.date-b.date)[0]
}
