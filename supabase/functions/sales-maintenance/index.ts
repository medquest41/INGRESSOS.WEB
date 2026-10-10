import {verifySalesOwner} from '../_shared/sales-auth.mjs'
import {createClient} from 'npm:@supabase/supabase-js@2.117.2'
const env=(key:string)=>Deno.env.get(key)||''
Deno.serve(async req=>{
 const origin=req.headers.get('origin')||''
 const allowed=env('SALES_MAINTENANCE_ALLOWED_ORIGINS').split(',').map(s=>s.trim()).filter(Boolean).includes(origin)
 const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':allowed?origin:'null','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin','Cache-Control':'no-store'}
 const respond=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers})
 if(!allowed)return respond({error:'Origem não autorizada.'},403)
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers})
 if(req.method!=='POST')return respond({error:'Método inválido.'},405)
 const url=env('SUPABASE_URL'),anon=env('SUPABASE_ANON_KEY'),key=env('SUPABASE_SERVICE_ROLE_KEY')
 const publicClient=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}})
 const service=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
 const token=(req.headers.get('authorization')||'').replace(/^Bearer /i,'')
 const {data:identity,error:identityError}=await publicClient.auth.getUser(token)
 if(identityError||!identity.user||identity.user.email?.toLowerCase()!=='ingressosaltatemporada@gmail.com')return respond({error:'Acesso exclusivo do Admin Geral.'},403)
 try{
  const body=await req.json()
  if(typeof body.password!=='string'||body.password.length<6||body.password.length>256||!Array.isArray(body.orderIds)||body.orderIds.length>500)return respond({error:'Confira a senha e a seleção.'},400)
  try {await verifySalesOwner(publicClient,token,body.password)}catch{return respond({error:'Senha inválida. A limpeza não foi realizada.'},403)}
  const {data:count,error:cleanupError}=await service.rpc('archive_test_sales',{actor_id:identity.user.id,target_event:body.eventId,selected_orders:body.orderIds,confirmation:body.confirmation})
  await publicClient.auth.signOut({scope:'local'})
  if(cleanupError)return respond({error:cleanupError.message},400)
  return respond({count})
 }catch{return respond({error:'Não foi possível realizar a limpeza.'},400)}
})
