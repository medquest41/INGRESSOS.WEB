import {approved} from './commerce.js'
export const reportMetrics=[
 {key:'total',label:'Vendas aprovadas',action:'Ver pedidos pagos',status:'paid'},
 {key:'fees',label:'Taxas',action:'Ver taxas dos pedidos pagos',status:'paid'},
 {key:'net',label:'Valor dos ingressos',action:'Ver valores dos ingressos pagos',status:'paid'},
 {key:'cancelled',label:'Cancelados',action:'Ver cancelados e estornados',status:'cancelled_refunded'},
]
export const orderFilterStatus=value=>['pending','approved','cancelled','refunded','paid','cancelled_refunded'].includes(value)?value:''
export const orderReportDetail=value=>['fees','net'].includes(value)?value:''
export const orderDetailLabels={fees:'Taxa da plataforma',net:'Valor dos ingressos após desconto'}
export function matchesOrderStatus(order,status){
 if(status==='paid')return approved(order)
 if(status==='cancelled_refunded')return ['cancelled','refunded'].includes(order.status)
 return !status||(order.status||'approved')===status
}
export function reportAmount(order,key){
 if(key==='fees')return Number(order.platformFee??order.fee??0)
 if(key==='net')return Number(order.subtotal||0)-Number(order.discount||0)
 return Number(order.total||0)
}
export function reportOrdersHref(eventId,metric){
 const query=new URLSearchParams({status:metric.status})
 if(orderReportDetail(metric.key))query.set('detail',metric.key)
 if(eventId)return '/admin/evento/'+encodeURIComponent(eventId)+'/orders?'+query
 query.set('tab','orders');return '/admin?'+query
}
