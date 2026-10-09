import { useMemo, useState } from 'react'
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Archive,
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Files,
  LayoutDashboard,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  ScanLine,
  ShieldCheck,
  Ticket,
  Trash2,
  UserCog,
  XCircle,
} from 'lucide-react'
import Brand from '../components/Brand'
import ExperienceEditor from '../components/ExperienceEditor'
import VipPanel from '../components/VipPanel'
import EventAdminContext from '../components/EventAdminContext'
import EventOrderList from '../components/EventOrderList'
import { matchesBuyerSearch } from '../utils/buyerSearch'
import AdminOperations from '../components/AdminOperations'
import AdminAccounts from '../components/AdminAccounts'
import AdminCustomersByEvent from '../components/AdminCustomersByEvent'
import CameraScanner from '../components/CameraScanner'
import OrganizationManager from '../components/OrganizationManager'
import EventOrganizerField from '../components/EventOrganizerField'
import EventFeeSettings from '../components/EventFeeSettings'
import TicketBatchEditor from '../components/TicketBatchEditor'
import EventImageField from '../components/EventImageField'
import AttractionEditor from '../components/AttractionEditor'
import { normalizeAttractions, prepareAttractions } from '../utils/attractions'
import LocalDataImport from '../components/LocalDataImport'
import { approved } from '../utils/commerce'
import { useEventStore } from '../store/EventStore'
import { PRIMARY_ADMIN_EMAIL, useAuth } from '../store/AuthStore'
import { getEventPublicPath, slugifyEventTitle } from '../utils/eventSlug'

