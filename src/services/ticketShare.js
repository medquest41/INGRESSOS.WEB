import {ticketOrdinal} from '../utils/ticketNumbering'
import {supabase,result} from '../lib/supabase'
import {canShowQR,ticketShareUrl,whatsappUrl} from '../utils/experience'
import {normalizeEventWhatsapp} from '../utils/eventContact'
async function ticketUrl(order,ticket,admin){
 if(!canShowQR(order,ticket))throw Error('Ingresso indisponível para compartilhar.')
 if(!supabase){if(admin)throw Error('Compartilhamento com o comprador disponível somente no ambiente online.');return ticketShareUrl(order)}
 const response=await supabase.rpc(admin?'create_admin_ticket_share':'create_ticket_share',{ticket_code:ticket.code})
 if(response.error&&admin&&['PGRST202','42883'].includes(response.error.code))throw Error('O reenvio seguro pelo Admin ainda precisa ser habilitado no banco. Você já pode salvar o PDF dos ingressos originais.')
 const token=await result(response)
 return new URL('/ingresso-compartilhado#'+token,location.origin).href
}
function buyerPhone(order){try{return normalizeEventWhatsapp(order.buyer?.phone)||''}catch{return ''}}
export async function shareTicket(order,ticket,{admin=false}={}){
 const phone=admin?buyerPhone(order):''
 const url=await ticketUrl(order,ticket,admin)
 const index=Math.max(0,(order.ticketCodes||[]).findIndex(t=>t.code===ticket.code))
 const text='Seu ingresso '+ticketOrdinal(ticket,index)+' de '+(order.wristbands||order.ticketCodes?.length||1)+' para '+order.eventTitle+' — '+order.ticketName+'. Link válido por 24 horas. Você pode abrir e salvar o PDF: '+url
 window.location.assign(whatsappUrl(text,phone))
}
export async function shareOrderTickets(order){
 const phone=buyerPhone(order),tickets=(order.ticketCodes||[]).filter(t=>canShowQR(order,t))
 if(!tickets.length)throw Error('Nenhum ingresso válido disponível para enviar.')
 const links=[];for(const ticket of tickets)links.push(await ticketUrl(order,ticket,true))
 const text='Seus ingressos para '+order.eventTitle+' — '+order.ticketName+'. Links válidos por 24 horas; abra cada um para salvar o PDF.\n'+links.map((link,i)=>'Ingresso '+ticketOrdinal(tickets[i],i)+' de '+(order.wristbands||order.ticketCodes.length)+': '+link).join('\n')
 window.location.assign(whatsappUrl(text,phone))
}
import '../components/TicketPrint.css'
export {printTicket,printOrderTickets,printAllTickets} from '../utils/ticketPrint'
