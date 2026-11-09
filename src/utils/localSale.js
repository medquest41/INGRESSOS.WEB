import {canManage,validCPF,remaining} from './commerce.js'
import {validateAge} from './experience.js'
export function localSaleTerms(ticket,input={}){
 const name=String(input.name??ticket.name).trim(),unitPriceCents=input.unitPriceCents===undefined?Math.round(Number(ticket.price)*100):input.unitPriceCents
 if(!name||name.length>120)throw Error('Preencha o nome do ingresso nesta venda com até 120 caracteres.')
 if(!Number.isSafeInteger(unitPriceCents)||unitPriceCents<0||unitPriceCents>100000000)throw Error('Informe um valor válido para esta venda, com até duas casas decimais.')
 return {name,unitPriceCents}
}
export function localSaleBuyer(input={},event={}){
 const name=String(input.name||'').trim(),cpf=String(input.cpf||'').replace(/\D/g,''),phone=String(input.phone||'').replace(/\D/g,''),email=String(input.email||'').trim().toLowerCase(),birthDate=String(input.birthDate||'')
 if(name.length>120)throw Error('Use até 120 caracteres na identificação opcional.')
 if(input.cpf&&!validCPF(cpf))throw Error('Confira o CPF opcional ou deixe o campo vazio.')
 if(input.phone&&!/^\d{10,13}$/.test(phone))throw Error('Confira o telefone com DDD ou deixe o campo vazio.')
 if(email&&(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))throw Error('Confira o e-mail opcional.')
 if(birthDate)validateAge(event,birthDate,true)
 return {name:name||'Venda local',cpf:cpf||null,phone:phone||null,email:email||null,birthDate:birthDate||null}
}
export function createDemoLocalSale(state,user,input){
 const event=state.events.find(e=>e.id===input.eventId),ticket=event?.ticketTypes.find(t=>t.id===input.ticketId)
 if(!user?.active||user.guest||!canManage(user,event))throw Error('Somente o organizador responsável pode registrar venda local.')
 if(!input.received||!input.eligible)throw Error('Confirme o recebimento e a conferência presencial das regras do evento.')
 if(!ticket)throw Error('Escolha um ingresso disponível.')
 const terms=localSaleTerms(ticket,input.saleOverrides),buyer=localSaleBuyer(input.buyer,event),existing=state.orders.find(o=>o.idempotencyKey===input.requestId)
 if(existing){if(existing.userId!==user.id||existing.ticketId!==input.ticketId||existing.quantity!==input.quantity||JSON.stringify(existing.localRequestBuyer)!==JSON.stringify(buyer)||JSON.stringify(existing.localSaleOverrides)!==JSON.stringify(terms)||Math.round(existing.total*100)!==input.expectedCents)throw Error('Esta tentativa já foi usada com outros dados. Confira a emissão anterior.');return existing}
 const units=Number(input.quantity)
 if(!ticket||!Number.isInteger(units)||units<1||units>10||!event.published||event.archived||ticket.active===false||ticket.retiredForSales||ticket.numberedCategoryId||ticket.startsAt&&new Date(ticket.startsAt)>new Date()||ticket.endsAt&&new Date(ticket.endsAt)<=new Date())throw Error('Este ingresso não está liberado para venda.')
 if(['camarote','table'].includes(ticket.type)&&units!==1)throw Error('Escolha uma mesa ou camarote inteiro por venda.')
 if(remaining(event,ticket,state.orders)<units)throw Error('Estoque insuficiente. Atualize as opções.')
 const total=terms.unitPriceCents*units/100;if(Math.round(total*100)!==input.expectedCents)throw Error('O preço mudou. Atualize e confira o valor recebido.')
 const count=ticket.type==='camarote'?Number(ticket.wristbands):units
 if(!Number.isInteger(count)||count<1||count>100)throw Error('Confira a quantidade de ingressos inclusos.')
 const order={id:crypto.randomUUID(),userId:user.id,eventId:event.id,ticketId:ticket.id,quantity:units,status:'approved',paymentStatus:'approved',paymentMethod:'local_cash',saleChannel:'local',localReceivedBy:user.id,localReceivedAt:new Date().toISOString(),localEligibilityConfirmed:true,localFeePolicy:'no_platform_fee',localRequestBuyer:buyer,localSaleOverrides:terms,localCatalogPriceCents:Math.round(Number(ticket.price)*100),buyer,idempotencyKey:input.requestId,source:'venda_local',eventTitle:event.title,eventDate:event.date,eventTime:event.time,ticketName:terms.name+(ticket.unitNumber&&terms.name!==ticket.name?' • '+ticket.name:''),batch:ticket.batch,sector:ticket.sector,total,subtotal:total,discount:0,fee:0,platformFee:0,feeRate:0,feePayer:'organizer',providerFee:null,createdAt:new Date().toISOString(),...(ticket.type==='camarote'?{wristbands:count}:{}),ticketCodes:Array.from({length:count},(_,i)=>({code:crypto.randomUUID(),number:i+1,holder:i===0?buyer:{name:'Venda local'},status:'valid',used:false}))}
 state.orders.unshift(order);return order
}
