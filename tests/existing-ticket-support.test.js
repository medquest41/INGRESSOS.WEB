import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'
test('support reuses original QR and enforces event role, payment, usage and verified email',async()=>{
 const db=new PGlite(),admin=crypto.randomUUID(),organizer=crypto.randomUUID(),foreign=crypto.randomUUID(),buyer=crypto.randomUUID(),confirmed=crypto.randomUUID(),unconfirmed=crypto.randomUUID(),guest=crypto.randomUUID(),event=crypto.randomUUID(),org=crypto.randomUUID(),otherOrg=crypto.randomUUID(),order=crypto.randomUUID(),ticket=crypto.randomUUID(),code=crypto.randomUUID()
 try{
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false);
 create table public.profiles(id uuid primary key,role text,organization_id uuid,active boolean default true);
 create table public.events(id uuid primary key,organization_id uuid);
 create table public.orders(id uuid primary key,event_id uuid,user_id uuid,status text,payment_review boolean default false,buyer jsonb);
 create table public.tickets(id uuid primary key,order_id uuid,code uuid,cancelled boolean default false,used_at timestamptz);
 create table public.ticket_shares(secret text primary key,ticket_id uuid,expires_at timestamptz,created_by uuid,created_at timestamptz default now());
 create function public.can_access_event(target uuid,allowed_roles text[]) returns boolean language sql security definer as $$select exists(select 1 from public.profiles p join public.events e on e.id=target where p.id=auth.uid() and p.active and p.role=any(allowed_roles) and (p.role='admin' or p.organization_id=e.organization_id))$$;
 create function public.verified_customer_email() returns text language sql security definer as $$select lower(u.email) from auth.users u join public.profiles p on p.id=u.id where u.id=auth.uid() and p.active and u.email_confirmed_at is not null and not u.is_anonymous$$;
 alter table public.orders enable row level security;grant select on public.orders to authenticated;`)
 for(const [id,role,organization,verified,anonymous] of [[admin,'admin',null,true,false],[organizer,'organizador',org,true,false],[foreign,'organizador',otherOrg,true,false],[buyer,'cliente',null,true,false],[confirmed,'cliente',null,true,false],[unconfirmed,'cliente',null,false,false],[guest,'cliente',null,true,true]]){
 await db.query('insert into auth.users values($1,$2,$3,$4)',[id,'buyer@example.com',verified?new Date().toISOString():null,anonymous]);await db.query('insert into public.profiles(id,role,organization_id) values($1,$2,$3)',[id,role,organization])}
 await db.query('insert into events values($1,$2)',[event,org]);await db.query('insert into orders(id,event_id,user_id,status,buyer) values($1,$2,$3,$4,$5)',[order,event,buyer,'approved',JSON.stringify({email:'buyer@example.com'})]);await db.query('insert into tickets(id,order_id,code) values($1,$2,$3)',[ticket,order,code])
 await db.exec(await readFile(new URL('../supabase/migrations/028_existing_ticket_support.sql',import.meta.url),'utf8'))
 const actor=async id=>{await db.query("select set_config('test.uid',$1,false)",[id]);await db.exec('set role authenticated')}
 const reset=()=>db.exec('reset role')
 for(const id of [admin,organizer]){await actor(id);const r=await db.query('select create_admin_ticket_share($1) as token',[code]);assert.match(r.rows[0].token,/^[a-f0-9]{64}$/);await reset()}
 assert.equal((await db.query('select count(*)::int as n from tickets')).rows[0].n,1);assert.equal((await db.query('select code from tickets')).rows[0].code,code)
 for(const id of [foreign,buyer,guest]){await actor(id);await assert.rejects(db.query('select create_admin_ticket_share($1)',[code]),/indisponível/);await reset()}
 for(const state of ["status='pending'","status='approved',payment_review=true"]){await db.exec('update orders set '+state);await actor(admin);await assert.rejects(db.query('select create_admin_ticket_share($1)',[code]),/indisponível/);await reset()}
 await db.exec("update orders set status='approved',payment_review=false;update tickets set used_at=now()")
 await actor(admin);await assert.rejects(db.query('select create_admin_ticket_share($1)',[code]),/indisponível/);await reset();await db.exec('update tickets set used_at=null,cancelled=true');await actor(admin);await assert.rejects(db.query('select create_admin_ticket_share($1)',[code]),/indisponível/);await reset();await db.exec('update tickets set cancelled=false')
 for(const [id,count] of [[confirmed,1],[unconfirmed,0],[guest,0]]){await actor(id);assert.equal((await db.query('select count(*)::int as n from orders')).rows[0].n,count);await reset()}
 await db.exec('update profiles set active=false where id=\''+confirmed+'\'');await actor(confirmed);assert.equal((await db.query('select count(*)::int as n from orders')).rows[0].n,0);await reset()
 assert.equal((await db.query("select has_function_privilege('anon','public.create_admin_ticket_share(uuid)','execute') as allowed")).rows[0].allowed,false)
 await db.exec(await readFile(new URL('../docs/ROLLBACK-028-existing-ticket-support.sql',import.meta.url),'utf8'));assert.equal((await db.query('select count(*)::int as n from tickets')).rows[0].n,1)
 }finally{await db.close()}
})