function blankEvent(user) {
  return {
    id: String(Date.now()),
    slug: '',
    published: false,
    archived: false,
    organizerId: user?.role === 'organizador' ? user.organizerId : 'org-main',
    organizerName: user?.role === 'organizador' ? user.organizerName : 'Organização principal',
    title: '',
    category: 'FESTA',
    shortDate: '01 JAN',
    date: '1 de janeiro de 2027',
    time: '22:00',
    location: '',
    address: '',
    city: '',
    price: 0,
    badge: 'NOVO',
    salesStatus: 'Vendas abertas',
    image: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1800&q=90',
    description: '',
    attractions: [],
    highlights: ['Estrutura premium'],
    feeRate: 0.1,
    feeEditableByOrganizer: false,
    ticketTypes: [
      {
        id: `ing-${Date.now()}`,
        name: 'Pista',
        batch: '1º lote',
        description: 'Acesso ao evento.',
        price: 0,
        available: 100,
        type: 'individual',
      },
    ],
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function brl(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatCpf(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length !== 11) return value || ''
  return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`
}

export default function Admin() {
  const { events, orders, saveEvent, deleteEvent, cancelOrder, markTicketUsed, getRemaining, summary = [], checkins = [] } = useEventStore()
  const {
    currentUser,
    users,
    roleLabels,
    logout,
    isLocalDemo, organizations = [],
  } = useAuth()

  const role = currentUser.role
  const canManageEvents = ['admin', 'organizador'].includes(role)
  const canSeeOrders = ['admin', 'organizador', 'financeiro'].includes(role)
  const canCheckin = ['admin', 'organizador', 'checkin'].includes(role)
  const isPrimaryAdmin = role === 'admin' && String(currentUser.email || '').toLowerCase() === PRIMARY_ADMIN_EMAIL
  const canManageTeam = isPrimaryAdmin
  const defaultTab = role === 'checkin' ? 'checkin' : role === 'financeiro' ? 'orders' : 'dashboard'

  const [orderSearch,setOrderSearch]=useState('')
  const [orderStatus,setOrderStatus]=useState('')
  const { eventKey, section } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const eventId = eventKey || searchParams.get('event') || ''
  const requestedTab = eventKey ? section : searchParams.get('tab')
  const tab = ['dashboard','events','orders','checkin','team','customers','finance','reports','history','coupons','fees'].includes(requestedTab) ? requestedTab : defaultTab
  function setTab(next) {
    if (eventKey && next !== 'team') navigate('/admin/evento/' + encodeURIComponent(eventKey) + '/' + next)
    else setSearchParams(previous => { const params = new URLSearchParams(previous);params.set('tab',next);return params })
    if (eventKey && next === 'team') navigate('/admin?tab=team')
  }
  function selectEvent(id) {
    setSearchParams(previous => { const params=new URLSearchParams(previous);if(id)params.set('event',id);else params.delete('event');return params })
    setScanResult(null)
  }
  const [editing, setEditing] = useState(null)
  const [uploadingHero, setUploadingImage] = useState(false)
  const [uploadingAttractions, setUploadingAttractions] = useState(false)
  const uploadingImage = uploadingHero || uploadingAttractions
  const [scan, setScan] = useState('')
  const [scanFeedback, setScanFeedback] = useState(null)
  const scanResult = scanFeedback?.eventId === eventId ? scanFeedback.status : null
  function setScanResult(status) { setScanFeedback(status ? { eventId, status } : null) }
  const [copiedId, setCopiedId] = useState(null)

  const organizerOptions = useMemo(() => {
    const map = new Map()
    if(isLocalDemo) map.set('org-main', 'Organização principal')
    organizations.forEach(org=>map.set(org.id,org.name))
    users.forEach((user) => {
      if (user.organizerId) map.set(user.organizerId, user.organizerName || user.name)
    })
    events.forEach((event) => {
      if (event.organizerId) map.set(event.organizerId, event.organizerName || 'Organizador')
    })
    return Array.from(map, ([id, name]) => ({ id, name }))
  }, [users, events, organizations, isLocalDemo])

  const availableEvents = useMemo(() => {
    if (role === 'admin') return events
    if (role === 'checkin' && !isLocalDemo) return events.filter(event => summary.some(item => item.event_id === event.id))
    return events.filter(event => event.organizerId === currentUser.organizerId)
  }, [events, role, currentUser.organizerId, isLocalDemo, summary])
  const selectedEvent = availableEvents.find(event => String(event.id) === eventId)
  const visibleEvents = useMemo(() => availableEvents.filter(event => !eventId || String(event.id) === eventId), [availableEvents,eventId])
  const scopedSummary = summary.filter(item => !eventId || String(item.event_id) === eventId)
  const scopedCheckins = checkins.filter(item => !eventId || String(item.event_id) === eventId)

  const visibleEventIds = useMemo(
    () => new Set(visibleEvents.map((event) => String(event.id))),
    [visibleEvents],
  )

  const visibleOrders = useMemo(() => {
    return orders.filter(order => visibleEventIds.has(String(order.eventId)))
  }, [orders, visibleEventIds])

  const revenue = useMemo(() => visibleOrders.filter(approved).reduce((sum, order) => sum + Number(order.total || 0), 0), [visibleOrders])
  const sold = useMemo(() => visibleOrders.filter(approved).reduce((sum, order) => sum + Number(order.quantity || 0), 0), [visibleOrders])
  const activeEvents = useMemo(() => visibleEvents.filter((event) => !event.archived), [visibleEvents])

  function goTab(next) {
    setTab(next)
    setEditing(null)
    setScanResult(null)
  }

  function startNew() {
    if (!canManageEvents) return
    setEditing(blankEvent(currentUser))
    if (eventKey) navigate('/admin?tab=events')
    else setTab('events')
  }

  function editEvent(event) {
    if (!canManageEvents) return
    setEditing(clone(event))
    setTab('events')
    window.scrollTo({ top: 0, behavior: 'auto' })
  }

  function showEventManagement() {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }

  function updateTicket(index, field, value) {
    setEditing({
      ...editing,
      ticketTypes: editing.ticketTypes.map((ticket, itemIndex) =>
        itemIndex === index
          ? { ...ticket, [field]: ['price', 'available'].includes(field) ? Number(value) : value }
          : ticket,
      ),
    })
  }

  function addTicket() {
    setEditing({
      ...editing,
      ticketTypes: [
        ...editing.ticketTypes,
        {
          id: `ing-${Date.now()}`,
          name: 'Novo ingresso',
          batch: '1º lote',
          description: '',
          price: 0,
          available: 100,
          type: 'individual',
        },
      ],
    })
  }

  function removeTicket(index) {
    setEditing({ ...editing, ticketTypes: editing.ticketTypes.filter((_, itemIndex) => itemIndex !== index) })
  }

  async function save() {
    if (!canManageEvents || !editing || uploadingImage) return
    if (!isLocalDemo && role === 'admin' && (!editing.organizerId || editing.organizerId === 'org-main')) {
      window.alert('Selecione ou cadastre um organizador antes de salvar o evento.')
      return
    }

    const minimumPrice = editing.ticketTypes.length
      ? Math.min(...editing.ticketTypes.map((ticket) => Number(ticket.price) || 0))
      : 0

    const enforcedOrganizer = role === 'organizador'
      ? { organizerId: currentUser.organizerId, organizerName: currentUser.organizerName }
      : {}

    try { await saveEvent({
      ...editing,
      ...enforcedOrganizer,
      slug: editing.slug?.trim() || slugifyEventTitle(editing.title),
      archived: Boolean(editing.archived),
      attractions: prepareAttractions(editing.attractions, isLocalDemo),
      price: minimumPrice,
    })
    setEditing(null) } catch (err) { window.alert(err.message) }
  }

  async function duplicateEvent(event) {
    if (!canManageEvents) return
    const id = String(Date.now())
    const duplicated = clone(event)
    duplicated.id = id
    delete duplicated.legacyId
    duplicated.title = `${event.title} - Cópia`
    duplicated.slug = `${slugifyEventTitle(event.title)}-copia-${id.slice(-4)}`
    duplicated.published = false
    duplicated.archived = false
    duplicated.badge = 'CÓPIA'
    duplicated.ticketTypes = (duplicated.ticketTypes || []).map((ticket, index) => ({
      ...ticket,
      id: `${ticket.id || 'ing'}-${id}-${index}`, legacyId: undefined,
    }))
    try { await saveEvent(duplicated); setEditing(isLocalDemo?duplicated:null) } catch (err) { window.alert(err.message) }
  }

  async function togglePublished(event) {
    if (!canManageEvents) return
    try { await saveEvent({ ...event, published: !event.published, archived: false }) } catch (err) { window.alert(err.message) }
  }

  async function archiveEvent(event) {
    if (!canManageEvents) return
    try { await saveEvent({ ...event, published: false, archived: true }) } catch (err) { window.alert(err.message) }
  }

  async function restoreEvent(event) {
    if (!canManageEvents) return
    try { await saveEvent({ ...event, archived: false }) } catch (err) { window.alert(err.message) }
  }

  async function removeEventPermanently(event) {
    if (!canManageEvents || !deleteEvent) return
    const typed = window.prompt(`Para excluir "${event.title}", digite exatamente o nome do evento.\n\nEventos com pedidos ou histórico de vendas não serão apagados; o sistema vai bloquear a exclusão.`)
    if (typed !== event.title) return
    try {
      await deleteEvent(event.id)
      if (String(event.id) === String(eventId)) navigate('/admin?tab=events')
    } catch (err) { window.alert(err.message) }
  }

  async function copyPublicLink(event) {
    const url = `${window.location.origin}${getEventPublicPath(event)}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(event.id)
      window.setTimeout(() => setCopiedId(null), 1800)
    } catch {
      window.prompt('Copie o link público do evento:', url)
    }
  }

  async function doScan(code = scan) {
    if (!canCheckin) return
    try {
      if (!selectedEvent) { window.alert('Selecione o evento antes de validar ingressos.');return }
      const result = await markTicketUsed(String(code).trim(), selectedEvent.id)
      const status = result.wrongEvent ? 'wrong_event' : result.forbidden ? 'forbidden' : !result.found ? 'invalid' : result.cancelled ? 'cancelled' : result.alreadyUsed ? 'used' : 'valid'
      setScanFeedback({ eventId, status, ...result })
    } catch (err) { window.alert(err.message) }
  }

  function eventStatus(event) {
    if (event.archived) return { label: 'Arquivado', className: 'status-archived' }
    if (event.published) return { label: 'Publicado', className: 'status-on' }
    return { label: 'Oculto', className: 'status-off' }
  }


  if (eventKey && !selectedEvent) return <main className="empty-page"><h1>Evento não disponível</h1><p>Este evento não existe ou não está autorizado para sua conta.</p><Link to="/admin?tab=events">Voltar ao painel</Link></main>
  return (
    <div className="admin-page">
      <aside className="admin-sidebar">
        <Brand compact />

        <div className="admin-user-mini">
          <div>{currentUser.name.slice(0, 1).toUpperCase()}</div>
          <span><strong>{currentUser.name}</strong><small>{roleLabels[role]}</small></span>
        </div>

        <nav>
          {role !== 'checkin' && <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => goTab('dashboard')}><LayoutDashboard />Dashboard</button>}
          {canManageEvents && <button className={tab === 'events' ? 'active' : ''} onClick={() => goTab('events')}><CalendarDays />Eventos</button>}
          {canSeeOrders && <button className={tab === 'orders' ? 'active' : ''} onClick={() => goTab('orders')}><Ticket />Pedidos</button>}
          {canCheckin && <button className={tab === 'checkin' ? 'active' : ''} onClick={() => goTab('checkin')}><ScanLine />Check-in</button>}
          {canManageTeam && <button className={tab === 'team' ? 'active' : ''} onClick={() => goTab('team')}><UserCog />Contas</button>}
          {canSeeOrders && (role==='financeiro'?['finance','reports','history']:['customers','finance','reports','history']).map(key=><button key={key} className={tab===key?'active':''} onClick={()=>goTab(key)}><LayoutDashboard/>{{customers:'Clientes',finance:'Financeiro',reports:'Relatórios',history:'Histórico'}[key]}</button>)}
          {canManageEvents && <button className={tab==='coupons'?'active':''} onClick={()=>goTab('coupons')}><Ticket/>Cupons</button>}
        </nav>

        <div className="admin-sidebar-bottom">
          <Link to="/" className="admin-back"><ArrowLeft />Ver site</Link>
          <button className="admin-logout" onClick={logout}><LogOut />Sair</button>
        </div>
      </aside>

      <main className="admin-main">
        {!editing && tab !== 'team' && <EventAdminContext event={selectedEvent} eventId={eventId} events={availableEvents} eventPage={Boolean(eventKey)} tab={tab} role={role} canManageFees={isPrimaryAdmin} onSelect={selectEvent} onEdit={()=>editEvent(selectedEvent)}/>}
        {isLocalDemo && <p className="demo-warning">Demonstração local — login, vendas e check-in neste navegador. Pagamentos simulados.</p>}
        {tab==='customers' && isPrimaryAdmin && !eventId
          ? <AdminCustomersByEvent events={availableEvents} orders={orders} />
          : ((canSeeOrders && ['customers','finance','reports','history'].includes(tab)) || (canManageEvents && tab==='coupons')) && <AdminOperations key={eventId + ':' + tab} tab={tab} eventId={eventId}/>}
        {tab === 'dashboard' && role !== 'checkin' && (
          <>
            <div className="admin-title">
              <div>
                <span className="section-kicker">{role === 'organizador' ? 'PAINEL DO ORGANIZADOR' : role === 'financeiro' ? 'PAINEL FINANCEIRO' : 'PAINEL ADMINISTRATIVO'}</span>
                <h1>{eventId ? 'Sobre o evento.' : 'Visão geral.'}</h1>
                {role === 'organizador' && <p className="admin-context-line"><Building2 size={14} />{currentUser.organizerName}</p>}
              </div>
              {canManageEvents && <button onClick={startNew} className="primary-small"><Plus />Novo evento</button>}
            </div>

            <div className="admin-stats">
              <div><span>Eventos ativos</span><strong>{activeEvents.length}</strong></div>
              <div><span>Pedidos</span><strong>{visibleOrders.length}</strong></div>
              <div><span>Ingressos vendidos</span><strong>{sold}</strong></div>
              <div><span>{isLocalDemo?'Faturamento demo':'Vendas confirmadas'}</span><strong>{brl(revenue)}</strong></div>
            </div>

            <section className="admin-panel">
              <h2>{eventId ? 'Informações do evento' : 'Eventos recentes'}</h2>
              {visibleEvents.slice(0, 5).map((event) => {
                const status = eventStatus(event)
                return (
                  <div className="admin-row" key={event.id}>
                    <img src={event.image} alt="" />
                    <div><strong>{event.title}</strong><span>{event.date} • {event.location}</span></div>
                    <span className={status.className}>{status.label}</span>
                    {canManageEvents && selectedEvent?.id === event.id
                      ? <button className="ghost-btn admin-event-management-link" onClick={() => editEvent(event)}>Editar evento</button>
                      : selectedEvent?.id !== event.id && <Link className="admin-event-management-link" onClick={showEventManagement} to={'/admin/evento/'+encodeURIComponent(event.id)+'/dashboard'}>Gerenciar evento</Link>}
                  </div>
                )
              })}
              {visibleEvents.length === 0 && <p className="muted">Nenhum evento disponível para este acesso.</p>}
            </section>
            {selectedEvent && <section className="admin-panel" aria-label="Dados deste evento">
              <h2>Sobre {selectedEvent.title}</h2>
              <p>{selectedEvent.description}</p>
              <p>{selectedEvent.date} • {selectedEvent.time} • {selectedEvent.location}</p>
              <p>{selectedEvent.address} • {selectedEvent.city}</p>
              {(canManageEvents||canCheckin)&&<VipPanel key={selectedEvent.id} event={selectedEvent}/>}<h3>Atrações deste evento</h3>
              {normalizeAttractions(selectedEvent.attractions).length ? <ul>{normalizeAttractions(selectedEvent.attractions).map(item => <li key={item.id}>{item.name} • {item.startTime || 'Horário a definir'}{!item.visible && ' • Oculta no site'}</li>)}</ul> : <p className="muted">Nenhuma atração cadastrada. Use Editar este evento para adicionar.</p>}
              <h3>Ingressos e lotes deste evento</h3>
              {(selectedEvent.ticketTypes || []).map(ticket=><div className="order-row" key={ticket.id}><div><strong>{ticket.name} • {ticket.batch}</strong><span>{ticket.sector || ticket.name} • {ticket.active===false?'Inativo':'Ativo'}</span></div><div><strong>{brl(ticket.price)}</strong><span>{getRemaining(selectedEvent,ticket)} disponível(is) de {ticket.available}</span></div></div>)}
              <Link className="ghost-btn" to={getEventPublicPath(selectedEvent)+'?preview=1'} target="_blank">Ver página do evento</Link>
            </section>}
          </>
        )}

        {tab === 'events' && canManageEvents && !editing && (
          <>
            <div className="admin-title">
              <div><span className="section-kicker">GERENCIAMENTO</span><h1>Eventos.</h1></div>
              <div className="admin-actions">
                <button onClick={startNew} className="primary-small"><Plus />Novo evento</button>
              </div>
            </div>

            <div className="admin-event-list">
              {visibleEvents.map((event) => {
                const status = eventStatus(event)
                const publicPath = getEventPublicPath(event)
                return (
                  <article key={event.id} className={event.archived ? 'admin-event-archived' : ''}>
                    <img src={event.image} alt="" />
                    <div className="admin-event-copy">
                      <span>{event.category}</span>
                      <h3>{event.title}</h3>
                      <p>{event.date} • {event.location}</p>
                      <small className="admin-organizer-name">{event.organizerName || 'Organização principal'}</small>
                      <small className="admin-public-path">{publicPath}</small>
                      <span className={status.className}>{status.label}</span>
                    </div>
                    <div className="event-admin-actions event-admin-actions-rich">
                      <Link className="admin-event-management-link" onClick={showEventManagement} to={'/admin/evento/'+encodeURIComponent(event.id)+'/dashboard'}>Gerenciar evento</Link>
                      <a className="admin-action-button" href={`${window.location.origin}${publicPath}?preview=1`} target="_blank" rel="noreferrer"><Eye size={16} />Visualizar</a>
                      <button className="admin-action-button" onClick={() => copyPublicLink(event)}><Copy size={16} />{copiedId === event.id ? 'Copiado!' : 'Copiar link'}</button>
                      <button className="admin-action-button" onClick={() => editEvent(event)}><Pencil size={16} />Editar</button>
                      <button className="admin-action-button" onClick={() => duplicateEvent(event)}><Files size={16} />Duplicar</button>
                      {!event.archived && <button className="admin-action-button" onClick={() => togglePublished(event)}>{event.published ? <EyeOff size={16} /> : <Eye size={16} />}{event.published ? 'Ocultar' : 'Mostrar'}</button>}
                      {!event.archived ? (
                        <button className="admin-action-button archive-action" onClick={() => archiveEvent(event)}><Archive size={16} />Arquivar</button>
                      ) : (
                        <button className="admin-action-button" onClick={() => restoreEvent(event)}><RefreshCw size={16} />Restaurar</button>
                      )}
                      <button className="admin-action-button danger" onClick={() => removeEventPermanently(event)}><Trash2 size={16} />Excluir evento</button>
                    </div>
                  </article>
                )
              })}
            </div>
          </>
        )}

        {tab === 'events' && canManageEvents && editing && (
          <>
            <div className="admin-title">
              <div><span className="section-kicker">EDITOR DE EVENTO</span><h1>{editing.title || 'Novo evento'}</h1></div>
              <div className="admin-actions"><button className="ghost-btn" disabled={uploadingImage} onClick={() => setEditing(null)}>Cancelar</button><button className="primary-small" disabled={uploadingImage} onClick={save}><Save />{uploadingImage ? 'Enviando imagem...' : 'Salvar'}</button></div>
            </div>

            <div className="event-editor">
              <section>
                <h3>Informações principais</h3>
                <div className="form-grid">
                  <label>Nome<input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></label>
                  <label>Categoria<input value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} /></label>
                  {role === 'admin' && (
                    <EventOrganizerField value={editing.organizerId} options={organizerOptions} onChange={organization => setEditing(event => ({ ...event, organizerId: organization.id, organizerName: organization.name }))} />
                  )}
                  <label className="full">Slug / link público<input value={editing.slug || ''} onChange={(e) => setEditing({ ...editing, slug: slugifyEventTitle(e.target.value) })} placeholder={slugifyEventTitle(editing.title) || 'nome-do-evento'} /></label>
                  <label>Data curta<input value={editing.shortDate} onChange={(e) => setEditing({ ...editing, shortDate: e.target.value })} /></label>
                  <label>Data completa<input value={editing.date} onChange={(e) => setEditing({ ...editing, date: e.target.value })} /></label>
                  <label>Horário<input value={editing.time} onChange={(e) => setEditing({ ...editing, time: e.target.value })} /></label>
                  <label>Local<input value={editing.location} onChange={(e) => setEditing({ ...editing, location: e.target.value })} /></label>
                  <label>Endereço<input value={editing.address} onChange={(e) => setEditing({ ...editing, address: e.target.value })} /></label>
                  <label>Cidade/UF<input value={editing.city} onChange={(e) => setEditing({ ...editing, city: e.target.value })} /></label>
                  <label>Badge<input value={editing.badge} onChange={(e) => setEditing({ ...editing, badge: e.target.value })} /></label>
                  <label>Status de venda<input value={editing.salesStatus} onChange={(e) => setEditing({ ...editing, salesStatus: e.target.value })} /></label>
                  <EventImageField value={editing.image} organizationId={role === 'organizador' ? currentUser.organizerId : editing.organizerId} onChange={image => setEditing(event => event ? { ...event, image } : event)} onBusyChange={setUploadingImage} />
                  <label className="full">Descrição<textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></label>
                  <label className="check-label"><input type="checkbox" checked={Boolean(editing.published)} onChange={(e) => setEditing({ ...editing, published: e.target.checked, archived: false })} /> Publicado no site</label>
                </div>
              </section>

              <ExperienceEditor event={editing} onChange={setEditing} isPrimaryAdmin={isPrimaryAdmin}/>
              <AttractionEditor value={editing.attractions} organizationId={role === 'organizador' ? currentUser.organizerId : editing.organizerId} onChange={attractions => setEditing(event => ({ ...event, attractions }))} onBusyChange={setUploadingAttractions}/>

              <section>
                <div className="editor-section-head"><h3>Ingressos e preços</h3><button type="button" className="ghost-btn" onClick={addTicket}><Plus />Adicionar tipo de ingresso</button></div>
                <p className="ticket-editor-explanation">Cada cartão é um tipo ou lote de ingresso, como Pista e VIP. Para oferecer 100 ingressos de Pista, use um cartão com quantidade 100. Adicione outro cartão somente para outro tipo ou lote.</p>
                {editing.ticketTypes.map((ticket, index) => (
                  <TicketBatchEditor key={ticket.id} ticket={ticket} index={index} isLocalDemo={isLocalDemo} onChange={(field, value) => updateTicket(index, field, value)} onRemove={() => removeTicket(index)} />
                ))}
                <div className="ticket-section-save"><button type="button" className="primary-small" disabled={uploadingImage} onClick={save}><Save size={17}/>{uploadingImage ? 'Aguarde...' : 'Salvar ingressos e preços'}</button><small>Salva o evento com os ingressos, lotes e preços atuais.</small></div>
              </section>
            </div>
          </>
        )}

        {tab === 'fees' && selectedEvent && (isPrimaryAdmin || (role === 'organizador' && selectedEvent.feeEditableByOrganizer)) && (
          <EventFeeSettings event={selectedEvent} role={role} isPrimaryAdmin={isPrimaryAdmin} saveEvent={saveEvent} />
        )}

        {tab === 'orders' && canSeeOrders && (
          <>
            <div className="admin-title"><div><span className="section-kicker">VENDAS</span><h1>{selectedEvent ? 'Pedidos deste evento.' : 'Pedidos.'}</h1></div></div>
            <section className="admin-panel">
              <div className="form-grid"><label>Buscar pedido<input value={orderSearch} onChange={e=>setOrderSearch(e.target.value)} placeholder="Pedido, evento, nome, e-mail ou CPF"/></label><label>Status do pedido<select value={orderStatus} onChange={e=>setOrderStatus(e.target.value)}><option value="">Todos</option><option value="pending">Pendente</option><option value="approved">Aprovado</option><option value="cancelled">Cancelado</option><option value="refunded">Estornado</option></select></label></div>
              <EventOrderList key={eventId + ':' + orderStatus + ':' + orderSearch} eventId={eventId} events={visibleEvents} orders={visibleOrders.filter(o=>(!orderStatus||(o.status||'approved')===orderStatus)&&matchesBuyerSearch(o,orderSearch))} cancelOrder={cancelOrder} canViewCpf={['admin','organizador'].includes(role)}/>
            </section>
          </>
        )}

        {tab === 'checkin' && canCheckin && (
          <>
            <div className="admin-title"><div><span className="section-kicker">PORTARIA</span><h1>Check-in do evento.</h1></div></div>
            <section className="checkin-panel">
              {!isLocalDemo && <><div>{scopedSummary.map(s=><p key={s.event_id}>{events.find(e=>e.id===s.event_id)?.title}: {s.checked_in} / {s.issued} entradas</p>)}</div><details><summary>Histórico recente</summary>{scopedCheckins.map(c=><p key={c.id}>{new Date(c.created_at).toLocaleString('pt-BR')} • operador {c.operator_id}</p>)}</details></>}
              <ScanLine /><h2>Digite ou escaneie o código</h2>
              <p className="muted">Este acesso valida apenas ingressos dos eventos permitidos para este perfil.</p>
              {selectedEvent ? <CameraScanner onScan={code=>{setScan(code); doScan(code)}}/> : <p>Selecione um evento no filtro acima para abrir a portaria.</p>}<div className="checkin-form"><input value={scan} onChange={(e) => setScan(e.target.value)} placeholder="ING-..." /><button className="primary-small" disabled={!selectedEvent} onClick={() => doScan()}>Validar</button></div>
              {scanResult && <>
                <div className={`scan-result ${scanResult}`}>
                  {scanResult === 'wrong_event' ? <><XCircle />INGRESSO DE OUTRO EVENTO — ENTRADA NÃO REGISTRADA</> : scanResult === 'valid' ? <><CheckCircle2 />INGRESSO VÁLIDO — ENTRADA REGISTRADA</> : scanResult === 'used' ? <><XCircle />JÁ UTILIZADO</> : scanResult === 'cancelled' ? <><XCircle />CANCELADO / PAGAMENTO NÃO CONFIRMADO</> : scanResult === 'forbidden' ? <><ShieldCheck />SEM PERMISSÃO PARA ESTE EVENTO</> : <><XCircle />INVÁLIDO</>}
                </div>
                {scanFeedback?.holderName && ['valid','used','cancelled'].includes(scanResult) && <div className="checkin-ticket-details">
                  <strong>{scanFeedback.holderName}</strong>
                  {scanFeedback.holderCpf && <span>CPF {formatCpf(scanFeedback.holderCpf)}</span>}
                  <span>{[scanFeedback.ticketName,scanFeedback.batch].filter(Boolean).join(' • ')}</span>
                  {scanFeedback.orderId && <small>Pedido {scanFeedback.orderId}</small>}
                </div>}
              </>}
            </section>
          </>
        )}

        {tab === 'team' && canManageTeam && (
          <>
            <AdminAccounts />
            {!isLocalDemo && <details className="admin-panel admin-advanced-tools"><summary>Organizações e ferramentas avançadas</summary><OrganizationManager/><LocalDataImport/></details>}
          </>
        )}
      </main>
    </div>
  )
}
