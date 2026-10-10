import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { X } from 'lucide-react'
import {canHideUnpaidOrder,hiddenOrdersKey,readHiddenOrders} from '../utils/hiddenOrders'
import Brand from '../components/Brand'
import {canShowQR} from '../utils/experience'
import {shareTicket,printTicket} from '../services/ticketShare'
import InlinePayment from '../components/InlinePayment'
import {getPaymentCapabilities,cancelPaymentOrder} from '../services/inlinePayment'
import { useEventStore } from '../store/EventStore'
import { useAuth } from '../store/AuthStore'
import { ownsOrder, approved } from '../utils/commerce'
import './MeusIngressos.css'

const status = value => ({pending:'Pendente',approved:'Confirmado',cancelled:'Cancelado',refunded:'Estornado',rejected:'Recusado',expired:'Expirado',in_process:'Em processamento',authorized:'Em processamento',review:'Em revisão',charged_back:'Contestado'}[value] || value)
export default function MeusIngressos() {
  const { orders, isLocalDemo, cancelOrder, refresh } = useEventStore()
  const { currentUser, logout } = useAuth()
  const location = useLocation()
  const [now] = useState(()=>Date.now())
  const [eventId,setEventId] = useState('')
  const [paying,setPaying]=useState(()=>new URLSearchParams(window.location.search).get('payment'))
  const paymentConfirmed=useCallback(()=>{setPaying(null);refresh?.()},[refresh])
  const [paymentError,setPaymentError]=useState('')
  const [cardEnabled,setCardEnabled]=useState(false),[cancelling,setCancelling]=useState(null)
  const [hiddenOrders,setHiddenOrders]=useState(()=>({userId:currentUser.id,ids:readHiddenOrders(currentUser.id)}))
  const [removing,setRemoving]=useState(null)
  const hiddenIds=hiddenOrders.userId===currentUser.id?hiddenOrders.ids:readHiddenOrders(currentUser.id)
  const allMine=orders.filter(order=>ownsOrder(currentUser,order))
  const hiddenCount=allMine.filter(order=>hiddenIds.includes(order.id)&&canHideUnpaidOrder(order)).length
  function storeHidden(ids){
    localStorage.setItem(hiddenOrdersKey(currentUser.id),JSON.stringify(ids))
    setHiddenOrders({userId:currentUser.id,ids})
  }
  async function removeUnpaid(order){
    if(removing||!canHideUnpaidOrder(order))return
    if(!window.confirm(order.status==='pending'?'Cancelar este pedido não pago e removê-lo da sua lista? Se você já pagou, mantenha o pedido e verifique o pagamento.':'Remover este pedido não pago da sua lista? Você poderá mostrá-lo novamente neste navegador.'))return
    setRemoving(order.id);setPaymentError('')
    try{
      if(order.status==='pending'){
        if(isLocalDemo)await cancelOrder(order.id)
        else {const response=await cancelPaymentOrder(order.id);if(response.status!=='cancelled')throw new Error('O pedido não foi cancelado. Verifique o pagamento antes de remover.')}
      }
      storeHidden([...new Set([...hiddenIds,order.id])])
      if(paying===order.id)setPaying(null)
      await refresh?.()
    }catch(error){setPaymentError(error.message||'Não foi possível remover o pedido.')}
    finally{setRemoving(null)}
  }
  useEffect(()=>{if(isLocalDemo)return;let active=true;getPaymentCapabilities().then(data=>{if(active)setCardEnabled(data.cardEnabled===true)});return()=>{active=false}},[isLocalDemo])
  const mine = allMine.filter(order=>!hiddenIds.includes(order.id)||!canHideUnpaidOrder(order))
  const groups = [...new Set(mine.map(order=>order.eventId))].map(id=>({id,title:mine.find(order=>order.eventId===id)?.eventTitle,orders:mine.filter(order=>order.eventId===id)}))
  const selected = groups.filter(group=>!eventId || String(group.id)===eventId)
  return <div className="tickets-page">
    <header className="simple-header"><Link to="/eventos">Eventos</Link><Brand/><button className="ghost-btn" onClick={logout}>Sair</button></header>
    <main className="tickets-wrap">
      <span className="section-kicker">MINHA CONTA • {currentUser.name}</span><h1>Meus ingressos.</h1>{paymentError&&<p role="alert" className="auth-error">{paymentError}</p>}
      {location.state?.approved && <p role="status" className="team-success">{isLocalDemo?'Compra simulada aprovada. Seus ingressos estão abaixo.':'Pedido registrado. Confira o status abaixo.'}</p>}
      {isLocalDemo ? <p className="demo-warning">Demonstração local. Mantenha este navegador para acessar os ingressos.</p> : <button className="ghost-btn" onClick={refresh}>Atualizar pedidos</button>}
      {groups.length>0&&<div className="form-grid my-event-filter"><label>Filtrar meus ingressos por evento<select value={eventId} onChange={e=>setEventId(e.target.value)}><option value="">Todos os meus eventos</option>{groups.map(group=><option key={group.id} value={group.id}>{group.title}</option>)}</select></label></div>}
      <button className="ghost-btn" disabled={!selected.some(group=>group.orders.some(order=>approved(order)&&!order.paymentReview&&(order.ticketCodes||[]).some(ticket=>canShowQR(order,ticket))))} onClick={()=>window.print()}>Imprimir / salvar PDF</button>
      {hiddenCount>0&&<button className="ghost-btn" onClick={()=>{try{storeHidden([]);setEventId('')}catch{setPaymentError('Não foi possível mostrar os pedidos.')}}}>Mostrar pedidos removidos ({hiddenCount})</button>}
      {!mine.length ? <div className="tickets-empty"><h2>Você ainda não possui ingressos.</h2><Link to="/eventos" className="primary-cta">Explorar eventos</Link></div> : selected.map(group=><section className="customer-event-tickets" key={group.id} aria-label={'Meus ingressos de '+group.title}>
        <h2>{group.title}</h2>
        {!isLocalDemo&&group.orders.map(order=><section className="admin-panel" key={order.id}>
          <div className="customer-order-heading"><p>Pedido {order.id} • {status(order.paymentReview?'review':order.status==='pending'&&new Date(order.expiresAt).getTime()<=Date.now()?'expired':order.status==='pending'?order.paymentStatus||'pending':order.status)}</p>{canHideUnpaidOrder(order)&&<button type="button" className="customer-order-remove" aria-label={'Remover pedido não pago '+order.id} title="Remover pedido não pago da lista" disabled={Boolean(removing)} onClick={()=>removeUnpaid(order)}><X size={20}/></button>}</div>
          <details><summary>Histórico do pedido</summary>{(order.orderHistory||[]).map(item=><p key={item.id}>{new Date(item.created_at).toLocaleString('pt-BR')} • {status(item.to_status)}</p>)}</details>
          {paying===order.id&&<><InlinePayment orderId={order.id} cardEnabled={cardEnabled} onConfirmed={paymentConfirmed} onCancelled={paymentConfirmed}/><button className="ghost-btn" onClick={()=>setPaying(null)}>Fechar pagamento</button></>}
          <p>Total: {Number(order.total).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</p>
          {order.status==='pending'&&<><p>{new Date(order.expiresAt).getTime()>now?'Reserva até '+new Date(order.expiresAt).toLocaleString('pt-BR'):'Reserva expirada. Faça um novo pedido.'}</p>{new Date(order.expiresAt).getTime()>Date.now() && <button className="primary-small" disabled={Boolean(paying)} onClick={()=>{setPaying(order.id);setPaymentError('')}}>{paying===order.id?'Pagamento aberto abaixo':'Pagar pedido'}</button>}{cancelling===order.id?<><p>Confirma o cancelamento deste pedido ainda não pago?</p><button className="ghost-btn" onClick={async()=>{try{if(isLocalDemo)await cancelOrder(order.id);else await cancelPaymentOrder(order.id);setCancelling(null);setPaying(null);await refresh?.()}catch(err){setPaymentError(err.message)}}}>Confirmar cancelamento</button><button className="ghost-btn" onClick={()=>setCancelling(null)}>Manter pedido</button></>:<button className="ghost-btn" onClick={()=>setCancelling(order.id)}>Cancelar pedido</button>}</>}
        </section>)}
        <div className="my-ticket-grid">{group.orders.flatMap(order=>(!approved(order)||order.paymentReview?[]:order.ticketCodes||[]).map((ticket,index)=>{
          const cancelled=!approved(order)||ticket.status==='cancelled'
          return <article className="my-ticket" data-code={ticket.code} key={ticket.code}><img src={order.eventImage} alt={order.eventTitle} onError={e=>{e.currentTarget.style.display='none'}}/><div className="my-ticket-content">
            <span>{order.eventDate} • {order.eventTime}</span><h2>{order.eventTitle}</h2><p>{ticket.holder?.name||order.buyer?.name}</p><p>CPF final {(ticket.holder?.cpf||order.buyer?.cpf||'').replace(/\D/g,'').slice(-4)}</p><p>{order.ticketName} • {order.batch} • {index+1}/{order.quantity}</p><p>{order.unitLabel}</p>
            {canShowQR(order,ticket)&&<div className="qr-box"><QRCodeSVG value={ticket.code} size={180}/></div>}<code>{ticket.code}</code>
            <div className={'ticket-status '+(cancelled||ticket.used?'used':'valid')}>{cancelled?'Cancelado':ticket.used?'Já utilizado':'Válido'}</div><small>Pedido {order.id}</small>{canShowQR(order,ticket)&&<div><button className="ghost-btn" onClick={()=>printTicket(ticket.code)}>PDF / Salvar</button><button className="ghost-btn" onClick={async()=>{try{await shareTicket(order,ticket)}catch(err){setPaymentError(err.message)}}}>Compartilhar no WhatsApp</button></div>}<p>E-mail: {order.emailDeliveryStatus==='sent'?'Enviado pelo provedor':order.emailDeliveryStatus==='pending'?'Aguardando serviço de envio':'Envio não confirmado. Os ingressos estão disponíveis aqui.'}</p>
          </div></article>
        }))}</div>
      </section>)}
    </main>
  </div>
}
