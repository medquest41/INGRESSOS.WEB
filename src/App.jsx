import { useState } from 'react'
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Clock3,
  MapPin,
  Menu,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Ticket,
  UserRound,
  X,
} from 'lucide-react'
import './App.css'

const events = [
  {
    id: 1,
    title: 'Réveillon Exclusive 2027',
    category: 'RÉVEILLON',
    date: '31 DEZ',
    time: '22:00',
    location: 'Beach Club • Litoral',
    price: 'R$ 149,90',
    badge: 'MAIS PROCURADO',
    image:
      'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1400&q=85',
  },
  {
    id: 2,
    title: 'Sunset Experience',
    category: 'SUNSET',
    date: '12 DEZ',
    time: '17:00',
    location: 'Open Air • Centro',
    price: 'R$ 89,90',
    badge: '2º LOTE',
    image:
      'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1400&q=85',
  },
  {
    id: 3,
    title: 'Green Night',
    category: 'FESTA',
    date: '20 DEZ',
    time: '23:00',
    location: 'Club Garden • Premium',
    price: 'R$ 69,90',
    badge: 'ÚLTIMOS',
    image:
      'https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?auto=format&fit=crop&w=1400&q=85',
  },
]

const categories = [
  'Todos',
  'Festas',
  'Réveillon',
  'Shows',
  'Festivais',
  'Sunset',
  'Camarotes',
]

