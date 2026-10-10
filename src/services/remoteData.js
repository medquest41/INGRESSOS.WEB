import { paged } from '../lib/pagination'
import { supabase, result } from '../lib/supabase'
import { withOptionalOrganizerContact } from './catalogCompatibility'
const uuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value || '')
export function eventPayload(input,organizations){
 if(input.feeRate === '' || !Number.isFinite(Number(input.feeRate??0.1)) || Number(input.feeRate??0.1)<0 || Number(input.feeRate??0.1)>1 || !['buyer','organizer'].includes(input.feePayer||'buyer'))throw new Error('Confira a taxa e quem paga.');
 return {...input,feeRate:Number(input.feeRate??0.1),feePayer:input.feePayer||'buyer',id:uuid(input.id)?input.id:crypto.randomUUID(),organizerId:uuid(input.organizerId)?input.organizerId:organizations.find(o=>o.active)?.id,
 ticketTypes:input.ticketTypes.map(t=>({...t,id:uuid(t.id)?t.id:crypto.randomUUID()}))}
}
export function mapEvent(e,stock){
 const ticketTypes=(e.ticket_types||[]).map(t=>({...t.details,id:t.id,name:t.name,sector:t.sector,batch:t.batch,type:t.type,price:t.price_cents/100,available:t.capacity,active:t.active,startsAt:t.starts_at,endsAt:t.ends_at,position:t.position,sequential:t.sequential,remaining:stock.find(s=>s.id===t.id)?.remaining||0,open:stock.find(s=>s.id===t.id)?.open===true}))
 return {...e.details,id:e.id,legacyId:e.legacy_id,slug:e.slug,title:e.title,published:e.published,archived:e.archived,organizerId:e.organization_id,organizerName:e.organizations?.name||'',organizerWhatsapp:e.organizations?.whatsapp||e.details?.organizerWhatsapp||'',feeRate:Number(e.fee_rate),feePayer:e.details?.feePayer||'buyer',ticketTypes,price:ticketTypes.some(t=>t.active)?Math.min(...ticketTypes.filter(t=>t.active).map(t=>t.price)):0}
}
export function mapOrder(o){return {...o.snapshot,emailDeliveryStatus:o.email_delivery_status,id:o.id,userId:o.user_id,eventId:o.event_id,ticketId:o.ticket_type_id,quantity:o.quantity,status:o.status,paymentStatus:o.payment_status==='approved'&&o.status!=='approved'?'confirming':o.payment_status,total:o.total_cents/100,subtotal:o.subtotal_cents/100,discount:o.discount_cents/100,platformFee:o.fee_cents/100,fee:o.snapshot?.feePayer==='organizer'?0:o.fee_cents/100,providerFee:o.provider_fee_cents==null?null:o.provider_fee_cents/100,paymentReview:o.payment_review===true,payoutStatus:o.payout_status||'pending',payoutActual:o.payout_cents==null?null:o.payout_cents/100,payoutAt:o.payout_at,payoutReference:o.payout_reference||'',paymentMethod:o.payment_method||'',buyer:o.buyer||{},source:o.source,campaign:o.campaign,createdAt:o.created_at,expiresAt:o.expires_at,orderHistory:o.order_status_history||[],ticketCodes:(o.tickets||[]).map(t=>({holder:t.holder,number:t.ticket_number,code:t.code,used:!!t.used_at,usedAt:t.used_at,usedBy:t.used_by,status:t.cancelled?'cancelled':'valid'}))}}
export async function loadRemote(user){
 const requests=[withOptionalOrganizerContact(includeContact=>paged(()=>supabase.from('events').select(includeContact?'*,organizations(name,whatsapp),ticket_types(*)':'*,organizations(name),ticket_types(*)',{count:'exact'}).order('created_at',{ascending:false}).order('id'))),paged(()=>supabase.rpc('catalog_stock',{}, {get:true,count:'exact'}).order('id'))]
 if(user)requests.push(paged(()=>supabase.from('orders').select('*,tickets(*),order_status_history(*)',{count:'exact'}).order('created_at',{ascending:false}).order('id')),paged(()=>supabase.from('coupons').select('*',{count:'exact'}).order('id')),supabase.from('audit_log').select('*').order('created_at',{ascending:false}).limit(200),supabase.rpc('checkin_summary'),supabase.from('checkins').select('*').order('created_at',{ascending:false}).limit(100))
 const [events,stock,orders=[],coupons=[],history=[],summary=[],checkins=[]]=await Promise.all(requests.map(result))
 let orderRows=orders
 if(user?.role==='financeiro'){const sales=await result(supabase.rpc('finance_orders'));orderRows=[...new Map([...sales,...orders].map(o=>[o.id,o])).values()]}
 return {events:events.map(e=>mapEvent(e,stock)),orders:orderRows.filter(o=>!o.test_archived_at).map(mapOrder),coupons:coupons.map(c=>({id:c.id,eventId:c.event_id,code:c.code,type:c.kind,value:Number(c.amount),limit:c.max_uses,perUserLimit:c.max_per_user,startsAt:c.starts_at||'',expiresAt:c.expires_at?new Date(new Date(c.expires_at).getTime()-86400000).toISOString().slice(0,10):'',active:c.active,ticketId:c.ticket_type_id})),history:history.map(h=>({id:h.id,eventId:h.event_id,action:h.action,actor:h.actor||'Servidor',at:h.created_at})),summary,checkins}
}
export const rpc=(name,args)=>result(supabase.rpc(name,args))


