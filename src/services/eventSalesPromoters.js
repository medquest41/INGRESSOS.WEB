import {supabase,result} from '../lib/supabase'
export async function eventSales(action,payload={}){
 try{return await result(supabase.rpc('event_sales_promoters_api',{action,payload}))}catch(error){if(/PGRST202|does not exist|schema cache|Could not find the function/.test(error.code+' '+error.message))throw Error('Os promotores do evento ainda precisam ser ativados no banco. Solicite ao administrador a atualização 024.');throw error}
}
export async function inviteInfo(secret){try{return await result(supabase.rpc('event_sales_invite_info',{secret}))}catch{throw Error('Não foi possível consultar este convite. Peça ao organizador para conferir se ele está ativo.')}}
export const eventSalesMoney=cents=>(Number(cents||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
export const commissionLabel=row=>row.commission_mode==='percent'?(row.commission_value/100).toLocaleString('pt-BR')+'% sobre ingressos, sem taxa da plataforma':eventSalesMoney(row.commission_value)+' por ingresso'
