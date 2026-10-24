import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'
import {quote} from '../src/utils/commerce.js'
import {validateParticipants} from '../src/utils/experience.js'

test('room quote is the entire room; participants support more than ten wristbands',()=>{
 const event={published:true,id:'e'},ticket={id:'c',type:'camarote',price:1200,available:1}
 assert.equal(quote(event,ticket,1,'',[],[]).subtotal,1200)
 assert.throws(()=>quote(event,ticket,2,'',[],[]),/inteiro/)
 const buyer={name:'Pessoa Teste',cpf:'52998224725',birthDate:'2000-01-01'}
 assert.equal(validateParticipants({ageRating:'Livre'},20,buyer,[],'same',true).length,20)
})

for(const wristbands of [8,10,15,30])for(const partial of wristbands===8?[false,true]:[true])test('SQL: '+wristbands+' individual QR, verified payment, retry, expiration, check-in and rollback; partial schema='+partial,async()=>{
 const db=new PGlite(),buyer=crypto.randomUUID(),event=crypto.randomUUID(),batch=crypto.randomUUID()
 const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0]
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',email_confirmed_at timestamptz,is_anonymous boolean default false);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,public to anon,authenticated,service_role;`)
 const files=['001_platform.sql','002_production.sql','003_order_history_global_coupons.sql','004_preservation_reservation_limits.sql','005_primary_admin_email.sql','008_event_platform_fee_and_safe_delete.sql','009_payment_fees_payouts.sql','010_owner_only_platform_fee.sql','011_inline_payment_attempts.sql','011_self_service_organizers_and_account_admin.sql','012_verified_inline_payments.sql','013_experience_participants_vip.sql','014_atomic_inline_payments.sql','027_camarotes.sql']
 for(const file of files){if(partial&&['013_experience_participants_vip.sql','014_atomic_inline_payments.sql'].includes(file))continue;await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'))}
 await db.exec(await readFile(new URL('../docs/ROLLBACK-CAMAROTES.sql',import.meta.url),'utf8'))
 assert.equal(await scalar("select to_regprocedure('public.camarote_availability(uuid)')::text"),null)
 await db.exec(await readFile(new URL('../supabase/migrations/027_camarotes.sql',import.meta.url),'utf8'))
 await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[buyer,'synthetic@example.test'])
 const org=await scalar("insert into public.organizations(name) values('Teste camarotes') returning id")
 await db.query("insert into events(id,organization_id,slug,title,published) values($1,$2,'teste-camarotes','Teste',true)",[event,org])
 let roomNumber=0
 const room=async()=>{
  const id=crypto.randomUUID()
  await db.query("insert into ticket_types(id,event_id,name,sector,batch,type,capacity,price_cents,details) values($1,$2,$3,'Camarotes','Único','camarote',1,120000,$4)",[id,event,'Camarote '+String(++roomNumber).padStart(2,'0'),JSON.stringify({wristbands})])
  return id
 }
 await db.exec("update settings set value='true'::jsonb where key='payments_enabled'")
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[buyer])
 const person={name:'Pessoa Teste',cpf:'52998224725',phone:'41999999999',birthDate:'2000-01-01',participantMode:'same'}
 const make=(id,key=crypto.randomUUID())=>scalar("select create_order($1,1,$2,'',$3,null,null)",[id,person,key])
 const attempt=id=>scalar("select begin_inline_payment($1,$2,'pix')",[id,buyer])
 const sync=(id,a,status,external='10001',total=132000)=>scalar('select reconcile_inline_payment($1,$2,$3,$4,$5,\'pix\',now(),0,0)',[id,external,a.attempt_key,status,total])
 const count=id=>scalar('select count(*)::integer from tickets where order_id=$1',[id])
 const first=await room(),key=crypto.randomUUID()
 // Exercise the real Admin persistence RPC before the verified-payment flow.
 if(wristbands===15){
  await db.query("update public.profiles set role='admin' where id=$1",[buyer])
  const payload={id:event,organizerId:org,title:'Teste',slug:'teste-camarotes',published:true,numberedUnitsMode:'numbered',venueMapTitle:'Escolha seu camarote',ticketTypes:[{id:first,name:'Camarote 01',type:'camarote',reservationKind:'group',available:1,price:1200,wristbands:15,unitNumber:1,mapX:55,mapY:65}]}
  await db.query('select public.save_event($1::jsonb)',[JSON.stringify(payload)])
  assert.equal(await scalar("select (details->>'wristbands')::integer from ticket_types where id=$1",[first]),15)
  assert.equal(await scalar("select details->>'reservationKind' from ticket_types where id=$1",[first]),'group')
  assert.equal(await scalar("select (details->>'mapX')::integer from ticket_types where id=$1",[first]),55)
  assert.equal(await scalar("select details->>'venueMapTitle' from events where id=$1",[event]),'Escolha seu camarote')
  await db.query("update public.profiles set role='cliente' where id=$1",[buyer])
 }
 await assert.rejects(db.query("insert into ticket_types(event_id,name,type,capacity,price_cents,details) values($1,' camarote 01 ','camarote',1,120000,'{\"wristbands\":8}')",[event]),/unique/)
 // Submitted together. PGlite serializes a single database connection; external PostgreSQL stress test is separate.
 const competing=await Promise.allSettled([make(first,key),make(first),make(first),make(first)])
 assert.equal(competing.filter(r=>r.status==='fulfilled').length,1)
 const id=competing.find(r=>r.status==='fulfilled').value
 assert.equal(await make(first,key),id)
 assert.equal(await scalar('select batch_remaining($1)',[first]),0)
 assert.equal((await scalar('select jsonb_agg(x) from camarote_availability($1) x',[event]))[0].status,'reserved')
 assert.equal(await count(id),0)
 await assert.rejects(db.query("update ticket_types set capacity=2 where id=$1",[first]),/estoque 1/)
 await assert.rejects(db.query("update ticket_types set details='{\"wristbands\":9}' where id=$1",[first]),/histórico/)
 const a=await attempt(id)
 assert.ok(await scalar("select expires_at>now()+interval '31 minutes' from orders where id=$1",[id]))
 await sync(id,a,'pending');assert.equal(await count(id),0)
 await assert.rejects(sync(id,a,'approved','10001',1),/incompatível/)
 await db.exec('set role authenticated')
 await assert.rejects(sync(id,a,'approved'),/permission denied/)
 await assert.rejects(db.query('select issue_tickets($1)',[id]),/permission denied/)
 await db.exec('reset role')
 await sync(id,a,'approved');assert.equal(await count(id),wristbands)
 const codes=(await db.query('select code from tickets where order_id=$1 order by ticket_number',[id])).rows.map(r=>r.code)
 assert.equal(new Set(codes).size,wristbands)
 await Promise.all([sync(id,a,'approved'),sync(id,a,'approved')]);assert.equal(await count(id),wristbands)
 assert.deepEqual((await db.query('select code from tickets where order_id=$1 order by ticket_number',[id])).rows.map(r=>r.code),codes)
 assert.equal(await scalar('select quantity from orders where id=$1',[id]),1)
 assert.equal(await scalar("select (snapshot->>'wristbands')::integer from orders where id=$1",[id]),wristbands)
 await db.query("update profiles set role='admin' where id=$1",[buyer])
 assert.equal(await scalar('select check_in($1)',[codes[0]]),'valid')
 assert.equal(await scalar('select check_in($1)',[codes[0]]),'used')
 assert.equal(await scalar('select check_in($1)',[codes[1]]),'valid')
 assert.equal(await scalar('select count(*)::integer from tickets where order_id=$1 and used_at is null',[id]),wristbands-2)
 // Sold, pending, expiration and late webhook after another purchase.
 assert.equal((await scalar('select jsonb_agg(x) from camarote_availability($1) x',[event])).find(r=>r.id===first).status,'sold')
 const lateRoom=await room(),late=await make(lateRoom),la=await attempt(late)
 await db.query("update orders set expires_at=now()-interval '1 second' where id=$1",[late])
 const replacement=await make(lateRoom)
 assert.equal(await sync(late,la,'approved','10002'),'review');assert.equal(await count(late),0)
 assert.equal(await scalar('select batch_remaining($1)',[lateRoom]),0)
 await db.query('select cancel_order($1)',[replacement]);assert.equal(await scalar('select batch_remaining($1)',[lateRoom]),1)
 const rejected=await make(lateRoom),ra=await attempt(rejected)
 await sync(rejected,ra,'rejected','10003');assert.equal(await scalar('select batch_remaining($1)',[lateRoom]),1)
 assert.equal(await count(rejected),0)
 const cancelled=await make(lateRoom),ca=await attempt(cancelled)
 await sync(cancelled,ca,'cancelled','10004');assert.equal(await scalar('select batch_remaining($1)',[lateRoom]),1)
 const cardRoom=await room(),cardOrder=await make(cardRoom)
 const cardAttempt=await scalar("select begin_inline_payment($1,$2,'card')",[cardOrder,buyer])
 await scalar("select reconcile_inline_payment($1,'10005',$2,'approved',132000,'card',now(),0,0)",[cardOrder,cardAttempt.attempt_key])
 assert.equal(await count(cardOrder),wristbands)
 // Refund revokes individual codes and releases the room, preserving history.
 await sync(id,a,'refunded');assert.equal(await scalar('select bool_and(cancelled) from tickets where order_id=$1',[id]),true)
 assert.equal(await scalar('select check_in($1)',[codes[2]]),'cancelled')
 // Checkout Pro deployment uses the audited provider reconciliation, not inline attempts.
 const hosted=await room(),hostedOrder=await make(hosted)
 await db.query('select prepare_camarote_payment($1,$2)',[hostedOrder,buyer])
 const expiry=await scalar('select expires_at from orders where id=$1',[hostedOrder])
 await db.query('select prepare_camarote_payment($1,$2)',[hostedOrder,buyer])
 assert.deepEqual(await scalar('select expires_at from orders where id=$1',[hostedOrder]),expiry)
 const payment={id:5001,external_reference:hostedOrder,currency_id:'BRL',transaction_amount:1320,status:'pending',payment_method_id:'pix',fee_details:[]}
 const hostedSync=()=>scalar('select reconcile_camarote_payment($1,$2)',[hostedOrder,payment])
 assert.equal(await hostedSync(),'pending');assert.equal(await count(hostedOrder),0)
 payment.status='approved';assert.equal(await hostedSync(),'approved');assert.equal(await count(hostedOrder),wristbands)
 assert.equal(await hostedSync(),'approved');assert.equal(await count(hostedOrder),wristbands)
 payment.status='pending';assert.equal(await hostedSync(),'approved')
 payment.status='refunded';assert.equal(await hostedSync(),'review')
 assert.equal(await scalar('select bool_and(cancelled) from tickets where order_id=$1',[hostedOrder]),true)
 const lateHosted=await room(),lateHostedOrder=await make(lateHosted)
 await db.query("update orders set expires_at=now()-interval '1 second' where id=$1",[lateHostedOrder])
 assert.equal(await scalar('select reconcile_camarote_payment($1,$2)',[lateHostedOrder,{...payment,id:5002,external_reference:lateHostedOrder,status:'approved'}]),'review')
 assert.equal(await count(lateHostedOrder),0)
 // Common tickets retain one QR per quantity.
 await db.query("insert into ticket_types(id,event_id,name,sector,batch,type,capacity,price_cents) values($1,$2,'Pista','Pista','1','individual',5,0)",[batch,event])
 const common=await scalar("select create_order($1,2,$2,'',$3,null,null)",[batch,person,crypto.randomUUID()]);assert.equal(await count(common),2)
 await db.exec('set role anon');await assert.rejects(db.query('select * from orders'),/permission denied/)
 const publicRows=(await db.query('select * from camarote_availability($1)',[event])).rows
 assert.deepEqual(Object.keys(publicRows[0]).sort(),['id','status'])
 await db.exec('reset role')
 await assert.rejects(db.exec(await readFile(new URL('../docs/ROLLBACK-CAMAROTES.sql',import.meta.url),'utf8')),/Rollback bloqueado/)
 await db.exec('rollback')
 assert.equal(await count(id),wristbands)
 }finally{await db.close()}
})
