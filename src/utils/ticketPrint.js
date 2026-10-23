export function printTicketCards(matches) {
 const cards=[...document.querySelectorAll('.my-ticket')]
 const selected=cards.filter(card=>card.dataset.printable==='true'&&matches(card.dataset))
 if(!selected.length)return
 const cleanup=()=>{document.body.classList.remove('print-selected16');cards.forEach(card=>card.classList.remove('selected-print16'));window.removeEventListener('afterprint',cleanup)}
 cleanup()
 document.body.classList.add('print-selected16');selected.forEach(card=>card.classList.add('selected-print16'))
 window.addEventListener('afterprint',cleanup)
 try{window.print()}catch(error){cleanup();throw error}
}
export const printTicket=code=>printTicketCards(data=>data.code===code)
export const printOrderTickets=orderId=>printTicketCards(data=>data.orderId===orderId)
