// Preserve the number attached to each original QR across reloads.
export function orderedTickets(tickets){return [...tickets].sort((a,b)=>(a.ticket_number??Number.MAX_SAFE_INTEGER)-(b.ticket_number??Number.MAX_SAFE_INTEGER)||String(a.code).localeCompare(String(b.code)))}
export function ticketOrdinal(ticket,index){return Number.isInteger(ticket.number)&&ticket.number>0?ticket.number:index+1}
