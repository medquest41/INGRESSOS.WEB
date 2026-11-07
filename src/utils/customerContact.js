import {normalizeEventWhatsapp} from './eventContact.js'
import {whatsappUrl} from './experience.js'
export function customerWhatsapp(buyer,eventTitle=''){
 let phone;try{phone=normalizeEventWhatsapp(buyer?.phone)}catch{return null}
 const first=String(buyer?.name||'').trim().split(/\s+/)[0]
 const greeting=first?'Olá, '+first+'! Tudo bem?':'Olá! Tudo bem?'
 const message=greeting+' Estou entrando em contato sobre sua compra'+(eventTitle?' para '+String(eventTitle).trim()+'.':' de ingressos.')
 return {phone,url:whatsappUrl(message,phone)}
}
export function customerPhoneLabel(buyer){const contact=customerWhatsapp(buyer);if(!contact)return String(buyer?.phone||'').trim()||'Não informado';const local=contact.phone.slice(2);return '+55 ('+local.slice(0,2)+') '+local.slice(2,-4)+'-'+local.slice(-4)}
