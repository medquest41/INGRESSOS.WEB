import {supabase,result} from '../lib/supabase'
export async function promoterRpc(name,args={}){if(!supabase)throw Error('Programa disponível somente no ambiente conectado.');return result(supabase.rpc('promoter_'+name,args))}
export const promoterMoney=cents=>(Number(cents||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
export const promoterPercent=bps=>(Number(bps)/100).toLocaleString('pt-BR')+'%'
export function promoterLink(token){return new URL('/indicacao/'+token,location.origin).href}
export async function copyPromoterLink(token){await navigator.clipboard.writeText(promoterLink(token))}
export async function sharePromoterLink(token){const url=promoterLink(token);if(navigator.share)await navigator.share({title:'Crie seu evento no Ingressos Experiences',url});else await navigator.clipboard.writeText(url)}
