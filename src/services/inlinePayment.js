import { supabase } from '../lib/supabase'
async function request(action,orderId,extra={}) {
  const {data,error}=await supabase.functions.invoke('payments',{body:{action,orderId,...extra}})
  if(error||data?.error){
    let message=data?.error
    if(!message&&error?.context){try{message=(await error.context.json()).error}catch{/* Generic error below. */}}
    throw new Error(message||'Pagamento indisponível. Confira sua conexão e tente novamente.')
  }
  return data
}
export const getPaymentOrder=id=>request('order',id)
export const payInline=(id,method,card)=>request('pay',id,{method,card})
export const pollPayment=id=>request('poll',id)
let sdkPromise
export function loadCardSdk(){
  if(window.MercadoPago)return Promise.resolve(window.MercadoPago)
  if(!sdkPromise)sdkPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src='https://sdk.mercadopago.com/js/v2';script.async=true
    script.onload=()=>window.MercadoPago?resolve(window.MercadoPago):reject(new Error('Formulário de cartão indisponível.'))
    script.onerror=()=>{sdkPromise=null;script.remove();reject(new Error('Não foi possível carregar o formulário de cartão.'))}
    document.head.appendChild(script)
  })
  return sdkPromise
}