function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState('Todos')

  function handleTilt(event) {
    const card = event.currentTarget
    const rect = card.getBoundingClientRect()

    const x = (event.clientX - rect.left) / rect.width
    const y = (event.clientY - rect.top) / rect.height

    const rotateX = (0.5 - y) * 9
    const rotateY = (x - 0.5) * 9

    card.style.setProperty('--rx', `${rotateX}deg`)
    card.style.setProperty('--ry', `${rotateY}deg`)
    card.style.setProperty('--mx', `${x * 100}%`)
    card.style.setProperty('--my', `${y * 100}%`)
  }

  function resetTilt(event) {
    const card = event.currentTarget
    card.style.setProperty('--rx', '0deg')
    card.style.setProperty('--ry', '0deg')
    card.style.setProperty('--mx', '50%')
    card.style.setProperty('--my', '50%')
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a href="#" className="brand">
          <div className="brand-mark">
            <Ticket size={22} />
          </div>

          <div className="brand-copy">
            <strong>INGRESSOS</strong>
            <span>EXPERIENCES</span>
          </div>
        </a>

        <nav className="desktop-nav">
          <a href="#eventos">Eventos</a>
          <a href="#experiencia">Experiência</a>
          <a href="#seguranca">Segurança</a>
        </nav>

        <div className="topbar-actions">
          <button className="login-button">
            <UserRound size={18} />
            Entrar
          </button>

          <button className="primary-small">
            Criar conta
            <ArrowRight size={17} />
          </button>

          <button
            className="mobile-menu-button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Abrir menu"
          >
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {menuOpen && (
          <div className="mobile-menu">
            <a href="#eventos" onClick={() => setMenuOpen(false)}>
              Eventos
            </a>
            <a href="#experiencia" onClick={() => setMenuOpen(false)}>
              Experiência
            </a>
            <a href="#seguranca" onClick={() => setMenuOpen(false)}>
              Segurança
            </a>
            <button>Entrar</button>
          </div>
        )}
      </header>

      <main>
        <section className="hero">
          <div className="hero-glow hero-glow-one" />
          <div className="hero-glow hero-glow-two" />

          <div className="hero-grid">
            <div className="hero-content">
              <div className="eyebrow">
                <Sparkles size={15} />
                EXPERIÊNCIAS QUE FICAM NA MEMÓRIA
              </div>

              <h1>
                Seu próximo
                <span> grande momento </span>
                começa aqui.
              </h1>

              <p className="hero-description">
                Descubra festas, shows e experiências únicas. Escolha seu
                ingresso, garanta seu lugar e viva cada momento.
              </p>

              <div className="hero-actions">
                <a href="#eventos" className="primary-cta">
                  Explorar eventos
                  <ArrowRight size={20} />
                </a>

                <button className="secondary-cta">
                  <Ticket size={19} />
                  Meus ingressos
                </button>
              </div>

              <div className="hero-trust">
                <div className="trust-item">
                  <ShieldCheck size={21} />
                  <div>
                    <strong>Compra segura</strong>
                    <span>Ingresso digital protegido</span>
                  </div>
                </div>

                <div className="trust-divider" />

                <div className="trust-item">
                  <Ticket size={21} />
                  <div>
                    <strong>QR Code exclusivo</strong>
                    <span>Validação rápida na entrada</span>
                  </div>
                </div>
              </div>
            </div>

            <div
              className="featured-card"
              onMouseMove={handleTilt}
              onMouseLeave={resetTilt}
            >
              <div className="featured-card-image">
                <img
                  src="https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1600&q=90"
                  alt="Evento em destaque"
                />
              </div>

              <div className="featured-overlay" />

              <div className="featured-top">
                <span className="featured-pill">
                  <Star size={13} fill="currentColor" />
                  DESTAQUE
                </span>

                <span className="live-dot">
                  <i />
                  vendas abertas
                </span>
              </div>

              <div className="featured-bottom">
                <span className="featured-category">RÉVEILLON 2027</span>

                <h2>Uma noite para começar o ano inesquecível.</h2>

                <div className="featured-meta">
                  <span>
                    <CalendarDays size={16} />
                    31 Dez
                  </span>

                  <span>
                    <Clock3 size={16} />
                    22:00
                  </span>

                  <span>
                    <MapPin size={16} />
                    Beach Club
                  </span>
                </div>

                <div className="featured-price-row">
                  <div>
                    <small>A partir de</small>
                    <strong>R$ 149,90</strong>
                  </div>

                  <button>
                    Ver evento
                    <ChevronRight size={19} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="hero-stats">
            <div>
              <strong>+50</strong>
              <span>experiências</span>
            </div>

            <div>
              <strong>100%</strong>
              <span>digital</span>
            </div>

            <div>
              <strong>QR</strong>
              <span>validação segura</span>
            </div>

            <div>
              <strong>24h</strong>
              <span>acesso ao ingresso</span>
            </div>
          </div>
        </section>

        <section className="discovery" id="eventos">
          <div className="section-heading">
            <div>
              <span className="section-kicker">DESCUBRA</span>
              <h2>Encontre seu próximo evento.</h2>
            </div>

            <a href="#">
              Ver todos
              <ArrowRight size={18} />
            </a>
          </div>

          <div className="search-panel">
            <div className="search-field">
              <Search size={20} />
              <input
                type="text"
                placeholder="Busque por evento, festa ou experiência..."
              />
            </div>

            <button>
              Buscar eventos
              <ArrowRight size={18} />
            </button>
          </div>

          <div className="category-list">
            {categories.map((category) => (
              <button
                key={category}
                className={activeCategory === category ? 'active' : ''}
                onClick={() => setActiveCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="event-grid">
            {events.map((event) => (
              <article
                className="event-card"
                key={event.id}
                onMouseMove={handleTilt}
                onMouseLeave={resetTilt}
              >
                <div className="event-image">
                  <img src={event.image} alt={event.title} />

                  <div className="image-darkener" />

                  <span className="event-badge">{event.badge}</span>

                  <div className="event-date">
                    <strong>{event.date.split(' ')[0]}</strong>
                    <span>{event.date.split(' ')[1]}</span>
                  </div>
                </div>

                <div className="event-content">
                  <span className="event-category">{event.category}</span>

                  <h3>{event.title}</h3>

                  <div className="event-details">
                    <span>
                      <Clock3 size={15} />
                      {event.time}
                    </span>

                    <span>
                      <MapPin size={15} />
                      {event.location}
                    </span>
                  </div>

                  <div className="event-footer">
                    <div>
                      <small>A partir de</small>
                      <strong>{event.price}</strong>
                    </div>

                    <button aria-label={`Abrir ${event.title}`}>
                      <ArrowRight size={20} />
                    </button>
                  </div>
                </div>

                <div className="card-cursor-glow" />
              </article>
            ))}
          </div>
        </section>

        <section className="experience-section" id="experiencia">
          <div className="experience-card">
            <div className="experience-copy">
              <span className="section-kicker">MAIS QUE UM INGRESSO</span>

              <h2>Da compra até a entrada. Tudo simples.</h2>

              <p>
                Escolha seu evento, compre seu ingresso e apresente o QR Code
                na entrada. Sem complicação, papel ou filas desnecessárias.
              </p>

              <div className="steps">
                <div>
                  <span>01</span>
                  <strong>Escolha</strong>
                  <p>Encontre o evento perfeito para você.</p>
                </div>

                <div>
                  <span>02</span>
                  <strong>Compre</strong>
                  <p>Finalize seu ingresso de forma rápida e segura.</p>
                </div>

                <div>
                  <span>03</span>
                  <strong>Viva</strong>
                  <p>Apresente o QR Code e aproveite a experiência.</p>
                </div>
              </div>
            </div>

            <div className="ticket-preview">
              <div className="ticket-preview-glow" />

              <div className="digital-ticket">
                <div className="ticket-header">
                  <span>INGRESSO DIGITAL</span>
                  <Ticket size={22} />
                </div>

                <div className="ticket-event-photo">
                  <img
                    src="https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=900&q=85"
                    alt="Ingresso digital"
                  />
                </div>

                <h3>Réveillon Exclusive</h3>

                <div className="ticket-info">
                  <span>31 DEZ • 22:00</span>
                  <span>PISTA PREMIUM</span>
                </div>

                <div className="fake-qr">
                  <div />
                  <div />
                  <div />
                  <div />
                  <div />
                  <div />
                  <div />
                  <div />
                  <div />
                </div>

                <small>QR Code exclusivo • uso único</small>
              </div>
            </div>
          </div>
        </section>

        <section className="security-section" id="seguranca">
          <div className="security-icon">
            <ShieldCheck />
          </div>

          <span className="section-kicker">SEGURANÇA EM PRIMEIRO LUGAR</span>

          <h2>Seu ingresso. Seu acesso.</h2>

          <p>
            Cada ingresso possui identificação única e validação digital para
            ajudar a proteger sua experiência do início ao fim.
          </p>

          <button className="primary-cta">
            Conhecer a plataforma
            <ArrowRight size={19} />
          </button>
        </section>
      </main>

      <footer>
        <div className="footer-brand">
          <div className="brand-mark">
            <Ticket size={21} />
          </div>

          <div className="brand-copy">
            <strong>INGRESSOS</strong>
            <span>EXPERIENCES</span>
          </div>
        </div>

        <p>Experiências incríveis começam com o ingresso certo.</p>

        <span>© 2026 • Todos os direitos reservados</span>
      </footer>
    </div>
  )
}

export default App