// Read-only probe. Never prints keys, session data, or returned customer rows.
import {readFileSync} from 'node:fs'
const env={}
for(const line of readFileSync('.env.local','utf8').split(/\r?\n/)){const match=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(match)env[match[1]]=match[2].replace(/^['"]|['"]$/g,'')}
const url=env.VITE_SUPABASE_URL,key=env.VITE_SUPABASE_PUBLISHABLE_KEY||env.VITE_SUPABASE_ANON_KEY
if(!url||!key)throw new Error('Configuração pública ausente')
for(const endpoint of ['/auth/v1/settings','/rest/v1/events?select=id&limit=0']){
try{const r=await fetch(url+endpoint,{headers:{apikey:key},signal:AbortSignal.timeout(15000)});console.log(endpoint.split('?')[0]+': HTTP '+r.status)}catch{console.log(endpoint.split('?')[0]+': conexão indisponível');process.exitCode=1}
}
