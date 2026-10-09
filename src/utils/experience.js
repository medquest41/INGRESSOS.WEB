import { validCPF } from './commerce.js'
export const needsAgeConfirmation=e=>e.ageRating==='18+'||e.requireAgeConfirmation===true
export function validateAge(event,birthDate,confirmed,now=new Date()) {
 const birth=new Date(birthDate+'T12:00:00');if(!/^\d{4}-\d{2}-\d{2}$/.test(birthDate||'')||!Number.isFinite(birth.getTime())||birth>now||birth.getFullYear()<1900||birth.getFullYear()!==Number(birthDate.slice(0,4))||birth.getMonth()+1!==Number(birthDate.slice(5,7))||birth.getDate()!==Number(birthDate.slice(8,10)))throw Error('Confira a data de nascimento.')
 const age=now.getFullYear()-birth.getFullYear()-(now.getMonth()<birth.getMonth()||(now.getMonth()===birth.getMonth()&&now.getDate()<birth.getDate())?1:0)
 const minimum=event.ageRating==='Livre'?0:parseInt(event.ageRating||'0',10)
 if(age<minimum)throw Error('Idade inferior à classificação do evento.')
 if(needsAgeConfirmation(event)&&(!confirmed||age<18))throw Error('Confirme que você tem 18 anos ou mais.')
}
export function validateParticipants(event,quantity,buyer,participants,mode,confirmed) {
 if(!Number.isInteger(quantity)||quantity<1||quantity>10)throw Error('Escolha entre 1 e 10 ingressos.')
 if(mode==='same'&&event.allowSameCpf===false&&quantity>1)throw Error('Este evento exige participantes individuais.')
 const list=mode==='same'?Array.from({length:quantity},()=>({name:buyer.name,cpf:buyer.cpf,birthDate:buyer.birthDate})):participants
 if(list.length!==quantity)throw Error('Informe um participante por ingresso.')
 const seen=new Set()
 return list.map(p=>{if(!p.name?.trim().includes(' ')||!validCPF(p.cpf))throw Error('Confira nome completo e CPF de cada participante.');validateAge(event,p.birthDate,confirmed);const cpf=p.cpf.replace(/\D/g,'');if(event.allowSameCpf===false&&seen.has(cpf))throw Error('Este evento não permite repetir CPF.');seen.add(cpf);return {name:p.name.trim(),cpf,birthDate:p.birthDate}})
}
export const canShowQR=(order,ticket)=>order.status==='approved'&&!order.paymentReview&&ticket.status!=='cancelled'&&!ticket.used
export const eventIsPublic=e=>e.published&&!e.archived&&!e.hidden
export function countdown(e,now=Date.now()){const target=new Date(e.startsAt||e.eventStartsAt||'').getTime();if(!Number.isFinite(target))return 'Data: '+e.date;const d=target-now;return d<=0?'Chegou o dia!':'Faltam '+Math.floor(d/86400000)+'d '+Math.floor(d/3600000)%24+'h'}
export function distanceKm(a,b){if(!a||!b||![a.latitude,a.longitude,b.latitude,b.longitude].every(Number.isFinite))return Infinity;const rad=x=>x*Math.PI/180;const dlat=rad(b.latitude-a.latitude),dlon=rad(b.longitude-a.longitude);return 6371*2*Math.asin(Math.sqrt(Math.sin(dlat/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(dlon/2)**2))}
export function whatsappUrl(text,phone=''){const digits=String(phone).replace(/\D/g,'');return 'https://wa.me/'+digits+'?text='+encodeURIComponent(text)}
export async function shareLink(title,url){const parsed=new URL(url);if(!['https:','http:'].includes(parsed.protocol))throw Error('Link inválido.');const text='Bora para '+title+'? 🎉';if(navigator.share){try{await navigator.share({title,text,url});return}catch(err){if(err.name==='AbortError')return}}window.location.assign(whatsappUrl(text+' '+url))}
export function ticketShareUrl(order){return new URL('/ingressos?pedido='+encodeURIComponent(order.id),window.location.origin).href}
