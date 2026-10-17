import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'

test('18: event team status, invites, RLS, scope, audit and QR anti-reuse', async () => {
 const db=new PGlite()
 const names=['admin','organizer','outsider','staff','buyer','pending']
 const ids=Object.fromEntries(names.map(name=>[name,crypto.randomUUID()]))
 const org=crypto.randomUUID(),org2=crypto.randomUUID(),event=crypto.randomUUID(),other=crypto.randomUUID(),batch=crypto.randomUUID()
 const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0]
 const as=async(name)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ids[name]||'']);await db.exec(name==='anon'?'set role anon':'set role authenticated')}
 const member=async(email,enabled,ev=event)=>db.query('select public.set_event_checkin_member($1,$2,$3)',[ev,email,enabled])
 const access=()=>scalar("select public.can_access_event($1,array['checkin'])",[event])
 try {
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',email_confirmed_at timestamptz,is_anonymous boolean default false);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,public to anon,authenticated,service_role;`)
 const files=['001_platform.sql','002_production.sql','003_order_history_global_coupons.sql','004_preservation_reservation_limits.sql','005_primary_admin_email.sql','007_checkin_event_scope.sql','008_event_platform_fee_and_safe_delete.sql','009_payment_fees_payouts.sql','010_owner_only_platform_fee.sql','011_inline_payment_attempts.sql','011_self_service_organizers_and_account_admin.sql','012_verified_inline_payments.sql','013_experience_participants_vip.sql','014_atomic_inline_payments.sql','015_event_checkin_team.sql','016_pending_checkin_team.sql','025_event_checkin_member_status.sql','026_checkin_existing_accounts.sql']
 for(const file of files)await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'))
 await db.exec(await readFile(new URL('../supabase/migrations/026_checkin_existing_accounts.sql',import.meta.url),'utf8'))
 for(const name of names)await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,$3)',[ids[name],name+'@example.test',name==='pending'?null:new Date()])
 await db.query("insert into organizations(id,name) values($1,'A'),($2,'B')",[org,org2])
 await db.query("update profiles set role='admin' where id=$1",[ids.admin])
 for(const name of ['organizer','outsider'])await db.query("update profiles set role='organizador',organization_id=$1 where id=$2",[name==='organizer'?org:org2,ids[name]])
 await as('admin')
 await db.query('select save_event($1)',[{id:event,organizerId:org,title:'Event A',slug:'a',published:false,ticketTypes:[{id:batch,name:'Pista',available:20,price:0,type:'individual'}]}])
 await db.query('select save_event($1)',[{id:other,organizerId:org2,title:'Event B',slug:'b',ticketTypes:[{id:crypto.randomUUID(),name:'B',available:5,price:0,type:'individual'}]}])
 await as('outsider');await assert.rejects(member('staff@example.test',true),/Sem permissão/)
 await as('buyer');await assert.rejects(member('staff@example.test',true),/Sem permissão/)
 // An organizer of B can be invited to multiple A events without becoming their organizer.
 const event2=crypto.randomUUID()
 await as('admin');await db.query('select save_event($1)',[{id:event2,organizerId:org,title:'Event A2',slug:'a2',ticketTypes:[{id:crypto.randomUUID(),name:'A2',available:5,price:0,type:'individual'}]}])
 await as('organizer');await member('outsider@example.test',true);await member('outsider@example.test',true,event2)
 await as('outsider');assert.equal(await access(),true)
 assert.equal(await scalar("select can_access_event($1,array['checkin'])",[event2]),true)
 assert.equal(await scalar("select can_access_event($1,array['organizador'])",[event]),false)
 assert.equal(await scalar("select can_access_event($1,array['organizador'])",[other]),true)
 assert.deepEqual(await scalar('select finance_orders()'),[])
 await assert.rejects(member('buyer@example.test',true),/Sem permissão/)
 assert.equal(await scalar('select role from profiles where id=$1',[ids.outsider]),'organizador')
 await as('organizer');await member('outsider@example.test',false)
 await as('outsider');assert.equal(await access(),false);assert.equal(await scalar("select can_access_event($1,array['checkin'])",[event2]),true)
 await as('organizer');await db.query('select remove_event_checkin_member($1,$2)',[event,'outsider@example.test'])
 await as('outsider');assert.equal(await scalar("select can_access_event($1,array['checkin'])",[event2]),true)
 await as('organizer');await db.query('select remove_event_checkin_member($1,$2)',[event2,'outsider@example.test'])
 await db.exec('reset role');await db.query("update profiles set role='organizador',organization_id=$1 where id=$2",[org2,ids.pending])
 await as('organizer');await member(' STAFF@Example.test ',true)
 let team=await scalar('select event_checkin_team_v18($1)',[event]);assert.equal(team.length,1);assert.equal(team[0].active,true)
 await as('staff');assert.equal(await access(),true)
 assert.equal(await scalar("select can_access_event($1,array['checkin'])",[other]),false)
 assert.equal(await scalar('select count(*)::int from events where id=$1',[event]),1,'authorized staff sees unpublished event')
 assert.deepEqual(await scalar('select finance_orders()'),[])
 assert.equal(await scalar('select count(*)::int from orders'),0)
 await assert.rejects(db.query('select event_checkin_team($1)',[event]),/Sem permissão/)
 await assert.rejects(member('buyer@example.test',true),/Sem permissão/)
 await assert.rejects(db.query('update checkin_assignments set active=true'),/permission denied/)
 await as('organizer');await member('staff@example.test',false)
 assert.equal((await scalar('select event_checkin_team($1)',[event]))[0].active,false)
 await as('staff');assert.equal(await access(),false);assert.equal(await scalar('select check_in_event($1,$2)',[crypto.randomUUID(),event]),'forbidden')
 await as('organizer');await member('staff@example.test',true)
 await member('pending@example.test',true);await member('pending@example.test',false)
 await member('future@example.test',true)
 await as('pending');await scalar('select claim_event_checkin_invites()');assert.equal(await access(),false)
 await db.exec('reset role');await db.query('update auth.users set email_confirmed_at=now() where id=$1',[ids.pending])
 await as('pending');await scalar('select claim_event_checkin_invites()');assert.equal(await access(),false,'inactive invite stays inactive after confirmation')
 await as('organizer');await member('pending@example.test',true)
 await as('pending');assert.equal(await access(),true);assert.equal(await scalar('select role from profiles where id=$1',[ids.pending]),'organizador')
 await as('organizer');await db.query('select remove_event_checkin_member($1,$2)',[event,'pending@example.test']);await db.query('select remove_event_checkin_member($1,$2)',[event,'future@example.test'])
 await as('pending');await scalar('select claim_event_checkin_invites()');assert.equal(await access(),false)
 // A future signup can claim the invitation only with a confirmed matching address.
 await as('organizer');await member('future@example.test',true)
 await db.exec('reset role');const future=crypto.randomUUID();await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'future@example.test',now())",[future]);ids.future=future
 await as('future');await scalar('select claim_event_checkin_invites()');assert.equal(await access(),true)
 // Existing checkout and atomic QR validation remain intact.
 await as('admin');await db.query('select save_event($1)',[{id:event,organizerId:org,title:'Event A',slug:'a',published:true,ticketTypes:[{id:batch,name:'Pista',available:20,price:0,type:'individual'}]}])
 await as('buyer');const order=await scalar("select create_order($1,1,$2,'',$3,null,null)",[batch,{name:'Buyer Test',cpf:'52998224725',phone:'41999999999',birthDate:'2000-01-01',email:'buyer@example.test',ageConfirmed:true},crypto.randomUUID()])
 const code=await scalar('select code from tickets where order_id=$1',[order])
 await as('staff');assert.equal(await scalar('select check_in_event($1,$2)',[code,event]),'valid');assert.equal(await scalar('select check_in_event($1,$2)',[code,event]),'used')
 await as('organizer');await member('staff@example.test',false)
 await as('staff');assert.equal(await scalar('select check_in_event($1,$2)',[code,event]),'forbidden')
 await as('admin');await member('staff@example.test',true,other)
 await as('staff');assert.equal(await access(),false);assert.equal(await scalar("select can_access_event($1,array['checkin'])",[other]),true,'disabling one event does not disable another')
 await assert.rejects(db.query('select remove_event_checkin_member($1,$2)',[other,'staff@example.test']),/Sem permissão/)
 await db.exec('reset role');await db.query('update profiles set active=false where id=$1',[ids.staff])
 await as('staff');assert.equal(await scalar("select can_access_event($1,array['checkin'])",[other]),false,'global account suspension still applies')
 await as('organizer');await assert.rejects(member('invalid',true),/e-mail válido/)
 assert.ok(await scalar("select count(*)::int from audit_log where event_id=$1 and action like 'checkin.email.%'",[event])>=10)
 await as('anon');await assert.rejects(db.query('select remove_event_checkin_member($1,$2)',[event,'staff@example.test']),/permission denied/)
 } finally {await db.close()}
})
