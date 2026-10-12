import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'
test('incremental CPF guard preserves existing users and rejects normalized duplicate inserts and changes',async()=>{
 const db=new PGlite();try{
 await db.exec("create schema auth;create role anon;create role authenticated;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}'::jsonb);");
 const sql=await readFile(new URL('../supabase/migrations/022_signup_cpf_guard.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);
 const one='10000000-0000-4000-8000-000000000001',two='10000000-0000-4000-8000-000000000002';
 await db.query('insert into auth.users values($1,$2)',[one,{cpf:'529.982.247-25',name:'Original'}]);
 await assert.rejects(db.query('insert into auth.users values($1,$2)',[two,{cpf:'52998224725'}]),/CPF já cadastrado/);
 await db.query('insert into auth.users values($1,$2)',[two,{name:'Sem CPF'}]);
 await assert.rejects(db.query('update auth.users set raw_user_meta_data=$1 where id=$2',[{cpf:'52998224725'},two]),/CPF já cadastrado/);
 await db.query('update auth.users set raw_user_meta_data=$1 where id=$2',[{cpf:'52998224725',name:'Original atualizado'},one]);
 assert.equal((await db.query('select count(*)::int n from auth.users')).rows[0].n,2);
 }finally{await db.close()}
})
