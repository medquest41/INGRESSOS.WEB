export const ticketHighlights = [
  {value:'',label:'Sem destaque'},
  {value:'popular',label:'Mais vendido'},
  {value:'value',label:'Melhor custo-benefício'},
  {value:'recommended',label:'Recomendado'},
  {value:'special',label:'Oferta especial'},
]
export const ticketHighlightLabel = ticket => ticketHighlights.find(item=>item.value===ticket?.highlight)?.label.replace(/^Sem destaque$/,'')||''
export const isNumberedUnit = ticket => ticket.type==='camarote'&&ticket.reservationKind!=='group'&&Number.isInteger(Number(ticket.unitNumber))&&Number(ticket.unitNumber)>0
export const publicTicketOptions = event => (event.ticketTypes||[]).filter(ticket=>!ticket.retiredForSales&&!isNumberedUnit(ticket))
