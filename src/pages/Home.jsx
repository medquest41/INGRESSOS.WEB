import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, ChevronRight, Clock3, MapPin, Menu, Search, ShieldCheck, Sparkles, Star, Ticket, UserRound, X } from 'lucide-react'
import Brand from '../components/Brand'
import { useEventStore } from '../store/EventStore'
import { useAuth } from '../store/AuthStore'
import { getEventPublicPath } from '../utils/eventSlug'

const categories = ['Todos', 'FESTA', 'RÉVEILLON', 'SUNSET', 'SHOW', 'FESTIVAL']
const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function Home({ catalog = false }) {
  const { events } = useEventStore()
  const { currentUser, isLocalDemo } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState('Todos')
  const [query, setQuery] = useState('')
  const published = events.filter((e) => e.published && !e.archived)
  const featured = published[0]
  const panelUser = currentUser && ['admin','organizador','financeiro','checkin'].includes(currentUser.role)
  const creatorPath = isLocalDemo || panelUser ? '/admin' : '/criar-evento'
  const creatorLabel = isLocalDemo ? 'Admin' : panelUser ? 'Meu painel' : 'Criar meu evento'

  const visibleEvents = published.filter((event) => {
    const categoryOk = activeCategory === 'Todos' || event.category === activeCategory
    const q = query.trim().toLowerCase()
    const queryOk = !q || `${event.title} ${event.location} ${event.category}`.toLowerCase().includes(q)
    return categoryOk && queryOk
  })

  function tilt(event) {
    const card = event.currentTarget
    const rect = card.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width
    const y = (event.clientY - rect.top) / rect.height
    card.style.setProperty('--rx', `${(0.5 - y) * 7}deg`)
    card.style.setProperty('--ry', `${(x - 0.5) * 7}deg`)
    card.style.setProperty('--mx', `${x * 100}%`)
    card.style.setProperty('--my', `${y * 100}%`)
  }
  function reset(event) {
    event.currentTarget.style.setProperty('--rx', '0deg')
    event.currentTarget.style.setProperty('--ry', '0deg')
  }

  if (!featured) return <div className="empty-page"><Brand /><h1>Nenhum evento publicado.</h1><Link to={creatorPath} className="primary-cta">{creatorLabel}</Link></div>

  return (
    <div className="app-shell">
      <header className="topbar">
        <Brand />
        <nav className="desktop-nav"><Link to="/eventos">Eventos</Link><a href="#experiencia">Experiência</a><Link to="/ingressos">Meus ingressos</Link></nav>
        <div className="topbar-actions">
          <Link className="login-button" to="/ingressos"><UserRound size={18}/>Minha conta</Link>
          <Link className="primary-small" to={creatorPath}>{creatorLabel} <ArrowRight size={17}/></Link>
          <button className="mobile-menu-button" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X/> : <Menu/>}</button>
        </div>
        {menuOpen && <div className="mobile-menu"><Link to="/eventos">Eventos</Link><Link to="/ingressos">Meus ingressos</Link><Link to={creatorPath}>{creatorLabel}</Link></div>}
      </header>

      <main>
        {!catalog && <section className="hero">
          <div className="hero-glow hero-glow-one"/><div className="hero-glow hero-glow-two"/>
          <div className="hero-grid">
            <div className="hero-content">
              <div className="eyebrow"><Sparkles size={15}/>EXPERIÊNCIAS QUE FICAM NA MEMÓRIA</div>
              <h1>Seu próximo <span>grande momento</span> começa aqui.</h1>
              <p className="hero-description">Descubra festas, shows e experiências únicas. Escolha seu ingresso, garanta seu lugar e viva cada momento.</p>
              <div className="hero-actions"><a href="#eventos" className="primary-cta">Explorar eventos <ArrowRight size={20}/></a><Link to="/ingressos" className="secondary-cta"><Ticket size={19}/>Meus ingressos</Link></div>
              <div className="hero-trust"><div className="trust-item"><ShieldCheck size={21}/><div><strong>Compra segura</strong><span>Ingresso digital protegido</span></div></div><div className="trust-divider"/><div className="trust-item"><Ticket size={21}/><div><strong>QR Code exclusivo</strong><span>Validação rápida na entrada</span></div></div></div>
            </div>

            <Link to={getEventPublicPath(featured)} className="featured-card" onMouseMove={tilt} onMouseLeave={reset}>
              <div className="featured-card-image"><img src={featured.image} alt={featured.title}/></div><div className="featured-overlay"/>
              <div className="featured-top"><span className="featured-pill"><Star size={13} fill="currentColor"/>DESTAQUE</span><span className="live-dot"><i/>{featured.salesStatus}</span></div>
              <div className="featured-bottom"><span className="featured-category">{featured.category}</span><h2>{featured.title}</h2>
                <div className="featured-meta"><span><CalendarDays size={16}/>{featured.shortDate}</span><span><Clock3 size={16}/>{featured.time}</span><span><MapPin size={16}/>{featured.location}</span></div>
                <div className="featured-price-row"><div><small>A partir de</small><strong>{brl(featured.price)}</strong></div><span className="featured-link">Ver evento <ChevronRight size={19}/></span></div>
              </div>
            </Link>
          </div>
          <div className="hero-stats"><div><strong>{published.length}+</strong><span>experiências</span></div><div><strong>100%</strong><span>digital</span></div><div><strong>QR</strong><span>validação segura</span></div><div><strong>24h</strong><span>acesso ao ingresso</span></div></div>
        </section>}

        <section className="discovery" id="eventos">
          <div className="section-heading"><div><span className="section-kicker">DESCUBRA</span><h2>Encontre seu próximo evento.</h2></div></div>
          <div className="search-panel"><div className="search-field"><Search size={20}/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Busque por evento, festa ou experiência..."/></div><button>Buscar eventos <ArrowRight size={18}/></button></div>
          <div className="category-list">{categories.map(c => <button key={c} className={activeCategory===c?'active':''} onClick={()=>setActiveCategory(c)}>{c}</button>)}</div>
          <div className="event-grid">{visibleEvents.map(event => <Link to={getEventPublicPath(event)} className="event-card" key={event.id} onMouseMove={tilt} onMouseLeave={reset}>
            <div className="event-image"><img src={event.image} alt={event.title}/><div className="image-darkener"/><span className="event-badge">{event.badge}</span><div className="event-date"><strong>{event.shortDate.split(' ')[0]}</strong><span>{event.shortDate.split(' ')[1]}</span></div></div>
            <div className="event-content"><span className="event-category">{event.category}</span><h3>{event.title}</h3><div className="event-details"><span><Clock3 size={15}/>{event.time}</span><span><MapPin size={15}/>{event.location}</span></div><div className="event-footer"><div><small>A partir de</small><strong>{brl(event.price)}</strong></div><span className="event-arrow"><ArrowRight size={20}/></span></div></div><div className="card-cursor-glow"/>
          </Link>)}</div>
        </section>

        <section className="experience-section" id="experiencia"><div className="experience-card"><div className="experience-copy"><span className="section-kicker">MAIS QUE UM INGRESSO</span><h2>Da compra até a entrada. Tudo simples.</h2><p>Escolha seu evento, compre seu ingresso e apresente o QR Code na entrada.</p><div className="steps"><div><span>01</span><strong>Escolha</strong><p>Encontre o evento perfeito.</p></div><div><span>02</span><strong>Compre</strong><p>Finalize com segurança.</p></div><div><span>03</span><strong>Viva</strong><p>Apresente o QR Code e aproveite.</p></div></div></div><div className="ticket-preview"><div className="ticket-preview-glow"/><div className="digital-ticket"><div className="ticket-header"><span>INGRESSO DIGITAL</span><Ticket size={22}/></div><div className="ticket-event-photo"><img src={featured.image} alt="Ingresso digital"/></div><h3>{featured.title}</h3><div className="ticket-info"><span>{featured.shortDate} • {featured.time}</span><span>PISTA PREMIUM</span></div><div className="fake-qr">{Array.from({length:9}).map((_,i)=><div key={i}/>)}</div><small>QR Code exclusivo • uso único</small></div></div></div></section>
      </main>
      <footer><Brand/><p>Experiências incríveis começam com o ingresso certo.</p><Link to={creatorPath}>{creatorLabel}</Link></footer>
    </div>
  )
}
