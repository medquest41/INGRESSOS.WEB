import {supabase,result} from '../lib/supabase'
import {canShowQR,shareLink,ticketShareUrl} from '../utils/experience'
export async function shareTicket(order,ticket){if(!canShowQR(order,ticket))throw Error('Ingresso indisponível para compartilhar.');let url=ticketShareUrl(order);if(supabase){const token=await result(supabase.rpc('create_ticket_share',{ticket_code:ticket.code}));url=new URL('/ingresso-compartilhado#'+token,location.origin).href}await shareLink(order.eventTitle,url)}
export {printTicket,printOrderTickets} from '../utils/ticketPrint'
