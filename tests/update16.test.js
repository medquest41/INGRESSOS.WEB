import test from 'node:test'
import assert from 'node:assert/strict'
import {PGlite} from '@electric-sql/pglite'
import {readFile} from 'node:fs/promises'
import {validateParticipants,validateAge,canShowQR,distanceKm,whatsappUrl,shareLink,ticketShareUrl} from '../src/utils/experience.js'
import {partyMessages} from '../src/utils/partyMessages.js'
const person={name:'Cliente Teste',cpf:'52998224725',phone:'41999999999',email:'cliente@example.test',birthDate:'2000-01-01',ageConfirmed:true}
test('multi-ticket validation, individual holders, quantities and age boundaries',()=>{
 assert.equal(validateParticipants({},5,person,[],'same',false).length,5)
 assert.throws(()=>validateParticipants({allowSameCpf:false},2,person,[],'same',true))
 assert.throws(()=>validateParticipants({},2,person,[person],'individual',true))
 assert.throws(()=>validateParticipants({},1.5,person,[],'same',true))
 assert.throws(()=>validateParticipants({},1,person,[{...person,cpf:'11111111111'}],'individual',true))
 const now=new Date('2026-10-08T12:00:00');assert.doesNotThrow(()=>validateAge({ageRating:'18+'},'2008-10-08',true,now));assert.throws(()=>validateAge({ageRating:'18+'},'2008-10-09',true,now));assert.throws(()=>validateAge({ageRating:'18+'},person.birthDate,false,now))
 assert.equal(canShowQR({status:'pending'},{code:'x'}),false);assert.equal(canShowQR({},{code:'x'}),false);assert.equal(canShowQR({status:'approved',paymentReview:true},{}),false);assert.equal(canShowQR({status:'approved'},{used:true}),false)
 assert.equal(partyMessages.length,50);assert.equal(distanceKm({latitude:0,longitude:0},{latitude:0,longitude:0}),0);assert.match(whatsappUrl('olá & festa','55 46 99999-9999'),/^https:\/\/wa.me\/5546999999999\?text=ol%C3%A1/)
})
test('sharing uses Web Share, abort does not send, fallback encodes message and private link contains no QR',async()=>{
 const oldNavigator=globalThis.navigator,oldWindow=globalThis.window;let shared,opened
 try{Object.defineProperty(globalThis,'navigator',{configurable:true,value:{share:async input=>{shared=input}}});globalThis.window={location:{origin:'https://example.test',assign:url=>{opened=url}}};await shareLink('Festa','https://example.test/evento/festa');assert.equal(shared.url,'https://example.test/evento/festa');navigator.share=async()=>{throw Object.assign(Error('cancelled'),{name:'AbortError'})};await shareLink('Festa','https://example.test/evento/festa');assert.equal(opened,undefined);delete navigator.share;await shareLink('Festa','https://example.test/evento/festa');assert.match(opened,/^https:\/\/wa.me\//);assert.equal(ticketShareUrl({id:'o1',ticketCodes:[{code:'secret-qr'}]}).includes('secret-qr'),false);await assert.rejects(shareLink('Festa','javascript:alert(1)'))}finally{Object.defineProperty(globalThis,'navigator',{configurable:true,value:oldNavigator});globalThis.window=oldWindow}
})
test('16 PostgreSQL: participants, paid-only QR, guest privacy, age, VIP, admin settings and expiring shares',async()=>{
 const db=new PGlite();const ids={admin:crypto.randomUUID(),buyer:crypto.randomUUID(),other:crypto.randomUUID(),guest:crypto.randomUUID(),organizer:crypto.randomUUID()};const event=crypto.randomUUID(),batch=crypto.randomUUID(),org=crypto.randomUUID();const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0]
 const as=async name=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ids[name]||'']);await db.exec(name==='anon'?'set role anon':'set role authenticated')}
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',email_confirmed_at timestamptz,is_anonymous boolean default false);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,public to anon,authenticated,service_role;`)
 const migrations=['001_platform.sql','002_production.sql','003_order_history_global_coupons.sql','004_preservation_reservation_limits.sql','005_primary_admin_email.sql','008_event_platform_fee_and_safe_delete.sql','009_payment_fees_payouts.sql','010_owner_only_platform_fee.sql','011_inline_payment_attempts.sql','011_self_service_organizers_and_account_admin.sql','012_verified_inline_payments.sql','013_experience_participants_vip.sql']
 for(const file of migrations)await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'))
 // Reapplying the new activation SQL is safe.
 await db.exec(await readFile(new URL('../supabase/migrations/013_experience_participants_vip.sql',import.meta.url),'utf8'))
 for(const [name,id] of Object.entries(ids))await db.query('insert into auth.users(id,email,email_confirmed_at,is_anonymous) values($1,$2,$3,$4)',[id,name==='guest'?null:name==='admin'?'ingressosaltatemporada@gmail.com':name+'@example.test',name==='guest'?null:new Date(),name==='guest'])
 await db.query('insert into public.organizations(id,name) values($1,\'Org\')',[org]);await db.query("update public.profiles set role='organizador',organization_id=$1 where id=$2",[org,ids.organizer])
 const vip={id:crypto.randomUUID(),name:'VIP Livre',limit:1,price:0,active:true,visible:true,audience:'todos'}
 const payload={id:event,organizerId:org,title:'Evento Teste',slug:'evento-teste',published:true,ageRating:'18+',activityMode:'initial',activityMin:8,activityMax:20,vipLists:[vip],ticketTypes:[{id:batch,name:'Pista',price:0,available:30,type:'individual'}]}
 await db.query("update public.profiles set role='admin' where id=$1",[ids.admin]);await as('admin');await db.query('select public.save_event($1)',[payload])
 const buy=async(data=person,n=2)=>scalar("select public.create_order($1,$2,$3,'',$4,null,null)",[batch,n,data,crypto.randomUUID()])
 await as('buyer');await assert.rejects(buy({...person,ageConfirmed:false}),/maioridade/);await assert.rejects(buy({...person,birthDate:'2020-01-01'}),/Idade/)
 const order=await buy({...person,participantMode:'individual',participants:[person,{...person,name:'Outra Pessoa',cpf:'11144477735'}]})
 const tickets=(await db.query('select * from public.tickets where order_id=$1 order by ticket_number',[order])).rows;assert.equal(tickets.length,2);assert.notEqual(tickets[0].code,tickets[1].code);assert.equal(tickets[1].holder.name,'Outra Pessoa');assert.equal(await scalar('select email_delivery_status from public.orders where id=$1',[order]),'pending')
 const token=await scalar('select public.create_ticket_share($1)',[tickets[0].code]);assert.equal(token.length,64)
 await as('other');assert.equal(await scalar('select count(*)::integer from public.orders'),0);await assert.rejects(db.query('select public.create_ticket_share($1)',[tickets[0].code]),/indisponível/)
 await as('anon');const shared=await scalar('select public.read_ticket_share($1)',[token]);assert.equal(shared.holderName,'Cliente Teste');assert.equal(shared.cpf,undefined);await assert.rejects(db.query('select * from public.ticket_shares'),/permission/)
 await db.exec('reset role');await db.query("update public.ticket_shares set expires_at=now()-interval '1 second' where secret=$1",[token]);await assert.rejects(db.query('select public.read_ticket_share($1)',[token]),/expirado/)
 await as('buyer');await scalar('select public.join_vip($1,$2,$3)',[event,vip.id,person]);await assert.rejects(db.query('select public.join_vip($1,$2,$3)',[event,vip.id,{...person,cpf:'11144477735'}]),/esgotada/);await assert.rejects(db.query('select public.vip_entries_for_event($1)',[event]),/Sem permissão/)
 await as('organizer');const entries=await scalar('select public.vip_entries_for_event($1)',[event]);assert.equal(entries.length,1);await scalar('select public.check_in_vip($1,$2)',[entries[0].id,event]);await assert.rejects(db.query('select public.check_in_vip($1,$2)',[entries[0].id,event]),/indisponível/)
 await db.query('select public.save_event($1)',[{...payload,activityMin:99,activityMax:100}]);assert.equal(await scalar("select details->>'activityMin' from public.events where id=$1",[event]),'8')
 await as('guest');const guestOrder=await buy({...person,email:'buyer@example.test'});assert.equal(await scalar("select buyer->>'email' from public.orders where id=$1",[guestOrder]),'buyer@example.test')
 await as('buyer');assert.equal(await scalar('select count(*)::integer from public.orders where id=$1',[guestOrder]),1,'verified email recovers guest order');const guestCode=await scalar('select code from public.tickets where order_id=$1 limit 1',[guestOrder]);assert.equal((await scalar('select public.create_ticket_share($1)',[guestCode])).length,64)
 await as('admin');await db.query('select public.save_event($1)',[{...payload,ticketTypes:[{...payload.ticketTypes[0],price:10}]}]);await db.exec('reset role');await db.exec("update public.settings set value='true'::jsonb where key='payments_enabled'")
 const paidVip={...vip,id:crypto.randomUUID(),name:'VIP pago',price:10,limit:5,ticketTypeId:batch};await as('admin');await db.query('select public.save_event($1)',[{...payload,vipLists:[vip,paidVip],ticketTypes:[{...payload.ticketTypes[0],price:10}]}])
 await as('buyer');const pending=await buy({...person,vipListId:paidVip.id},1);assert.equal(await scalar('select count(*)::integer from public.tickets where order_id=$1',[pending]),0);await assert.rejects(db.query('select public.issue_tickets($1)',[pending]),/permission/)
 await as('organizer');let paidEntries=await scalar('select public.vip_entries_for_event($1)',[event]);const pendingEntry=paidEntries.find(e=>e.orderId===pending);assert.equal(pendingEntry.status,'pending');await assert.rejects(db.query('select public.check_in_vip($1,$2)',[pendingEntry.id,event]),/indisponível/)
 // Simulate a trusted server settlement solely in this isolated test database.
 await db.exec('reset role');await db.query("update public.orders set status='approved' where id=$1",[pending]);await db.query('select public.issue_tickets($1)',[pending]);const paidCode=await scalar('select code from public.tickets where order_id=$1',[pending]);await as('organizer');paidEntries=await scalar('select public.vip_entries_for_event($1)',[event]);assert.equal(paidEntries.find(e=>e.orderId===pending).status,'confirmed');await assert.rejects(db.query('select public.check_in_vip($1,$2)',[pendingEntry.id,event]),/valide o QR/);assert.equal(await scalar('select public.check_in($1)',[paidCode]),'valid');assert.equal((await scalar('select public.vip_entries_for_event($1)',[event])).find(e=>e.orderId===pending).status,'used')
 await as('admin');await db.query('select public.cancel_order($1)',[order]);await assert.rejects(db.query('select public.create_ticket_share($1)',[tickets[1].code]),/indisponível/)
 }finally{await db.close()}
})
