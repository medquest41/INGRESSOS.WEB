/* oxlint-disable react/set-state-in-effect -- Clear the upload status when the selected organization changes. */
import { useCallback, useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import EventImageField from './EventImageField'
import { normalizeAttractions, attractionTypes, attractionStatuses } from '../utils/attractions'
import './Attractions.css'

function AttractionCard({ item, index, total, organizationId, onChange, onMove, onRemove, onBusy, disabled, expanded, onToggle }) {
  const notifyBusy = useCallback(busy => onBusy(item.id, busy), [item.id, onBusy])
  return <article className={`attraction-editor-card ${expanded ? 'expanded' : 'collapsed'}`} data-attraction-id={item.id} aria-label={`Atração ${index + 1}`}>
    <header>
      <button type="button" className="attraction-collapse-toggle" onClick={onToggle} aria-expanded={expanded}>
        {expanded ? <ChevronDown size={18}/> : <ChevronRight size={18}/>}
        <div><span className="section-kicker">ATRAÇÃO {index + 1}</span><h4>{item.name || 'Nova atração'}</h4></div>
      </button>
      <div className="attraction-editor-actions">
        <button type="button" className="ghost-btn" disabled={disabled || index === 0} aria-label={`Mover atração ${index + 1} para cima`} onClick={() => onMove(index, -1)}><ArrowUp size={16}/></button>
        <button type="button" className="ghost-btn" disabled={disabled || index === total - 1} aria-label={`Mover atração ${index + 1} para baixo`} onClick={() => onMove(index, 1)}><ArrowDown size={16}/></button>
        <button type="button" className="ghost-btn" disabled={disabled} aria-label={`Remover atração ${index + 1}`} onClick={() => onRemove(index)}><Trash2 size={16}/>Remover</button>
      </div>
    </header>
    {expanded && <>
      <fieldset disabled={disabled} className="attraction-fields"><legend>Dados da atração {index + 1}</legend>
        <div className="form-grid">
          <label>Nome da atração *<input maxLength={120} value={item.name} placeholder="Ex.: DJ Maria" onChange={e => onChange(index, 'name', e.target.value)}/></label>
          <label>Tipo de atração<select value={item.type} onChange={e => onChange(index, 'type', e.target.value)}>{attractionTypes.map(type => <option key={type}>{type}</option>)}</select></label>
          <label>Confirmação<select value={item.status} onChange={e => onChange(index, 'status', e.target.value)}>{Object.entries(attractionStatuses).map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select></label>
          <label>Palco / ambiente<input maxLength={120} value={item.stage} placeholder="Ex.: Palco principal" onChange={e => onChange(index, 'stage', e.target.value)}/></label>
          <label>Data da apresentação<input type="date" value={item.date} onChange={e => onChange(index, 'date', e.target.value)}/><small>Opcional. Sem data, vale a data do evento.</small></label>
          <label>Horário de início<input type="time" value={item.startTime} onChange={e => onChange(index, 'startTime', e.target.value)}/><small>Horário local do evento. Vazio: horário a definir.</small></label>
          <label>Horário de término<input type="time" value={item.endTime} onChange={e => onChange(index, 'endTime', e.target.value)}/><small>Opcional.</small></label>
          <label className="check-label"><input type="checkbox" checked={item.endsNextDay} onChange={e => onChange(index, 'endsNextDay', e.target.checked)}/>Termina no dia seguinte</label>
          <label className="full">Descrição da atração<textarea rows={3} maxLength={1000} value={item.description} placeholder="Conte sobre o artista ou a apresentação." onChange={e => onChange(index, 'description', e.target.value)}/></label>
          <label className="check-label"><input type="checkbox" checked={item.visible} onChange={e => onChange(index, 'visible', e.target.checked)}/>Mostrar no site</label>
          <label className="check-label"><input type="checkbox" checked={item.featured} onChange={e => onChange(index, 'featured', e.target.checked)}/>Destacar atração</label>
        </div>
      </fieldset>
      <EventImageField label="Foto da atração" value={item.image} organizationId={organizationId} disabled={disabled} onChange={image => onChange(index, 'image', image)} onBusyChange={notifyBusy}/>
    </>}
  </article>
}

export default function AttractionEditor({ value, organizationId, onChange, onBusyChange }) {
  const items = normalizeAttractions(value)
  const [busyIds, setBusyIds] = useState(new Set())
  const [expandedId, setExpandedId] = useState(() => items[0]?.id || null)
  const onBusy = useCallback((id, busy) => setBusyIds(previous => {
    if (previous.has(id) === busy) return previous
    const next = new Set(previous); if (busy) next.add(id); else next.delete(id); return next
  }), [])
  const uploading = busyIds.size > 0
  useEffect(() => { onBusyChange(uploading) }, [uploading, onBusyChange])
  useEffect(() => () => onBusyChange(false), [onBusyChange])
  useEffect(() => {
    if (expandedId && !items.some(item => item.id === expandedId)) setExpandedId(items[0]?.id || null)
  }, [items, expandedId])
  function update(index, field, next) { onChange(items.map((item, i) => i === index ? { ...item, [field]: next } : item)) }
  function move(index, direction) { const next = [...items]; [next[index], next[index + direction]] = [next[index + direction], next[index]]; onChange(next) }
  function remove(index) {
    if (!window.confirm(`Remover ${items[index].name || 'esta atração'}? A alteração será aplicada ao salvar o evento.`)) return
    const removedId = items[index].id
    const next = items.filter((_, i) => i !== index)
    onChange(next)
    if (expandedId === removedId) setExpandedId(next[0]?.id || null)
  }
  function addAttraction() {
    const id = crypto.randomUUID()
    const nextItem = { id, name: '', status: 'planned' }
    onChange([nextItem, ...items])
    setExpandedId(id)
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => document.querySelector(`[data-attraction-id="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    })
  }
  return <section className="attractions-editor" aria-label="Atrações do evento">
    <div className="editor-section-head"><h3>Atrações e programação</h3><button type="button" className="ghost-btn" disabled={uploading || items.length >= 100} onClick={addAttraction}><Plus/>Adicionar atração</button></div>
    <p className="ticket-editor-explanation">Cada atração fica em uma aba compacta. Clique no nome para abrir. Ao adicionar uma nova atração, ela aparece no topo e abre automaticamente.</p>
    {!items.length && <p className="attractions-empty">Nenhuma atração cadastrada. Use Adicionar atração para começar.</p>}
    {items.map((item, index) => <AttractionCard key={item.id} item={item} index={index} total={items.length} organizationId={organizationId} onChange={update} onMove={move} onRemove={remove} onBusy={onBusy} disabled={uploading} expanded={expandedId === item.id} onToggle={() => setExpandedId(current => current === item.id ? null : item.id)}/>) }
  </section>
}
