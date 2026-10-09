import { supabase } from '../lib/supabase'
async function request(action,orderId){
 const {data:{session},error:sessionError}=await supabase.auth.getSession()
 if(sessionError||!session)throw new Error('Sua sessão expirou. Entre novamente.')
 const {data,error}=await supabase.functions.invoke('payments',{headers:{Authorization:'Bearer '+session.access_token},body:{action,orderId}})
 if(error||data?.error){let message=data?.error;if(!message&&error?.context){try{message=(await error.context.json()).error}catch{/* fallback */}}throw new Error(message||'Não foi possível consultar o pagamento. Tente novamente.')}
 if(!data||typeof data.status!=='string')throw new Error('Resposta de pagamento inválida.')
 return data
}
export async function getPaymentOrder(id){const {data,error}=await supabase.from('orders').select('id,total_cents,status,expires_at').eq('id',id).single();if(error)throw new Error('Não foi possível carregar seu pedido.');return {id:data.id,total:data.total_cents/100,status:data.status,expiresAt:data.expires_at}}
export const payInline=(id,method)=>method==='pix'?request('create_pix',id):Promise.reject(new Error('Cartão ainda indisponível. Use Pix.'))
export const pollPayment=id=>request('status',id)
