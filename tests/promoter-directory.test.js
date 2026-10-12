import test from 'node:test'
import assert from 'node:assert/strict'
import {PGlite} from '@electric-sql/pglite'
import {readFile} from 'node:fs/promises'
test('directory requires owner, normalizes registration CPF and preserves rows',async()=>{
 const db=new PGlite();try{await db.exec(`create schema auth;create role anon;create role authenticated;create table auth.users(id uuid,email text,raw_user_meta_data jsonb);create table public.promoter_profiles(user_id uuid,display_name text,phone text,status text,created_at timestamptz);create function public.promoter_require_user() returns void language sql as 'select';create function public.legal_is_owner() returns boolean language sql as $$select coalesce(current_setting('test.owner',true),'false')='true'$$;insert into auth.users values('10000000-0000-4000-8000-000000000001','example@example.test','{"name":"Pessoa Teste","cpf":"529.982.247-25"}');insert into public.promoter_profiles values('10000000-0000-4000-8000-000000000001','DJ Aurora','45999999999','approved','2026-10-01');`);
 const sql=await readFile(new URL('../supabase/migrations/023_promoter_admin_directory.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);await assert.rejects(db.query('select public.promoter_admin_directory()'),/Acesso restrito/);await db.exec("set test.owner='true'");const row=(await db.query('select public.promoter_admin_directory() data')).rows[0].data.promoters[0];assert.equal(row.cpf,'52998224725');assert.equal(row.name,'Pessoa Teste');assert.equal((await db.query("select has_function_privilege('anon','public.promoter_admin_directory(integer)','execute') allowed")).rows[0].allowed,false);assert.equal((await db.query('select count(*)::int n from auth.users')).rows[0].n,1);
 }finally{await db.close()}
})
