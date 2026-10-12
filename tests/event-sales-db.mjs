import {readFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
import {pathToFileURL} from 'node:url'
const {PGlite}=await import(pathToFileURL(process.env.PGLITE_MODULE).href)
const db=new PGlite()
await db.exec(`create role anon;create role authenticated;create schema auth;grant usage on schema auth to anon,authenticated;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false);
create table profiles(id uuid primary key,role text,active boolean,organization_id uuid);
create table events(id uuid primary key,organization_id uuid,title text,slug text,archived boolean default false);
create table orders(id uuid primary key,user_id uuid,event_id uuid references events(id),source text,status text,quantity integer,subtotal_cents bigint,discount_cents bigint default 0,payment_review boolean default false,created_at timestamptz default now());`)
await db.exec(await readFile(new URL('../supabase/migrations/024_event_sales_promoters.sql',import.meta.url),'utf8'))
const owner='10000000-0000-4000-8000-000000000001',bruno='10000000-0000-4000-8000-000000000002',buyer='10000000-0000-4000-8000-000000000003',event='20000000-0000-4000-8000-000000000001',other='20000000-0000-4000-8000-000000000002',org='30000000-0000-4000-8000-000000000001'
await db.query(`insert into auth.users(id,email,email_confirmed_at) values ($1,'owner@example.test',now()),($2,'bruno@example.test',now()),($3,'buyer@example.test',now())`,[owner,bruno,buyer])
await db.query(`insert into profiles values ($1,'organizador',true,$4),($2,'cliente',true,null),($3,'cliente',true,null)`,[owner,bruno,buyer,org])
await db.query(`insert into events(id,organization_id,title,slug) values ($1,$3,'Evento A','evento-a'),($2,$3,'Evento B','evento-b')`,[event,other,org])
async function identity(id,role='authenticated'){await db.exec('reset role');await db.query(`select set_config('request.jwt.claim.sub',$1,false)`,[id]);await db.exec('set role '+role)}
async function rpc(action,payload={}){return (await db.query('select public.event_sales_promoters_api($1,$2::jsonb) as data',[action,JSON.stringify(payload)])).rows[0].data}
await identity(owner)
const invite=await rpc('create',{eventId:event,name:'Bruno',mode:'percent',value:1000})
await identity(buyer);await assert.rejects(()=>rpc('list',{eventId:event}),/permissao/)
await identity(bruno);await assert.rejects(()=>rpc('join',{secret:invite.invite,accepted:false}),/Aceite/)
await rpc('join',{secret:invite.invite,accepted:true});const mine=await rpc('mine');assert.equal(mine.length,1);assert.equal(mine[0].invite_secret,null)
const referral=mine[0].referral_secret;assert.ok(referral)
await identity(buyer);await assert.rejects(()=>rpc('join',{secret:invite.invite,accepted:true}),/outra conta/)
async function sale(id,ev,user,source,status='approved'){await db.exec('reset role');return db.query(`insert into orders(id,event_id,user_id,source,status,quantity,subtotal_cents,discount_cents) values ($1,$2,$3,$4,$5,2,10000,1000)`,[id,ev,user,source,status])}
const o1='40000000-0000-4000-8000-000000000001',o2='40000000-0000-4000-8000-000000000002',o3='40000000-0000-4000-8000-000000000003'
await sale(o1,event,buyer,'event-promoter:'+referral)
await sale(o2,event,bruno,'event-promoter:'+referral)
await assert.rejects(()=>sale(o3,other,buyer,'event-promoter:'+referral),/indisponivel/)
await identity(bruno);let rows=await rpc('mine');assert.equal(rows[0].tickets,2);assert.equal(rows[0].sales_cents,9000);assert.equal(rows[0].commission_cents,900)
await db.exec('reset role');await db.query('update orders set payment_review=true where id=$1',[o1]);await identity(bruno);assert.equal((await rpc('mine'))[0].commission_cents,0)
await db.exec('reset role');await db.query(`update orders set payment_review=false,status='refunded' where id=$1`,[o1]);await identity(bruno);assert.equal((await rpc('mine'))[0].commission_cents,0)
await db.exec('reset role');await db.query(`update orders set status='approved' where id=$1`,[o1]);await identity(owner);await rpc('toggle',{eventId:event,id:invite.id,active:false});await assert.rejects(()=>sale(o3,event,buyer,'event-promoter:'+referral),/indisponivel/)
await identity(bruno);assert.equal((await rpc('mine'))[0].commission_cents,900)
await identity(owner);const fixed=await rpc('create',{eventId:other,name:'Bruno B',mode:'fixed',value:2000});await identity(bruno);await rpc('join',{secret:fixed.invite,accepted:true});const b=(await rpc('mine')).find(r=>r.event_id===other);await sale(o3,other,buyer,'event-promoter:'+b.referral_secret);await identity(bruno);assert.equal((await rpc('mine')).find(r=>r.event_id===other).commission_cents,4000)
await identity('', 'anon');await assert.rejects(()=>db.query('select * from event_sales_promoters'),/permission denied/);await assert.rejects(()=>rpc('mine'),/permission denied/)
assert.ok((await db.query('select event_sales_invite_info($1) as info',[fixed.invite])).rows[0].info)
await db.close();console.log('PASS: SQL installation, owner isolation, consent, single claim, event attribution, self purchase, percent/fixed commission, review/refund, deactivation and private tables.')
