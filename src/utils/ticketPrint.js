export function groupTicketsForPrint(tickets){return Array.from({length:Math.ceil(tickets.length/4)},(_,i)=>tickets.slice(i*4,i*4+4))}
function printableCopy(original){
 let info;try{info=JSON.parse(original.dataset.printInfo||'null')}catch{/* Older cards keep their existing content. */}
 const qr=original.querySelector('.qr-box svg,.admin-original-qr svg')
 if(!info||!qr)return original.cloneNode(true)
 const card=document.createElement('article');card.className='my-ticket selected-print16';card.dataset.code=original.dataset.code;card.dataset.orderId=original.dataset.orderId
 const add=(tag,text)=>{const element=document.createElement(tag);element.textContent=text||'';card.append(element)}
 add('h2',info.eventTitle);add('p',info.holderName);add('p',[info.ticketName,info.batch].filter(Boolean).join(' • '));add('p','Ingresso '+info.number+' de '+info.total);add('p',[info.eventDate,info.eventTime].filter(Boolean).join(' • '))
 const box=document.createElement('div');box.className='admin-original-qr';box.append(qr.cloneNode(true));card.append(box);add('code',original.dataset.code);add('small','Pedido '+info.orderId)
 return card
}
function printSelectedCards(matches) {
 const cards=[...document.querySelectorAll('.my-ticket')].filter(card=>!card.closest('#ticket-print-document'))
 const selected=cards.filter(card=>card.dataset.printable==='true'&&matches(card.dataset))
 if(!selected.length)return
 const cleanup=()=>{document.body.classList.remove('ticket-printing','print-selected16');document.getElementById('ticket-print-document')?.remove();cards.forEach(card=>card.classList.remove('selected-print16'));window.removeEventListener('afterprint',cleanup)}
 cleanup()
 const output=document.createElement('div');output.id='ticket-print-document';output.setAttribute('aria-hidden','true')
 for(const group of groupTicketsForPrint(selected)){
  const sheet=document.createElement('section');sheet.className='ticket-print-sheet'
  for(const original of group){
   original.classList.add('selected-print16')
   const copy=printableCopy(original);copy.classList.add('ticket-print-card');copy.removeAttribute('id')
   copy.querySelectorAll('button,a,img,[role="alert"],.admin-ticket-actions').forEach(element=>element.remove())
   copy.querySelectorAll('[id]').forEach(element=>element.removeAttribute('id'))
   sheet.append(copy)
  }
  output.append(sheet)
 }
 document.body.append(output);document.body.classList.add('ticket-printing','print-selected16')
 window.addEventListener('afterprint',cleanup)
 try{window.print()}catch(error){cleanup();throw error}
}
export const printTicketCards=printSelectedCards
export const printTicket=code=>printSelectedCards(data=>data.code===code)
export const printOrderTickets=orderId=>printSelectedCards(data=>data.orderId===orderId)
export const printAllTickets=()=>printSelectedCards(()=>true)
