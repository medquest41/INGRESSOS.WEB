/* oxlint-disable react/set-state-in-effect -- Debounced server quote must invalidate stale amounts immediately. */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CreditCard, QrCode } from 'lucide-react'
import Brand from '../components/Brand'
import Participants from '../components/Participants'
import { needsAgeConfirmation, validateParticipants } from '../utils/experience'
import { useEventStore } from '../store/EventStore'
import { useAuth } from '../store/AuthStore'
import { getEventPublicPath } from '../utils/eventSlug'
import InlinePayment from '../components/InlinePayment'
import { getPaymentCapabilities } from '../services/inlinePayment'

const brl = value => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
export default function Checkout() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { events, placeOrder, getQuote, getRemaining, quoteRemote, isLocalDemo, refresh } = useEventStore()
  const { currentUser, startGuest } = useAuth()
  const event = events.find(e => e.id === params.get('event') || e.legacyId === params.get('event'))
  const ticket = event?.ticketTypes.find(t => t.id === params.get('ticket') || t.legacyId === params.get('ticket'))
  const [serverQuote,setServerQuote] = useState(null)
  const [serverError,setServerError] = useState('')
  const [quoteBusy,setQuoteBusy] = useState(false)
  const [quantity, setQuantity] = useState(Number(params.get('q') || 1))
  const [buyer, setBuyer] = useState({ name: currentUser?.guest ? '' : currentUser?.name || '', email: currentUser?.guest ? '' : currentUser?.email || '', cpf: '', phone: '', birthDate: '' })
  const [participants,setParticipants]=useState([]),[participantMode,setParticipantMode]=useState(event?.allowSameCpf===false?'individual':'same'),[participantsSaved,setParticipantsSaved]=useState(false),[ageConfirmed,setAgeConfirmed]=useState(false)
  const [method, setMethod] = useState('pix')
  const [cardEnabled,setCardEnabled]=useState(false)
  useEffect(()=>{if(isLocalDemo)return;let active=true;getPaymentCapabilities().then(data=>{if(active)setCardEnabled(data.cardEnabled===true&&data.version==='17.1')});return()=>{active=false}},[isLocalDemo,currentUser])
  const [outcome, setOutcome] = useState('approved')
  const [coupon, setCoupon] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const reservedOrder = useRef(null)
  const participantsDialog=useRef(null),buyerForm=useRef(null),resumePayment=useRef(false)
  const [participantsOpen,setParticipantsOpen]=useState(false)
  useEffect(()=>{
    const element=participantsDialog.current
    if(!element)return
    if(participantsOpen&&!element.open)element.showModal()
    if(!participantsOpen&&element.open)element.close()
    return()=>{if(element.open)element.close()}
  },[participantsOpen])
  useEffect(()=>{
    if(participantsSaved&&resumePayment.current){resumePayment.current=false;setParticipantsOpen(false);buyerForm.current?.requestSubmit()}
  },[participantsSaved])
  const [hasReservation, setHasReservation] = useState(false)
  const [reservationId,setReservationId]=useState(null)
  const [reservedTotals,setReservedTotals]=useState(null)
  const paymentConfirmed=useCallback(()=>{refresh?.();navigate('/ingressos',{replace:true,state:{approved:true}})},[navigate,refresh])
  const [today] = useState(()=>new Date().toISOString().slice(0,10))
  const pending = useRef(false)
  const idempotencyKey = useRef(crypto.randomUUID())
  const quoteTicketId=ticket?.id
  useEffect(()=>{
    if(isLocalDemo||!quoteTicketId||!currentUser)return
    let active=true;setQuoteBusy(true);setServerQuote(null);setServerError('')
    const timer=setTimeout(()=>{quoteRemote(quoteTicketId,quantity,coupon).then(q=>{if(active)setServerQuote(q)}).catch(err=>{if(active)setServerError(err.message)}).finally(()=>{if(active)setQuoteBusy(false)})},300)
    return()=>{active=false;clearTimeout(timer)}
  },[isLocalDemo,quoteTicketId,quantity,coupon,quoteRemote,currentUser])
  let totals, quoteError = ''
  try { totals = getQuote(event, ticket, quantity, coupon) } catch (err) { quoteError = err.message }
  if(!isLocalDemo){totals=reservedTotals||serverQuote;quoteError=serverError}
  async function finish(e) {
    e.preventDefault()
    if (pending.current || !totals) return
    pending.current = true; setBusy(true); setError('')
    try {
      if(quantity>1&&!participantsSaved){resumePayment.current=true;setParticipantsOpen(true);return}
      const holders=validateParticipants(event,quantity,buyer,participants,quantity===1?'same':participantMode,ageConfirmed);
      const order = reservedOrder.current || await placeOrder({ eventId: event.id, ticketId: ticket.id, quantity, buyer: {...buyer,participants:holders,participantMode:quantity===1?'same':participantMode,ageConfirmed,vipListId:params.get('vip')||null}, method, outcome, coupon, campaign: params.get('campaign') || '', source: params.get('ref') || params.get('utm_source') || 'direto', idempotencyKey: idempotencyKey.current })
      if (!isLocalDemo && totals.total > 0) { setReservedTotals(totals); reservedOrder.current = order; setHasReservation(true); setReservationId(order); return }
      navigate('/ingressos', { replace: true, state: { approved: true } })
    } catch (err) { setError(err.message) } finally { pending.current = false; setBusy(false) }
  }
  if(!currentUser)return <main className="auth-wrap"><section className="auth-card"><h1>Como você quer comprar?</h1><p>Continue sem senha ou use sua conta da Ingressos Experiences.</p>{error&&<p role="alert">{error}</p>}<button className="checkout-button" disabled={busy} onClick={async()=>{setBusy(true);try{await startGuest()}catch(err){setError(err.message)}finally{setBusy(false)}}}>Compra rápida sem conta</button><Link to={'/login?returnTo='+encodeURIComponent(window.location.pathname+window.location.search)}>Entrar / Criar conta</Link></section></main>
  if (!event?.published || event.archived || !ticket) return <div className="empty-page"><h1>Ingresso indisponível.</h1><Link to="/eventos">Ver eventos</Link></div>
  return <div className="checkout-page"><header className="simple-header"><Link to={getEventPublicPath(event)} className="event-back"><ArrowLeft size={18}/>Voltar</Link><Brand/><Link to={currentUser.guest?'/login?returnTo='+encodeURIComponent(window.location.pathname+window.location.search):'/eventos'}>{currentUser.guest?'Entrar / Criar conta':'Minha conta'}</Link></header><main className="checkout-wrap"><section><span className="section-kicker">CHECKOUT</span><h1>Finalize sua experiência.</h1><form ref={buyerForm} className="buyer-form" onSubmit={finish}><h3>Dados do comprador</h3><div className="form-grid">
    {Object.entries({ name: 'Nome (sobrenome opcional)', cpf: 'CPF', email: 'E-mail para receber os ingressos', phone: 'Telefone com DDD', birthDate: 'Data de nascimento' }).map(([field,label]) => <label key={field}>{label}<input required type={field === 'birthDate' ? 'date' : field === 'email' ? 'email' : field === 'phone' ? 'tel' : 'text'} max={field === 'birthDate' ? today : undefined} disabled={busy||hasReservation} readOnly={field === 'email' && !currentUser.guest} value={buyer[field]} onChange={e => {setBuyer({ ...buyer, [field]: e.target.value });setParticipantsSaved(false)}}/></label>)}
    <label>Quantidade<input type="number" disabled={busy||hasReservation} required min="1" max={Math.min(10, getRemaining(event,ticket))} value={quantity} onChange={e=>{setQuantity(Number(e.target.value));setParticipantsSaved(false)}}/></label><label>Cupom de desconto<input disabled={busy||hasReservation} value={coupon} onChange={e=>setCoupon(e.target.value.toUpperCase())}/></label></div>
    {quantity===1&&needsAgeConfirmation(event)&&<label className="check16"><input type="checkbox" required disabled={busy||hasReservation} checked={ageConfirmed} onChange={e=>setAgeConfirmed(e.target.checked)}/>Confirmo que tenho 18 anos ou mais.</label>}{quantity>1&&<button type="button" className="ghost-btn" disabled={busy||hasReservation} onClick={()=>setParticipantsOpen(true)}>{participantsSaved?'Revisar participantes':'Completar participantes'}</button>}{ticket.type === 'table' && <p>Uma unidade corresponde a uma mesa/camarote. O grupo entra junto usando um único QR Code.</p>}
    {!isLocalDemo&&totals?.total>0&&<div className="payment-options"><button type="button" disabled={hasReservation||busy} className={method==='pix'?'active':''} onClick={()=>setMethod('pix')}><QrCode/>Pix<span>QR Code e copia e cola</span></button><button type="button" disabled={!cardEnabled||hasReservation||busy} className={method==='card'?'active':''} onClick={()=>setMethod('card')}><CreditCard/>Cartão<span>{cardEnabled?'Checkout Mercado Pago':'Ainda indisponível'}</span></button></div>}{isLocalDemo ? <><h3>Forma de pagamento</h3><div className="payment-options"><button type="button" className={method==='pix'?'active':''} onClick={()=>setMethod('pix')}><QrCode/>PIX<span>Simulação</span></button><button type="button" className={method==='card'?'active':''} onClick={()=>setMethod('card')}><CreditCard/>Cartão<span>Simulação sem dados bancários</span></button></div><div className="demo-warning">Modo demonstração: nenhuma cobrança será realizada. Os ingressos são locais deste navegador.</div><label>Resultado da simulação<select value={outcome} onChange={e=>setOutcome(e.target.value)}><option value="approved">Aprovar pagamento</option><option value="declined">Recusar pagamento</option></select></label></> : <p className="demo-warning">Pague com Pix usando QR Code ou copia e cola. O ingresso é liberado após aprovação. {cardEnabled?' Cartão abre o Mercado Pago para pagamento único, sem assinatura.':' Cartão ainda indisponível.'}{totals?.feePayer==='organizer'?' A taxa da plataforma é absorvida pelo organizador.':' A taxa da plataforma aparece separadamente no total.'}</p>}
    {(error || quoteError) && <p role="alert" className="auth-error">{error || quoteError}</p>}<button className="checkout-button" disabled={hasReservation || busy || quoteBusy || !totals}>{busy ? 'Processando...' : isLocalDemo ? 'Confirmar compra simulada' : totals?.total>0 ? 'Continuar para pagamento' : 'Confirmar ingresso gratuito'}</button></form><dialog ref={participantsDialog} className="payment-popup participants-popup" aria-label="Completar participantes" onCancel={()=>{resumePayment.current=false;setParticipantsOpen(false)}}><button type="button" className="ghost-btn" onClick={()=>{resumePayment.current=false;setParticipantsOpen(false)}}>Fechar</button><Participants event={event} quantity={Math.max(1,Math.min(10,quantity||1))} buyer={buyer} participants={participants} setParticipants={setParticipants} mode={participantMode} setMode={setParticipantMode} confirmed={ageConfirmed} setConfirmed={setAgeConfirmed} saved={participantsSaved} setSaved={setParticipantsSaved} onError={setError} disabled={busy||hasReservation}/>{error&&<p role="alert" className="auth-error">{error}</p>}</dialog>{reservationId&&<InlinePayment key={reservationId} popup autoStart cardEnabled={cardEnabled} orderId={reservationId} initialMethod={method} onOrder={setReservedTotals} onConfirmed={paymentConfirmed}/>}</section><aside className="checkout-summary"><img src={event.image} alt={event.title}/><span>{event.category}</span><h2>{event.title}</h2><p>{ticket.name} • {ticket.batch} • {quantity}x</p>{totals && <>{[['Subtotal',totals.subtotal],['Desconto',-totals.discount],['Taxa',totals.fee],['Total',totals.total]].map(([label,value])=><div key={label}><span>{label}</span><strong>{brl(value)}</strong></div>)}</>}</aside></main></div>
}

