import { Link } from 'react-router-dom'
import './EventAdminContext.css'

export default function EventAdminContext({ event, eventId, events, eventPage, tab, role, canManageFees = false, onSelect, onEdit }) {
  const sales = ['admin','organizador','financeiro'].includes(role)
  const manage = ['admin','organizador'].includes(role)
  const checkin = ['admin','organizador','checkin'].includes(role)
  const tabs = [
    ...(role !== 'checkin' ? [['dashboard','Sobre o evento']] : []),
    ...(sales ? [['orders','Pedidos'],...(role !== 'financeiro' ? [['customers','Clientes']] : []),['finance','Financeiro'],['reports','Relatórios'],['history','Histórico']] : []),
    ...(checkin ? [['checkin','Check-in']] : []),
    ...(manage ? [['coupons','Cupons']] : []),
    ...((canManageFees || (role === 'organizador' && event?.feeEditableByOrganizer)) ? [['fees','Taxas']] : []),
  ]
  return <section className="event-admin-context" aria-label="Contexto do evento">
    {eventPage ? <>
      <Link to="/admin?tab=events">← Voltar à lista de eventos</Link>
      <span className="section-kicker">GESTÃO DESTE EVENTO</span>
      <h2>{event.title}</h2>
      <p>{event.date} • {event.location} • {event.organizerName || 'Organizador'}</p>
      {manage && <button className="ghost-btn" onClick={onEdit}>Editar este evento</button>}
      <nav aria-label="Abas do evento">{tabs.map(([key,label]) => <Link key={key} to={`/admin/evento/${encodeURIComponent(event.id)}/${key}`} aria-current={tab===key?'page':undefined}>{label}</Link>)}</nav>
    </> : <>
      <label>Filtrar por evento<select value={eventId} onChange={e => onSelect(e.target.value)}><option value="">Todos os eventos — visão geral</option>{events.map(item => <option key={item.id} value={item.id}>{item.title}{item.archived?' (arquivado)':!item.published?' (oculto)':''}</option>)}</select></label>
      <p>{eventId ? event ? `Exibindo apenas: ${event.title}` : 'Evento não disponível para este acesso.' : 'Visão geral de todos os eventos autorizados. Selecione um evento para separar os dados.'}</p>
      {event && <Link className="ghost-btn" to={`/admin/evento/${encodeURIComponent(event.id)}/${role==='checkin'?'checkin':'dashboard'}`}>Abrir gestão deste evento</Link>}
    </>}
  </section>
}
