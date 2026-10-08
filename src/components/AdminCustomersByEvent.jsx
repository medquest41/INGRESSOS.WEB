import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Search, Ticket, Users } from 'lucide-react'
import { approved } from '../utils/commerce'
import { formatCpf, matchesBuyerSearch } from '../utils/buyerSearch'
import './AdminCustomersByEvent.css'

function keyFor(order){return String(order.buyer?.cpf||'').replace(/\D/g,'') || order.buyer?.email || order.id}

export default function AdminCustomersByEvent({ events, orders }) {
  const [eventSearch,setEventSearch]=useState('')
  const [globalSearch,setGlobalSearch]=useState('')
  const [globalOpen,setGlobalOpen]=useState(false)
  const rows=useMemo(()=>events.map(event=>{
    const sales=orders.filter(order=>String(order.eventId)===String(event.id))
    const customers=new Set(sales.map(keyFor)).size
    const sold=sales.filter(approved).reduce((sum,order)=>sum+Number(order.quantity||0),0)
    return {event,customers,sold,orders:sales.length}
  }),[events,orders])
  const visibleRows=rows.filter(({event})=>`${event.title} ${event.location||''} ${event.organizerName||''}`.toLowerCase().includes(eventSearch.trim().toLowerCase()))
  const globalCustomers=useMemo(()=>{
    const map=new Map()
    for(const order of orders){
      if(!order.buyer?.email)continue
      const key=keyFor(order)
      const existing=map.get(key)||{buyer:order.buyer,events:new Set(),orders:0}
      existing.events.add(order.eventTitle||events.find(e=>String(e.id)===String(order.eventId))?.title||'Evento')
      existing.orders++
      map.set(key,existing)
    }
    return [...map.values()].filter(item=>matchesBuyerSearch(item.buyer,globalSearch))
  },[orders,events,globalSearch])

  return <>
    <div className="admin-title"><div><span className="section-kicker">CLIENTES POR EVENTO</span><h1>Clientes.</h1><p className="muted">Escolha um evento para abrir somente os clientes daquele evento.</p></div></div>
    <section className="admin-panel customer-event-browser">
      <div className="customer-browser-head"><div className="account-search"><Search/><input value={eventSearch} onChange={e=>setEventSearch(e.target.value)} placeholder="Buscar evento"/></div><button className="ghost-btn" onClick={()=>setGlobalOpen(value=>!value)}><Users/>{globalOpen?'Ocultar busca global':'Buscar cliente em todos os eventos'}</button></div>
      <div className="customer-event-grid">
        {visibleRows.map(({event,customers,sold,orders:orderCount})=><Link className="customer-event-card" key={event.id} to={`/admin/evento/${encodeURIComponent(event.id)}/customers`}>
          <div className="customer-event-image">{event.image?<img src={event.image} alt=""/>:<Ticket/>}</div>
          <div><span className="section-kicker">{event.organizerName||'EVENTO'}</span><h3>{event.title}</h3><p>{customers} cliente{customers===1?'':'s'} • {sold} ingresso{sold===1?'':'s'} vendido{sold===1?'':'s'} • {orderCount} pedido{orderCount===1?'':'s'}</p></div>
          <ArrowRight className="customer-event-arrow"/>
        </Link>)}
        {visibleRows.length===0&&<p>Nenhum evento encontrado.</p>}
      </div>
    </section>
    {globalOpen&&<section className="admin-panel global-customer-search"><div className="team-card-title"><Users/><div><h2>Todos os clientes</h2><p>Use quando você souber o nome, e-mail ou CPF, mas não souber em qual evento a pessoa comprou.</p></div></div><div className="account-search"><Search/><input value={globalSearch} onChange={e=>setGlobalSearch(e.target.value)} placeholder="Nome, e-mail ou CPF"/></div>{globalCustomers.map(item=><div className="order-row" key={keyFor({buyer:item.buyer})}><div><strong>{item.buyer.name}</strong><span>CPF: {formatCpf(item.buyer.cpf)}</span><span>{item.buyer.email}</span><small>{[...item.events].join(' • ')}</small></div><span>{item.orders} pedido{item.orders===1?'':'s'}</span></div>)}{globalCustomers.length===0&&<p>Nenhum cliente encontrado.</p>}</section>}
  </>
}
