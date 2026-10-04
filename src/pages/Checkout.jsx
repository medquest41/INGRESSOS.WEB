/* oxlint-disable react/set-state-in-effect -- Debounced server quote must invalidate stale amounts immediately. */
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CreditCard, QrCode } from 'lucide-react'
import Brand from '../components/Brand'
import { useEventStore } from '../store/EventStore'
import { useAuth } from '../store/AuthStore'
import { getEventPublicPath } from '../utils/eventSlug'
const brl = value => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
export default function Checkout() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { events, placeOrder, getQuote, getRemaining, quoteRemote, isLocalDemo } = useEventStore()
  const { currentUser } = useAuth()
  const event = events.find(e => e.id === params.get('event') || e.legacyId === params.get('event'))
  const ticket = event?.ticketTypes.find(t => t.id === params.get('ticket') || t.legacyId === params.get('ticket'))
  const [serverQuote,setServerQuote] = useState(null)
  const [serverError,setServerError] = useState('')
  const [quoteBusy,setQuoteBusy] = useState(false)
  const [quantity, setQuantity] = useState(Number(params.get('q') || 1))
  const [buyer, setBuyer] = useState({ name: currentUser.name, email: currentUser.email, cpf: '', phone: '', birthDate: '' })
  const [method, setMethod] = useState('pix')
  const [outcome, setOutcome] = useState('approved')
  const [coupon, setCoupon] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [today] = useState(()=>new Date().toISOString().slice(0,10))
  const pending = useRef(false)
  const idempotencyKey = useRef(crypto.randomUUID())
  const quoteTicketId=ticket?.id
  useEffect(()=>{
    if(isLocalDemo||!quoteTicketId)return
    let active=true;setQuoteBusy(true);setServerQuote(null);setServerError('')
    const timer=setTimeout(()=>{quoteRemote(quoteTicketId,quantity,coupon).then(q=>{if(active)setServerQuote(q)}).catch(err=>{if(active)setServerError(err.message)}).finally(()=>{if(active)setQuoteBusy(false)})},300)
    return()=>{active=false;clearTimeout(timer)}
  },[isLocalDemo,quoteTicketId,quantity,coupon,quoteRemote])
  let totals, quoteError = ''
  try { totals = getQuote(event, ticket, quantity, coupon) } catch (err) { quoteError = err.message }
  if(!isLocalDemo){totals=serverQuote;quoteError=serverError}
  async function finish(e) {
    e.preventDefault()
    if (pending.current || !totals) return
    pending.current = true; setBusy(true); setError('')
    try {
      await placeOrder({ eventId: event.id, ticketId: ticket.id, quantity, buyer, method, outcome, coupon, campaign: params.get('campaign') || '', source: params.get('ref') || params.get('utm_source') || 'direto', idempotencyKey: idempotencyKey.current })
      navigate('/ingressos', { replace: true, state: { approved: true } })
    } catch (err) { setError(err.message) } finally { pending.current = false; setBusy(false) }
  }
  if (!event?.published || event.archived || !ticket) return <div className="empty-page"><h1>Ingresso indisponível.</h1><Link to="/eventos">Ver eventos</Link></div>
  return <div className="checkout-page"><header className="simple-header"><Link to={getEventPublicPath(event)} className="event-back"><ArrowLeft size={18}/>Voltar</Link><Brand/><Link to="/ingressos">Minha conta</Link></header><main className="checkout-wrap"><section><span className="section-kicker">CHECKOUT</span><h1>Finalize sua experiência.</h1><form className="buyer-form" onSubmit={finish}><h3>Dados do comprador</h3><div className="form-grid">
    {Object.entries({ name: 'Nome completo', cpf: 'CPF', email: 'E-mail da conta', phone: 'Telefone com DDD', birthDate: 'Data de nascimento' }).map(([field,label]) => <label key={field}>{label}<input required type={field === 'birthDate' ? 'date' : field === 'email' ? 'email' : field === 'phone' ? 'tel' : 'text'} max={field === 'birthDate' ? today : undefined} readOnly={field === 'email'} value={buyer[field]} onChange={e => setBuyer({ ...buyer, [field]: e.target.value })}/></label>)}
    <label>Quantidade<input type="number" required min="1" max={Math.min(10, getRemaining(event,ticket))} value={quantity} onChange={e=>setQuantity(Number(e.target.value))}/></label><label>Cupom de desconto<input value={coupon} onChange={e=>setCoupon(e.target.value.toUpperCase())}/></label></div>
    {ticket.type === 'table' && <p>Uma unidade corresponde a uma mesa/camarote. O grupo entra junto usando um único QR Code.</p>}
    {isLocalDemo ? <><h3>Forma de pagamento</h3><div className="payment-options"><button type="button" className={method==='pix'?'active':''} onClick={()=>setMethod('pix')}><QrCode/>PIX<span>Simulação</span></button><button type="button" className={method==='card'?'active':''} onClick={()=>setMethod('card')}><CreditCard/>Cartão<span>Simulação sem dados bancários</span></button></div><div className="demo-warning">Modo demonstração: nenhuma cobrança será realizada. Os ingressos são locais deste navegador.</div><label>Resultado da simulação<select value={outcome} onChange={e=>setOutcome(e.target.value)}><option value="approved">Aprovar pagamento</option><option value="declined">Recusar pagamento</option></select></label></> : <p className="demo-warning">Pedidos ficam reservados por 15 minutos. Pagamento online ainda não habilitado; não há cobrança nem emissão de ingressos pagos. Pedidos gratuitos são confirmados pelo sistema.</p>}
    {(error || quoteError) && <p role="alert" className="auth-error">{error || quoteError}</p>}<button className="checkout-button" disabled={busy || quoteBusy || !totals}>{busy ? 'Processando...' : isLocalDemo ? 'Confirmar compra simulada' : 'Confirmar pedido'}</button></form></section><aside className="checkout-summary"><img src={event.image} alt={event.title}/><span>{event.category}</span><h2>{event.title}</h2><p>{ticket.name} • {ticket.batch} • {quantity}x</p>{totals && <>{[['Subtotal',totals.subtotal],['Desconto',-totals.discount],['Taxa',totals.fee],['Total',totals.total]].map(([label,value])=><div key={label}><span>{label}</span><strong>{brl(value)}</strong></div>)}</>}</aside></main></div>
}
