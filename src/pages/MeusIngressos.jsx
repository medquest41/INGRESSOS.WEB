import { Link, useLocation } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import Brand from '../components/Brand'
import { useEventStore } from '../store/EventStore'
import { useAuth } from '../store/AuthStore'
import { ownsOrder, approved } from '../utils/commerce'
export default function MeusIngressos() {
  const { orders } = useEventStore()
  const { currentUser, logout } = useAuth()
  const location = useLocation()
  const mine = orders.filter(order => ownsOrder(currentUser, order))
  return <div className="tickets-page"><header className="simple-header"><Link to="/eventos">Eventos</Link><Brand/><button className="ghost-btn" onClick={logout}>Sair</button></header><main className="tickets-wrap"><span className="section-kicker">MINHA CONTA • {currentUser.name}</span><h1>Meus ingressos.</h1>{location.state?.approved && <p role="status" className="team-success">Compra simulada aprovada. Seus ingressos estão abaixo.</p>}<p className="demo-warning">Demonstração local. Mantenha este navegador para acessar os ingressos.</p><button className="ghost-btn" onClick={()=>window.print()}>Imprimir / salvar PDF</button>{mine.length===0?<div className="tickets-empty"><h2>Você ainda não possui ingressos.</h2><Link to="/eventos" className="primary-cta">Explorar eventos</Link></div>:<div className="my-ticket-grid">{mine.flatMap(order=>(order.ticketCodes || []).map((ticket,index)=>{const cancelled = !approved(order) || ticket.status === 'cancelled'; return <article className="my-ticket" key={ticket.code}><img src={order.eventImage} alt={order.eventTitle}/><div className="my-ticket-content"><span>{order.eventDate} • {order.eventTime}</span><h2>{order.eventTitle}</h2><p>{order.buyer?.name}</p><p>{order.ticketName} • {order.batch} • {index+1}/{order.quantity}</p><p>{order.unitLabel}</p>{!cancelled && !ticket.used && <div className="qr-box"><QRCodeSVG value={ticket.code} size={180}/></div>}<code>{ticket.code}</code><div className={'ticket-status ' + (cancelled || ticket.used ? 'used' : 'valid')}>{cancelled ? 'Cancelado' : ticket.used ? 'Já utilizado' : 'Válido'}</div><small>Pedido {order.id}</small></div></article>}))}</div>}</main></div>
}
