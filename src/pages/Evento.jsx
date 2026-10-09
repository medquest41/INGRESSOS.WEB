import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  MapPin,
  Minus,
  Plus,
  Share2,
  ShieldCheck,
  Sparkles,
  Ticket,
  Users,
} from 'lucide-react'
import Brand from '../components/Brand'
import Activity, {recordActivity} from '../components/Activity'
import VipPublic from '../components/VipPublic'
import { shareLink, whatsappUrl } from '../utils/experience'
import { loginPath } from '../utils/authReturn'
import { calculateFees } from '../utils/fees'
import AttractionList from '../components/AttractionList'
import { useEventStore } from '../store/EventStore'
import { getEventPublicPath, matchesEventRoute } from '../utils/eventSlug'
import { useAuth } from '../store/AuthStore'
import { canManage } from '../utils/commerce'

const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function Evento() {
  const routeParams = useParams()
  const eventKey = routeParams.eventKey ?? routeParams.id ?? routeParams.slug ?? ''
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { events, getRemaining, isLocalDemo } = useEventStore()
  const { currentUser, organizations=[] } = useAuth()

  const event = useMemo(
    () => events.find((item) => matchesEventRoute(item, eventKey)),
    [events, eventKey],
  )

  const [selectedTicket, setSelectedTicket] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [copied, setCopied] = useState(false)
  const preview = searchParams.get('preview') === '1' && canManage(currentUser, event)

  if (!event || ((!event.published || event.archived) && !preview)) {
    return (
      <div className="event-not-found">
        <Ticket size={42} />
        <h1>Evento não encontrado.</h1>
        <Link to="/eventos">Ver eventos disponíveis <ArrowRight size={18} /></Link>
      </div>
    )
  }

  const subtotal = selectedTicket ? selectedTicket.price * quantity : 0
  const { fee, total } = calculateFees(subtotal, 0, event.feeRate ?? 0.1, event.feePayer || 'buyer')

  function choose(ticket) {
    setSelectedTicket(ticket)
    setQuantity(1)
  }

  function checkout() {
    if (!selectedTicket) return
    const params = new URLSearchParams({ event: event.id, ticket: selectedTicket.id, q: String(quantity) })
    const source = searchParams.get('ref') || searchParams.get('utm_source')
    if (source) params.set('ref', source)
    if (searchParams.get('campaign')) params.set('campaign',searchParams.get('campaign'))
    
    recordActivity(event.id,'checkout');navigate(`/checkout?${params}`)
  }

  async function shareEvent() {
    const publicUrl = `${window.location.origin}${getEventPublicPath(event)}`
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      window.prompt('Copie o link do evento:', publicUrl)
    }
  }

  return (
    <div className="event-page">
      <header className="event-page-header">
        <Link to="/eventos" className="event-back"><ArrowLeft size={18} />Eventos</Link>
        <Brand />
        {(!currentUser || currentUser.guest) && <Link className="login-button" to={loginPath(getEventPublicPath(event) + (searchParams.size ? '?' + searchParams.toString() : ''))}>Entrar</Link>}
        <button className="event-share" onClick={shareEvent}><Share2 size={17} />{copied ? 'Link copiado' : 'Copiar link'}</button>
      </header>

      {preview && <div className="preview-banner">MODO DE VISUALIZAÇÃO DO ADMIN • ESTE EVENTO PODE NÃO ESTAR PUBLICADO</div>}

      <section className="event-hero">
        <div className="event-hero-image"><img src={event.image} alt={event.title} /></div>
        <div className="event-hero-overlay" />
        <div className="event-hero-glow" />
        <div className="event-hero-content">
          <div className="event-status"><i />{event.archived ? 'Arquivado' : event.salesStatus}</div>
          <span className="event-hero-category">{event.category}</span>
          <h1>{event.title}</h1>
          <div className="event-hero-info">
            <span><CalendarDays /><strong>{event.date}</strong></span>
            <span><Clock3 /><strong>{event.time}</strong></span>
            <span><MapPin /><strong>{event.location}</strong></span>
          </div>
          <a href="#ingressos" className="primary-cta">Comprar ingresso <ArrowRight size={19} /></a>
        </div>
      </section>

      <main className="event-main">
        <section className="event-information">
          <div className="event-about">
            <span className="section-kicker"><Sparkles size={14} />SOBRE O EVENTO</span>
            <h2>Uma experiência criada para ser lembrada.</h2>
            <p>{event.description}</p>
            <div className="event-highlights">
              {(event.highlights || []).map((highlight) => <div key={highlight}><Check size={16} />{highlight}</div>)}
            </div>
          </div>
          <aside className="event-location-card">
            <span className="location-icon"><MapPin /></span>
            <small>LOCAL DO EVENTO</small>
            <h3>{event.location}</h3>
            <p>{event.address}</p>
            <p>{event.city}</p>
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address + ' ' + event.city)}`} target="_blank" rel="noreferrer">Ver localização <ChevronRight size={18} /></a>
          </aside>
        </section>

        <section className="admin-panel"><h2>Esse rolê está ativo ✨</h2><Activity event={event} full/><p>Classificação: {event.ageRating||'Livre'}{event.requireDocument?' • Documento obrigatório na entrada':''}</p><p>{event.rules}</p><button className="primary-small" onClick={()=>{recordActivity(event.id,'share');shareLink(event.title,window.location.origin+getEventPublicPath(event))}}>Chamar amigos</button><Link className="ghost-btn" to={'/organizador/'+encodeURIComponent(event.organizerId)}>Mais deste organizador</Link>{(event.whatsapp||event.organizerWhatsapp||organizations.find(o=>o.id===event.organizerId)?.whatsapp)&&<a className="primary-small" href={whatsappUrl(event.whatsappMessage||'Oi! Tenho interesse no evento '+event.title+'. Pode me ajudar?',event.whatsapp||event.organizerWhatsapp||organizations.find(o=>o.id===event.organizerId)?.whatsapp)} target="_blank" rel="noreferrer">Falar no WhatsApp</a>}</section>
        <VipPublic event={event}/>
        <AttractionList value={event.attractions} allowDemo={isLocalDemo}/>

        <section className="ticket-section" id="ingressos">
          <div className="ticket-section-title">
            <div><span className="section-kicker">ESCOLHA SUA EXPERIÊNCIA</span><h2>Ingressos disponíveis.</h2></div>
            <div className="ticket-security"><ShieldCheck size={19} /><span>Compra segura<small>Ingresso digital protegido</small></span></div>
          </div>

          <div className="purchase-layout">
            <div className="ticket-options">
              {(event.ticketTypes || []).map((ticket) => {
                const selected = selectedTicket?.id === ticket.id
                return (
                  <button key={ticket.id} disabled={!getRemaining(event, ticket) || !event.published || event.archived} className={`ticket-option ${selected ? 'selected' : ''}`} onClick={() => choose(ticket)}>
                    <div className="ticket-option-main">
                      <div className="ticket-option-icon">{ticket.type === 'table' ? <Users /> : <Ticket />}</div>
                      <div><span>{ticket.batch}</span><h3>{ticket.name}</h3><p>{ticket.description}</p></div>
                    </div>
                    <div className="ticket-option-price"><small>A partir de</small><strong>{brl(ticket.price)}</strong><span>{getRemaining(event, ticket)} disponíveis</span></div>
                    <div className="ticket-selected-check"><Check size={17} /></div>
                  </button>
                )
              })}
            </div>

            <aside className={`purchase-summary ${selectedTicket ? 'active' : ''}`}>
              {!selectedTicket ? (
                <div className="empty-summary"><div><Ticket /></div><h3>Escolha seu ingresso</h3><p>Selecione uma opção ao lado para visualizar o resumo da sua compra.</p></div>
              ) : (
                <>
                  <div className="summary-header"><span>SEU PEDIDO</span><small>Reserva ainda não confirmada</small></div>
                  <div className="summary-event"><img src={event.image} alt={event.title} /><div><strong>{event.title}</strong><span>{event.date} • {event.time}</span></div></div>
                  <div className="summary-ticket"><div><small>INGRESSO</small><strong>{selectedTicket.name}</strong><span>{selectedTicket.batch}</span></div><strong>{brl(selectedTicket.price)}</strong></div>
                  {selectedTicket.type !== 'table' && (
                    <div className="quantity-row"><span>Quantidade</span><div className="quantity-control"><button onClick={() => setQuantity((q) => Math.max(1, q - 1))}><Minus size={16} /></button><strong>{quantity}</strong><button onClick={() => setQuantity((q) => Math.min(10, selectedTicket.available, q + 1))}><Plus size={16} /></button></div></div>
                  )}
                  <div className="summary-values"><div><span>Subtotal</span><strong>{brl(subtotal)}</strong></div><div><span>Taxa de serviço</span><strong>{brl(fee)}</strong></div></div>
                  <div className="summary-total"><span>Total</span><strong>{brl(total)}</strong></div>
                  <button className="checkout-button" onClick={checkout}>Continuar para checkout <ArrowRight size={19} /></button>
                  <div className="summary-security"><ShieldCheck size={16} />Ambiente seguro e ingresso protegido.</div>
                </>
              )}
            </aside>
          </div>
        </section>
      </main>

      <footer className="event-footer-page"><Brand /><Link to="/eventos">Ver todos os eventos</Link><span>© 2026 • Todos os direitos reservados</span></footer>
    </div>
  )
}
