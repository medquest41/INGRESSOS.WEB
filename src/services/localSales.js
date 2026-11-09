import {supabase} from '../lib/supabase'
import {mapOrder} from './remoteData'
export async function getLocalSaleCapabilities(eventId){
 const {data,error}=await supabase.rpc('local_sale_capabilities',{target:eventId})
 if(error)throw Error(['PGRST202','42883'].includes(error.code)?'A venda local ainda não está habilitada. Solicite a ativação à administração.':error.message||'Não foi possível conferir a habilitação da venda local.')
 if(data?.enabled!==true||data?.feePolicy!=='no_platform_fee')throw Error('Confira a configuração de venda local antes de emitir.')
 return data
}
export async function createRemoteLocalSale(input){
 const {data,error}=await supabase.rpc('create_local_sale',{batch_id:input.ticketId,units:input.quantity,buyer_data:input.buyer,request_id:input.requestId,received_confirmed:input.received,eligibility_confirmed:input.eligible,expected_total_cents:input.expectedCents,sale_overrides:input.saleOverrides||{}})
 if(error){const missing=['PGRST202','42883'].includes(error.code);throw Object.assign(Error(missing?'A venda local ainda não está habilitada. Solicite a ativação à administração.':error.message||'Não foi possível confirmar a emissão. Tente novamente para consultar a mesma tentativa.'),{definitive:missing||['P0001','22007','22008','22003','23514','42501'].includes(error.code)})}
 const response=await supabase.from('orders').select('*,tickets(*),order_status_history(*)').eq('id',data).single()
 if(response.error)throw Error('A emissão pode ter sido concluída. Clique em tentar novamente para recuperar os mesmos ingressos.')
 return mapOrder(response.data)
}
