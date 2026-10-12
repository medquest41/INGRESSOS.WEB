export function normalizeEventWhatsapp(value) {
 const digits=String(value||'').replace(/\D/g,'')
 const local=digits.length===12||digits.length===13?digits.startsWith('55')?digits.slice(2):'':digits
 if(!/^[1-9][0-9](?:9[0-9]{8}|[2-5][0-9]{7})$/.test(local))throw Error('Informe o WhatsApp do responsável pelo evento com DDD e número. Ex.: (45) 99999-9999.')
 return '55'+local
}
export function eventContactPhone(event,organizations=[]) {
 const value=event.whatsapp||event.organizerWhatsapp||organizations.find(o=>o.id===event.organizerId)?.whatsapp
 try{return normalizeEventWhatsapp(value)}catch{return ''}
}
