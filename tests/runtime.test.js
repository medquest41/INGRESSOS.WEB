import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveRuntime } from '../src/lib/runtime.js'
const env={VITE_SUPABASE_URL:'https://project.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_public'}
test('runtime refuses missing configuration, unsafe keys and production local fallback',()=>{
 assert.equal(resolveRuntime({},false).mode,'error')
 assert.equal(resolveRuntime({VITE_LOCAL_DEMO:'true'},false).mode,'error')
 assert.equal(resolveRuntime({VITE_LOCAL_DEMO:'true'},true).mode,'local')
 assert.equal(resolveRuntime(env,false).mode,'supabase')
 for(const key of ['sb_secret_hidden','not-a-key','e30.'+btoa(JSON.stringify({role:'service_role'}))+'.sig'])assert.equal(resolveRuntime({...env,VITE_SUPABASE_PUBLISHABLE_KEY:key},false).mode,'error')
 const anon='e30.'+btoa(JSON.stringify({role:'anon'}))+'.sig'
 assert.equal(resolveRuntime({VITE_SUPABASE_URL:env.VITE_SUPABASE_URL,VITE_SUPABASE_ANON_KEY:anon},false).mode,'supabase')
})
