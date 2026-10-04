import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
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
  UserPlus,
  XCircle,
} from 'lucide-react'
import Brand from '../components/Brand'
import AdminOperations from '../components/AdminOperations'
import CameraScanner from '../components/CameraScanner'
import OrganizationManager from '../components/OrganizationManager'
import LocalDataImport from '../components/LocalDataImport'
import { approved } from '../utils/commerce'
import { useEventStore } from '../store/EventStore'
import { useAuth } from '../store/AuthStore'
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
    attractions: ['Atração principal'],
    highlights: ['Estrutura premium'],
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

export default function Admin() {
  const { events, orders, saveEvent, cancelOrder, markTicketUsed, summary = [], checkins = [] } = useEventStore()
  const {
    currentUser,
    users,
    roleLabels,
    logout,
    isLocalDemo, organizations = [],
    createUser,
    toggleUserActive,
    changeUserPassword,
    updateUserProfile,
  } = useAuth()

  const role = currentUser.role
  const canManageEvents = ['admin', 'organizador'].includes(role)
  const canSeeOrders = ['admin', 'organizador', 'financeiro'].includes(role)
  const canCheckin = ['admin', 'organizador', 'checkin'].includes(role)
  const canManageTeam = role === 'admin'
  const defaultTab = role === 'checkin' ? 'checkin' : role === 'financeiro' ? 'orders' : 'dashboard'

  const [orderSearch,setOrderSearch]=useState('')
  const [orderStatus,setOrderStatus]=useState('')
  const [tab, setTab] = useState(defaultTab)
  const [editing, setEditing] = useState(null)
  const [scan, setScan] = useState('')
  const [scanResult, setScanResult] = useState(null)
  const [copiedId, setCopiedId] = useState(null)
  const [teamError, setTeamError] = useState('')
  const [teamSuccess, setTeamSuccess] = useState('')
  const [userDraft, setUserDraft] = useState({
    name: '',
    email: '',
    password: '',
    role: 'organizador',
    organizerId: '',
    organizerName: '',
  })

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

  const visibleEvents = useMemo(() => {
    if (role === 'admin') return events
    return events.filter((event) => event.organizerId === currentUser.organizerId)
  }, [events, role, currentUser.organizerId])

  const visibleEventIds = useMemo(
    () => new Set(visibleEvents.map((event) => String(event.id))),
    [visibleEvents],
  )

  const visibleOrders = useMemo(() => {
    if (role === 'admin') return orders
    return orders.filter((order) => visibleEventIds.has(String(order.eventId)))
  }, [orders, role, visibleEventIds])

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
    setTab('events')
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

  function applyOrganizer(event, organizerId) {
    const organization = organizerOptions.find((item) => item.id === organizerId)
    return {
      ...event,
      organizerId,
      organizerName: organization?.name || 'Organizador',
    }
  }

  async function save() {
    if (!canManageEvents || !editing) return

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
      const result = await markTicketUsed(String(code).trim())
      setScanResult(result.forbidden ? 'forbidden' : !result.found ? 'invalid' : result.cancelled ? 'cancelled' : result.alreadyUsed ? 'used' : 'valid')
    } catch (err) { window.alert(err.message) }
  }

  function eventStatus(event) {
    if (event.archived) return { label: 'Arquivado', className: 'status-archived' }
    if (event.published) return { label: 'Publicado', className: 'status-on' }
    return { label: 'Oculto', className: 'status-off' }
  }

  async function submitUser(event) {
    event.preventDefault()
    setTeamError('')
    setTeamSuccess('')

    try {
      await createUser(userDraft)
      setTeamSuccess('Acesso criado com sucesso.')
      setUserDraft({ name: '', email: '', password: '', role: 'organizador', organizerId: '', organizerName: '' })
    } catch (err) {
      setTeamError(err.message || 'Não foi possível criar o acesso.')
    }
  }

  async function resetPassword(user) {
    if(!isLocalDemo){try{await changeUserPassword(user.id);setTeamSuccess('Link de recuperação enviado.')}catch(err){setTeamError(err.message)}return}
    const next = window.prompt(`Nova senha para ${user.name} (mínimo 6 caracteres):`)
    if (!next) return
    try {
      await changeUserPassword(user.id, next)
      setTeamSuccess(`Senha de ${user.name} alterada.`)
      setTeamError('')
    } catch (err) {
      setTeamError(err.message || 'Não foi possível alterar a senha.')
    }
  }

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
          {canManageTeam && <button className={tab === 'team' ? 'active' : ''} onClick={() => goTab('team')}><UserCog />Equipe</button>}
          {canSeeOrders && (role==='financeiro'?['finance','reports','history']:['customers','finance','reports','history']).map(key=><button key={key} className={tab===key?'active':''} onClick={()=>goTab(key)}><LayoutDashboard/>{{customers:'Clientes',finance:'Financeiro',reports:'Relatórios',history:'Histórico'}[key]}</button>)}
          {canManageEvents && <button className={tab==='coupons'?'active':''} onClick={()=>goTab('coupons')}><Ticket/>Cupons</button>}
        </nav>

        <div className="admin-sidebar-bottom">
          <Link to="/" className="admin-back"><ArrowLeft />Ver site</Link>
          <button className="admin-logout" onClick={logout}><LogOut />Sair</button>
        </div>
      </aside>

      <main className="admin-main">
        <p className="demo-warning">Demonstração local — login, vendas e check-in neste navegador. Pagamentos simulados.</p>
        {((canSeeOrders && ['customers','finance','reports','history'].includes(tab)) || (canManageEvents && tab==='coupons')) && <AdminOperations tab={tab}/>}
        {tab === 'dashboard' && role !== 'checkin' && (
          <>
            <div className="admin-title">
              <div>
                <span className="section-kicker">{role === 'organizador' ? 'PAINEL DO ORGANIZADOR' : role === 'financeiro' ? 'PAINEL FINANCEIRO' : 'PAINEL ADMINISTRATIVO'}</span>
                <h1>Visão geral.</h1>
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
              <h2>Eventos recentes</h2>
              {visibleEvents.slice(0, 5).map((event) => {
                const status = eventStatus(event)
                return (
                  <div className="admin-row" key={event.id}>
                    <img src={event.image} alt="" />
                    <div><strong>{event.title}</strong><span>{event.date} • {event.location}</span></div>
                    <span className={status.className}>{status.label}</span>
                  </div>
                )
              })}
              {visibleEvents.length === 0 && <p className="muted">Nenhum evento disponível para este acesso.</p>}
            </section>
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
                      <Link className="admin-action-button" to={`${publicPath}?preview=1`} target="_blank"><Eye size={16} />Visualizar</Link>
                      <button className="admin-action-button" onClick={() => copyPublicLink(event)}><Copy size={16} />{copiedId === event.id ? 'Copiado!' : 'Copiar link'}</button>
                      <button className="admin-action-button" onClick={() => setEditing(clone(event))}><Pencil size={16} />Editar</button>
                      <button className="admin-action-button" onClick={() => duplicateEvent(event)}><Files size={16} />Duplicar</button>
                      {!event.archived && <button className="admin-action-button" onClick={() => togglePublished(event)}>{event.published ? <EyeOff size={16} /> : <Eye size={16} />}{event.published ? 'Ocultar' : 'Mostrar'}</button>}
                      {!event.archived ? (
                        <button className="admin-action-button archive-action" onClick={() => archiveEvent(event)}><Archive size={16} />Arquivar</button>
                      ) : (
                        <button className="admin-action-button" onClick={() => restoreEvent(event)}><RefreshCw size={16} />Restaurar</button>
                      )}
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
              <div className="admin-actions"><button className="ghost-btn" onClick={() => setEditing(null)}>Cancelar</button><button className="primary-small" onClick={save}><Save />Salvar</button></div>
            </div>

            <div className="event-editor">
              <section>
                <h3>Informações principais</h3>
                <div className="form-grid">
                  <label>Nome<input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></label>
                  <label>Categoria<input value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} /></label>
                  {role === 'admin' && (
                    <label className="full">Organizador
                      <select value={editing.organizerId || 'org-main'} onChange={(e) => setEditing(applyOrganizer(editing, e.target.value))}>
                        {organizerOptions.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
                      </select>
                    </label>
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
                  <label className="full">URL da imagem<input value={editing.image} onChange={(e) => setEditing({ ...editing, image: e.target.value })} /></label>
                  <label className="full">Descrição<textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></label>
                  <label className="check-label"><input type="checkbox" checked={Boolean(editing.published)} onChange={(e) => setEditing({ ...editing, published: e.target.checked, archived: false })} /> Publicado no site</label>
                </div>
              </section>

              <section>
                <div className="editor-section-head"><h3>Ingressos / lotes</h3><button className="ghost-btn" onClick={addTicket}><Plus />Adicionar</button></div>
                {editing.ticketTypes.map((ticket, index) => (
                  <div className="ticket-editor-row" key={ticket.id}>
                    <input placeholder="Nome" value={ticket.name} onChange={(e) => updateTicket(index, 'name', e.target.value)} />
                    <input aria-label="Setor" placeholder="Setor" value={ticket.sector || ''} onChange={(e) => updateTicket(index, 'sector', e.target.value)} />
                    <input placeholder="Lote" value={ticket.batch} onChange={(e) => updateTicket(index, 'batch', e.target.value)} />
                    <input type="number" min="0" step="0.01" placeholder="Preço" value={ticket.price} onChange={(e) => updateTicket(index, 'price', e.target.value)} />
                    <input type="number" min="0" placeholder="Capacidade total" title="Capacidade total, incluindo unidades já vendidas" value={ticket.available} onChange={(e) => updateTicket(index, 'available', e.target.value)} />
                    <select value={ticket.type} onChange={(e) => updateTicket(index, 'type', e.target.value)}><option value="individual">Individual</option><option value="table">Mesa/Camarote</option></select>
                    {!isLocalDemo && <><label>Início do lote<input type="datetime-local" value={ticket.startsAt?new Date(ticket.startsAt).toISOString().slice(0,16):''} onChange={e=>updateTicket(index,'startsAt',e.target.value?new Date(e.target.value+'Z').toISOString():'')}/> UTC</label><label>Fim do lote<input type="datetime-local" value={ticket.endsAt?new Date(ticket.endsAt).toISOString().slice(0,16):''} onChange={e=>updateTicket(index,'endsAt',e.target.value?new Date(e.target.value+'Z').toISOString():'')}/> UTC</label><label>Ordem do lote<input type="number" min="0" value={ticket.position||0} onChange={e=>updateTicket(index,'position',Number(e.target.value))}/></label><label><input type="checkbox" checked={ticket.sequential||false} onChange={e=>updateTicket(index,'sequential',e.target.checked)}/> Aguardar lotes anteriores do setor</label><label><input type="checkbox" checked={ticket.active!==false} onChange={e=>updateTicket(index,'active',e.target.checked)}/> Lote ativo</label></>}
                    <button className="danger" aria-label="Remover lote" onClick={() => removeTicket(index)}><Trash2 /></button>
                  </div>
                ))}
              </section>
            </div>
          </>
        )}

        {tab === 'orders' && canSeeOrders && (
          <>
            <div className="admin-title"><div><span className="section-kicker">VENDAS</span><h1>Pedidos.</h1></div></div>
            <section className="admin-panel">
              <div className="form-grid"><label>Buscar pedido<input value={orderSearch} onChange={e=>setOrderSearch(e.target.value)} placeholder="Pedido, evento ou cliente"/></label><label>Status do pedido<select value={orderStatus} onChange={e=>setOrderStatus(e.target.value)}><option value="">Todos</option><option value="pending">Pendente</option><option value="approved">Aprovado</option><option value="cancelled">Cancelado</option><option value="refunded">Estornado</option></select></label></div>
              {visibleOrders.length === 0 ? <p className="muted">Nenhum pedido ainda.</p> : visibleOrders.filter(o=>(!orderStatus||(o.status||'approved')===orderStatus)&&[o.id,o.eventTitle,o.buyer?.name,o.buyer?.email].join(' ').toLowerCase().includes(orderSearch.toLowerCase())).map((order) => (
                <div className="order-row" key={order.id}>
                  <div><strong>{order.id}</strong><span>{order.buyer.name} • {order.eventTitle}</span></div>
                  <div><strong>{brl(order.total)}</strong><span>{order.quantity} ingresso(s) • {String(order.method || '').toUpperCase()} • {{approved:'Aprovado',pending:'Pendente',cancelled:'Cancelado',refunded:'Estornado'}[order.status||'approved']} • {order.source||'direto'}</span>{(approved(order)||order.status==='pending') && <button className="ghost-btn" onClick={async()=>{if(window.confirm('Cancelar este pedido e invalidar seus ingressos?')) {try {await cancelOrder(order.id)} catch(err){window.alert(err.message)}}}}>Cancelar pedido</button>}</div>
                </div>
              ))}
            </section>
          </>
        )}

        {tab === 'checkin' && canCheckin && (
          <>
            <div className="admin-title"><div><span className="section-kicker">PORTARIA</span><h1>Validar ingresso.</h1></div></div>
            <section className="checkin-panel">
              {!isLocalDemo && <><div>{summary.map(s=><p key={s.event_id}>{events.find(e=>e.id===s.event_id)?.title}: {s.checked_in} / {s.issued} entradas</p>)}</div><details><summary>Histórico recente</summary>{checkins.map(c=><p key={c.id}>{new Date(c.created_at).toLocaleString('pt-BR')} • operador {c.operator_id}</p>)}</details></>}
              <ScanLine /><h2>Digite ou escaneie o código</h2>
              <p className="muted">Este acesso valida apenas ingressos dos eventos permitidos para este perfil.</p>
              <CameraScanner onScan={code=>{setScan(code); doScan(code)}}/><div className="checkin-form"><input value={scan} onChange={(e) => setScan(e.target.value)} placeholder="ING-..." /><button className="primary-small" onClick={() => doScan()}>Validar</button></div>
              {scanResult && (
                <div className={`scan-result ${scanResult}`}>
                  {scanResult === 'valid' ? <><CheckCircle2 />INGRESSO VÁLIDO</> : scanResult === 'used' ? <><XCircle />JÁ UTILIZADO</> : scanResult === 'cancelled' ? <><XCircle />CANCELADO</> : scanResult === 'forbidden' ? <><ShieldCheck />SEM PERMISSÃO PARA ESTE EVENTO</> : <><XCircle />INVÁLIDO</>}
                </div>
              )}
            </section>
          </>
        )}

        {tab === 'team' && canManageTeam && (
          <>
            <div className="admin-title"><div><span className="section-kicker">ACESSOS E PERMISSÕES</span><h1>Equipe.</h1></div></div>

            {!isLocalDemo && <><OrganizationManager/><LocalDataImport/></>}
            <div className="team-layout">
              <form className="admin-panel team-create-card" onSubmit={submitUser}>
                <div className="team-card-title"><UserPlus /><div><h2>Novo acesso</h2><p>{isLocalDemo ? 'Crie um login separado para cada pessoa.' : 'Vincule uma conta já cadastrada e confirmada. Para convidar alguém, use o Dashboard Supabase Auth.'}</p></div></div>

                <div className="form-grid team-form-grid">
                  <label>Nome<input required value={userDraft.name} onChange={(e) => setUserDraft({ ...userDraft, name: e.target.value })} /></label>
                  <label>E-mail<input required type="email" value={userDraft.email} onChange={(e) => setUserDraft({ ...userDraft, email: e.target.value })} /></label>
                  {isLocalDemo && <label>Senha inicial<input required minLength={6} type="password" value={userDraft.password} onChange={(e) => setUserDraft({ ...userDraft, password: e.target.value })} /></label>}
                  <label>Perfil
                    <select value={userDraft.role} onChange={(e) => setUserDraft({ ...userDraft, role: e.target.value, organizerId: e.target.value === 'admin' ? 'org-main' : userDraft.organizerId })}>
                      <option value="organizador">Organizador</option>
                      <option value="financeiro">Financeiro</option>
                      <option value="checkin">Check-in</option>
                      <option value="admin">Administrador</option><option value="cliente">Cliente</option>
                    </select>
                  </label>

                  {userDraft.role === 'organizador' ? (
                    <label className="full">Empresa / organizador<input required={!userDraft.organizerId} value={userDraft.organizerName} onChange={(e) => setUserDraft({ ...userDraft, organizerName: e.target.value })} placeholder="Ex.: Empresa X Eventos" /></label>
                  ) : !['admin','cliente'].includes(userDraft.role) ? (
                    <label className="full">Vincular à organização
                      <select value={userDraft.organizerId || 'org-main'} onChange={(e) => {
                        const org = organizerOptions.find((item) => item.id === e.target.value)
                        setUserDraft({ ...userDraft, organizerId: e.target.value, organizerName: org?.name || '' })
                      }}>
                        {organizerOptions.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
                      </select>
                    </label>
                  ) : null}
                </div>

                {!isLocalDemo && userDraft.role==='organizador' && <label>Organização existente<select value={userDraft.organizerId} onChange={e=>setUserDraft({...userDraft,organizerId:e.target.value})}><option value="">Criar nova organização</option>{organizerOptions.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>}
                {teamError && <div className="auth-error">{teamError}</div>}
                {teamSuccess && <div className="team-success">{teamSuccess}</div>}
                <button className="primary-small team-submit"><UserPlus />Criar acesso</button>
              </form>

              <section className="admin-panel team-list-card">
                <div className="team-card-title"><UserCog /><div><h2>Acessos cadastrados</h2><p>Ative, desative ou redefina a senha.</p></div></div>
                <div className="team-list">
                  {users.map((user) => (
                    <article key={user.id} className={user.active === false ? 'team-user-disabled' : ''}>
                      <div className="team-avatar">{user.name.slice(0, 1).toUpperCase()}</div>
                      <div className="team-user-copy">
                        <strong>{user.name}</strong>
                        <span>{user.email}</span>
                        <small>{roleLabels[user.role]}{user.organizerName ? ` • ${user.organizerName}` : ''}</small>
                      </div>
                      <div className="team-user-actions">
                        {user.id !== currentUser.id && <><select aria-label={'Perfil de '+user.name} value={user.role} onChange={async e=>{try{await updateUserProfile(user.id,{role:e.target.value,organizerId:user.organizerId||'org-main',organizerName:user.organizerName||'Organização principal'})}catch(err){setTeamError(err.message)}}}>{Object.entries(roleLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select>{!['admin','cliente'].includes(user.role)&&<select aria-label={'Organização de '+user.name} value={user.organizerId||'org-main'} onChange={async e=>{const org=organizerOptions.find(item=>item.id===e.target.value);try{await updateUserProfile(user.id,{role:user.role,organizerId:org.id,organizerName:org.name})}catch(err){setTeamError(err.message)}}}>{organizerOptions.map(org=><option key={org.id} value={org.id}>{org.name}</option>)}</select>}</>}
                        <button className="ghost-btn" onClick={() => resetPassword(user)}>Nova senha</button>
                        {user.id !== currentUser.id && <button className="ghost-btn" onClick={async () => {try{await toggleUserActive(user.id)}catch(err){setTeamError(err.message)}}}>{user.active === false ? 'Ativar' : 'Desativar'}</button>}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
