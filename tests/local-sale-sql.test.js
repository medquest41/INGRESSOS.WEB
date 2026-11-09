import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'
test('SQL local sale: optional buyer, permissions, stock, four QR, concurrent attempts, retry, history and payout isolation',async()=>{
 const db=new PGlite(),org=crypto.randomUUID(),otherOrg=crypto.randomUUID(),event=crypto.randomUUID(),ticket=crypto.randomUUID()
 const people=Object.fromEntries(['admin','organizer','foreign','finance','checkin','customer','anonymous'].map(key=>[key,crypto.randomUUID()]))
 const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0]
 const actor=async who=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[people[who]]);await db.exec('set role authenticated')}
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',email_confirmed_at timestamptz,is_anonymous boolean default false);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;`)
 for(const f of ['001_platform.sql','002_production.sql','003_order_history_global_coupons.sql','004_preservation_reservation_limits.sql','005_primary_admin_email.sql','008_event_platform_fee_and_safe_delete.sql','009_payment_fees_payouts.sql','010_owner_only_platform_fee.sql','011_inline_payment_attempts.sql','011_self_service_organizers_and_account_admin.sql','012_verified_inline_payments.sql','027_camarotes.sql','029_local_sales.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'))
 await db.query("insert into organizations(id,name) values($1,'Org teste'),($2,'Outra org')",[org,otherOrg])
 for(const [name,id]of Object.entries(people)){
  await db.query('insert into auth.users(id,email,email_confirmed_at,is_anonymous) values($1,$2,now(),$3)',[id,name+'@example.test',name==='anonymous'])
  await db.query('update profiles set role=$2,organization_id=$3 where id=$1',[id,{admin:'admin',organizer:'organizador',foreign:'organizador',finance:'financeiro',checkin:'checkin',customer:'cliente',anonymous:'organizador'}[name],name==='foreign'?otherOrg:org])
 }
 await db.query("insert into events(id,organization_id,slug,title,published) values($1,$2,'local-test','Evento teste',true)",[event,org])
 await db.query("insert into ticket_types(id,event_id,name,type,capacity,price_cents,details) values($1,$2,'Mesa 01','camarote',1,38900,'{\"wristbands\":4}')",[ticket,event])
 const call=(key,buyer={},qty=1,total=38900)=>scalar('select create_local_sale($1,$2,$3,$4,true,true,$5)',[ticket,qty,buyer,key,total])
 for(const who of ['foreign','finance','checkin','customer','anonymous']){await actor(who);await assert.rejects(call(crypto.randomUUID()),/organizador|permissão/)}
 await actor('organizer');assert.equal((await scalar('select local_sale_capabilities($1)',[event])).feePolicy,'no_platform_fee')
 await assert.rejects(scalar('select create_local_sale($1,1,\'{}\',$2,false,true,38900)',[ticket,crypto.randomUUID()]),/Confirme/)
 await assert.rejects(call(crypto.randomUUID(),{cpf:'11111111111'}),/opcionais/)
 await assert.rejects(call(crypto.randomUUID(),{},1,1),/preço mudou/)
 const key=crypto.randomUUID(),competing=await Promise.allSettled([call(key),call(crypto.randomUUID()),call(crypto.randomUUID())]);assert.equal(competing.filter(r=>r.status==='fulfilled').length,1)
 const order=competing[0].value;assert.ok(order);assert.equal(await call(key),order)
 await assert.rejects(call(key,{name:'Outro'}),/outros dados/)
 const rows=(await db.query('select code from tickets where order_id=$1 order by ticket_number',[order])).rows;assert.equal(rows.length,4);assert.equal(new Set(rows.map(t=>t.code)).size,4)
 await db.exec('reset role');const record=(await db.query('select * from orders where id=$1',[order])).rows[0];assert.equal(record.total_cents,38900);assert.equal(record.fee_cents,0);assert.equal(record.buyer.cpf,null);assert.equal(record.buyer.name,'Venda local');assert.equal(record.snapshot.saleChannel,'local');assert.equal(record.snapshot.localReceivedBy,people.organizer)
 assert.equal(await scalar('select count(*)::int from ticket_email_outbox where order_id=$1',[order]),0);assert.equal(await scalar('select count(*)::int from payments where order_id=$1',[order]),0)
 await assert.rejects(db.query("update orders set payout_status='paid' where id=$1",[order]),/não há repasse/)
 const namedTicket=crypto.randomUUID(),reservedTicket=crypto.randomUUID()
 await db.query("insert into ticket_types(id,event_id,name,type,capacity,price_cents) values($1,$2,'Pista local','individual',3,1000)",[namedTicket,event])
 await db.query("insert into ticket_types(id,event_id,name,type,capacity,price_cents,details) values($1,$2,'Mesa 02','camarote',1,38900,'{\"wristbands\":4}')",[reservedTicket,event])
 await actor('organizer')
 const namedBuyer={name:' Pessoa Teste ',cpf:'529.982.247-25',email:' PESSOA@example.test ',phone:'(45) 99999-9999',birthDate:'2000-01-01'},namedKey=crypto.randomUUID()
 const named=await scalar('select create_local_sale($1,2,$2,$3,true,true,2000)',[namedTicket,namedBuyer,namedKey])
 assert.equal(await scalar('select create_local_sale($1,2,$2,$3,true,true,2000)',[namedTicket,namedBuyer,namedKey]),named)
 const namedHolders=(await db.query('select holder from tickets where order_id=$1 order by ticket_number',[named])).rows
 assert.equal(namedHolders[0].holder.name,'Pessoa Teste');assert.equal(namedHolders[0].holder.cpf,'52998224725');assert.equal(namedHolders[1].holder.cpf,null)
 await db.exec('reset role');assert.equal(await scalar('select count(*)::int from ticket_email_outbox where order_id=$1',[named]),1)
 const overrideKey=crypto.randomUUID(),terms={name:'Venda personalizada',unitPriceCents:750}
 await actor('organizer')
 const customized=await scalar('select create_local_sale($1,1,$2,$3,true,true,750,$4)',[namedTicket,{},overrideKey,terms])
 assert.equal(await scalar('select create_local_sale($1,1,$2,$3,true,true,750,$4)',[namedTicket,{},overrideKey,terms]),customized)
 await assert.rejects(scalar('select create_local_sale($1,1,$2,$3,true,true,750,$4)',[namedTicket,{},overrideKey,{...terms,name:'Alterado'}]),/outros dados/)
 const customRecord=(await db.query('select total_cents,snapshot from orders where id=$1',[customized])).rows[0]
 assert.equal(customRecord.total_cents,750);assert.equal(customRecord.snapshot.ticketName,'Venda personalizada');assert.equal(customRecord.snapshot.localCatalogPriceCents,1000)
 assert.equal(await scalar('select price_cents from ticket_types where id=$1',[namedTicket]),1000)
 const onlineKey=crypto.randomUUID();await actor('customer')
 const online=await scalar("select create_order($1,1,$2,'',$3,null,null)",[reservedTicket,{name:'Online',cpf:'52998224725',phone:'45999999999',birthDate:'2000-01-01'},onlineKey])
 await actor('organizer');await assert.rejects(scalar('select create_local_sale($1,1,\'{}\',$2,true,true,38900)',[reservedTicket,crypto.randomUUID()]),/Estoque/)
 await assert.rejects(scalar('select create_local_sale($1,1,\'{}\',$2,true,true,38900)',[reservedTicket,onlineKey]),/outros dados/)
 await db.exec('reset role');assert.equal(await scalar('select status from orders where id=$1',[online]),'pending')
 await actor('customer');await scalar('select cancel_order($1)',[online]);await actor('organizer')
 const cancellable=await scalar('select create_local_sale($1,1,\'{}\',$2,true,true,38900)',[reservedTicket,crypto.randomUUID()]);await scalar('select cancel_order($1)',[cancellable])
 assert.equal(await scalar('select batch_remaining($1)',[reservedTicket]),1)
 await db.exec('reset role');assert.equal(await scalar('select bool_and(cancelled) from tickets where order_id=$1',[cancellable]),true)
 await actor('admin');await assert.rejects(call(key),/outros dados/)
 await actor('organizer');assert.equal(await scalar('select check_in($1)',[rows[0].code]),'valid');assert.equal(await scalar('select check_in($1)',[rows[0].code]),'used')
 await assert.rejects(scalar('select cancel_order($1)',[order]),/utilizado/)
 await db.exec('reset role');assert.equal(await scalar("select count(*)::int from audit_log where event_id=$1 and action like 'local_sale.%'",[event]),4)
 assert.equal(await scalar("select has_function_privilege('anon','public.create_local_sale(uuid,integer,jsonb,uuid,boolean,boolean,integer,jsonb)','execute')"),false)
 await db.exec(await readFile(new URL('../docs/ROLLBACK-029-local-sales.sql',import.meta.url),'utf8'))
 assert.equal(await scalar('select count(*)::int from tickets where order_id=$1',[order]),4)
 await assert.rejects(db.query("update orders set payout_status='paid' where id=$1",[order]),/não há repasse/)
 }finally{await db.close()}
})
