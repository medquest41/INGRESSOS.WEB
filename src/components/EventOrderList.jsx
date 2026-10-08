import { useState } from 'react'
import { Link } from 'react-router-dom'
import { approved } from '../utils/commerce'
import { formatCpf } from '../utils/buyerSearch'
import './EventOrderList.css'

const brl = value => Number(value || 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const statusLabel = order => ({approved:'Confirmado',pending:'Pendente',cancelled:'Cancelado',refunded:'Estornado'}[order.status || 'approved'] || order.status)
export default function EventOrderList({ orders, events, eventId, cancelOrder, canViewCpf = false }) {
  const [page,setPage] = useState(1)
  const groups = events.map(event=>({event,rows:orders.filter(order=>String(order.eventId)===String(event.id))})).filter(group=>group.rows.length)
  if (!orders.length) return <p className="muted">Nenhum pedido encontrado para este evento ou filtro.</p>
  return <div className="event-order-groups">{groups.map(({event,rows})=>{
    const sorted=[...rows].sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0))
    const pages=Math.max(1,Math.ceil(sorted.length/25))
    const current=Math.min(page,pages)
    const displayed=eventId?sorted.slice((current-1)*25,current*25):sorted.slice(0,5)
    return <section className="event-order-group" key={event.id} aria-label={'Pedidos de '+event.title}>
      <header><div><h2>{event.title}</h2><p>{rows.length} pedido(s) • Confirmados: {brl(rows.filter(approved).reduce((sum,order)=>sum+Number(order.total||0),0))}</p></div>{!eventId&&<Link className="admin-event-management-link" to={'/admin/evento/'+encodeURIComponent(event.id)+'/orders'}>Ver pedidos deste evento</Link>}</header>
      {displayed.map(order=><article className="event-order-item" key={order.id}>
        <div><strong>{order.buyer?.name || 'Pedido registrado'}</strong>{canViewCpf && <span>CPF: {formatCpf(order.buyer?.cpf)}</span>}<span>{order.quantity} ingresso(s) • {order.ticketName || 'Ingresso'} • {order.batch || ''}</span><small>Pedido {order.id}</small></div>
        <div className="event-order-values"><strong>{brl(order.total)}</strong><span>{statusLabel(order)}</span><small>{order.source || 'Origem direta'}</small></div>
        <details><summary>Detalhes do pedido</summary><p>{order.buyer?.email}</p><p>{order.createdAt ? new Date(order.createdAt).toLocaleString('pt-BR') : ''}</p><p>Subtotal: {brl(order.subtotal)} • Desconto: {brl(order.discount)} • Taxa: {brl(order.fee)}</p>{(order.orderHistory||[]).map(item=><p key={item.id}>{new Date(item.created_at).toLocaleString('pt-BR')} • {item.to_status}</p>)}</details>
        {(approved(order)||order.status==='pending')&&<button className="ghost-btn" onClick={async()=>{if(window.confirm('Cancelar este pedido e invalidar seus ingressos?')){try{await cancelOrder(order.id)}catch(err){window.alert(err.message)}}}}>Cancelar pedido</button>}
      </article>)}
      {!eventId&&rows.length>5&&<p>Mostrando os 5 pedidos mais recentes. Abra os pedidos deste evento para consultar todos.</p>}
      {eventId&&pages>1&&<nav aria-label="Páginas dos pedidos"><button className="ghost-btn" disabled={current===1} onClick={()=>setPage(current-1)}>Anterior</button><span>{current} de {pages}</span><button className="ghost-btn" disabled={current===pages} onClick={()=>setPage(current+1)}>Próxima</button></nav>}
    </section>
  })}</div>
}
