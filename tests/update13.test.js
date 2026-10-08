import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const admin='10000000-0000-4000-8000-000000000001'
const client='10000000-0000-4000-8000-000000000002'
const invited='10000000-0000-4000-8000-000000000003'

async function setup(){
  const db=new PGlite()
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
  create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',email_confirmed_at timestamptz);
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`)
  for(const file of ['001_platform.sql','002_production.sql','003_order_history_global_coupons.sql','004_preservation_reservation_limits.sql','005_primary_admin_email.sql','008_event_platform_fee_and_safe_delete.sql','011_self_service_organizers_and_account_admin.sql']){
    await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'))
  }
  await db.query('insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),$3),($4,$5,now(),$6)',[admin,'ingressosaltatemporada@gmail.com',{name:'Principal'},client,'cliente@example.test',{name:'Cliente Teste'}])
  await db.query("update public.profiles set role='admin' where id=$1",[admin])
  return db
}
async function as(db,id){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated')}
const scalar=async(db,sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0]

test('Atualizacao 13: cliente vira organizador, convite aplica perfil e exclusao sem historico funciona',async()=>{
  const db=await setup()
  try{
    await as(db,client)
    const org=await scalar(db,'select public.become_organizer($1)',['Minha Produtora'])
    assert.ok(org)
    await db.exec('reset role')
    assert.equal(await scalar(db,'select role from public.profiles where id=$1',[client]),'organizador')

    await as(db,admin)
    const invite=await scalar(db,'select public.prepare_account_invite($1,$2,$3,null,$4)',['Nova Pessoa','nova@example.test','organizador','Empresa Nova'])
    assert.equal(invite.status,'pending')
    await db.exec('reset role')
    await db.query('insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),$3)',[invited,'nova@example.test',{name:'Nova'}])
    assert.equal(await scalar(db,'select role from public.profiles where id=$1',[invited]),'organizador')

    await as(db,admin)
    assert.equal(await scalar(db,'select public.safe_delete_member($1)',[invited]),'deleted')
    await db.exec('reset role')
    assert.equal(await scalar(db,'select count(*)::int from auth.users where id=$1',[invited]),0)
  }finally{await db.close()}
})
