import {ticketHighlightValue} from './ticketPresentation.js'

// The organizer supplies the optional duration; never infer it from a visitor's clock.
export function soldOutCelebration(event,ticket){
 if(ticketHighlightValue(ticket,event)!=='soldout'||ticket.retiredForSales)return null
 const days=Number(ticket.soldOutDays)
 const validDays=Number.isInteger(days)&&days>=1&&days<=3650
 return {daysLabel:validDays?`Esgotado em ${days} ${days===1?'dia':'dias'}`:''}
}

export const ticketSalesClosed=(event,ticket)=>ticketHighlightValue(ticket,event)==='soldout'
export function closeSoldOutSales(event){return {...event,ticketTypes:(event.ticketTypes||[]).map(ticket=>ticketSalesClosed(event,ticket)?{...ticket,active:false}:ticket)}}

export function ticketAvailabilityLabel(ticket,remaining,now=Date.now()){
 if(remaining>0)return remaining+' disponíveis'
 if(ticket.endsAt&&new Date(ticket.endsAt).getTime()<=now)return 'Vendas encerradas'
 if(ticket.sequential&&Number(ticket.remaining??ticket.available)>0)return 'Aguardando lote anterior'
 return Number(ticket.remaining??ticket.available)>0?'Vendas indisponíveis no momento':'Sem unidades disponíveis'
}

export function preserveRemovedTickets(event,originalTickets=[]){
 const ids=new Set((event.ticketTypes||[]).map(t=>String(t.id)))
 const removed=originalTickets.filter(t=>!ids.has(String(t.id))).map(t=>({...t,active:false,retiredForSales:true,highlight:''}))
 return {...event,ticketTypes:[...(event.ticketTypes||[]),...removed]}
}
