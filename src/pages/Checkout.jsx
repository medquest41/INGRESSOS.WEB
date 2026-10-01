import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, CreditCard, QrCode, ShieldCheck, Ticket } from 'lucide-react'
import Brand from '../components/Brand'
import { useEventStore } from '../store/EventStore'

const brl = (v) => v.toLocaleString('pt-BR', { style:'currency', currency:'BRL' })
const code = (i) => `ING-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,7).toUpperCase()}-${i+1}`

export default function Checkout(){
  const [params] = useSearchParams(); const navigate = useNavigate(); const { events, addOrder } = useEventStore()
  const event = events.find(e=>e.id===params.get('event')); const ticket = event?.ticketTypes.find(t=>t.id===params.get('ticket')); const quantity = Math.max(1, Number(params.get('q')||1))
  const [method,setMethod]=useState('pix'); const [done,setDone]=useState(false); const [buyer,setBuyer]=useState({name:'',cpf:'',email:'',phone:''})
  const subtotal = ticket ? ticket.price*quantity : 0, fee=subtotal*.10, total=subtotal+fee
  const valid = buyer.name && buyer.cpf && buyer.email && buyer.phone
  function finish(e){ e.preventDefault(); if(!event||!ticket||!valid) return; const order={id:`PED-${Date.now()}`,createdAt:new Date().toISOString(),eventId:event.id,eventTitle:event.title,eventImage:event.image,eventDate:event.date,eventTime:event.time,ticketId:ticket.id,ticketName:ticket.name,quantity,subtotal,fee,total,method,buyer,ticketCodes:Array.from({length:quantity},(_,i)=>({code:code(i),used:false}))}; addOrder(order); setDone(true); setTimeout(()=>navigate('/ingressos'),1200) }
  if(!event||!ticket) return <div className="empty-page"><h1>Compra inválida.</h1><Link className="primary-cta" to="/">Voltar</Link></div>
  if(done) return <div className="checkout-done"><CheckCircle2/><h1>Pedido criado!</h1><p>Seus ingressos já estão em “Meus ingressos”.</p></div>
  return <div className="checkout-page"><header className="simple-header"><Link to={`/evento/${event.id}`} className="event-back"><ArrowLeft size={18}/>Voltar</Link><Brand/><div/></header><main className="checkout-wrap"><section><span className="section-kicker">CHECKOUT</span><h1>Finalize sua experiência.</h1><form className="buyer-form" onSubmit={finish}><h3>Dados do comprador</h3><div className="form-grid"><label>Nome completo<input required value={buyer.name} onChange={e=>setBuyer({...buyer,name:e.target.value})}/></label><label>CPF<input required value={buyer.cpf} onChange={e=>setBuyer({...buyer,cpf:e.target.value})}/></label><label>E-mail<input required type="email" value={buyer.email} onChange={e=>setBuyer({...buyer,email:e.target.value})}/></label><label>Telefone<input required value={buyer.phone} onChange={e=>setBuyer({...buyer,phone:e.target.value})}/></label></div><h3>Forma de pagamento</h3><div className="payment-options"><button type="button" className={method==='pix'?'active':''} onClick={()=>setMethod('pix')}><QrCode/>PIX<span>Aprovação rápida</span></button><button type="button" className={method==='card'?'active':''} onClick={()=>setMethod('card')}><CreditCard/>Cartão<span>Estrutura pronta</span></button></div><div className="demo-warning">Pagamento em modo demonstração. Mercado Pago real será conectado na próxima etapa.</div><button className="checkout-button" disabled={!valid}>Finalizar pedido</button></form></section><aside className="checkout-summary"><img src={event.image} alt={event.title}/><span>{event.category}</span><h2>{event.title}</h2><p>{ticket.name} • {quantity}x</p><div><span>Subtotal</span><strong>{brl(subtotal)}</strong></div><div><span>Taxa</span><strong>{brl(fee)}</strong></div><div className="checkout-total"><span>Total</span><strong>{brl(total)}</strong></div><small><ShieldCheck/>Ambiente de demonstração protegido.</small></aside></main></div>
}
