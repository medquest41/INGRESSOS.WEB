/* oxlint-disable react/set-state-in-effect -- Reset local editor when the saved event changes. */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, CircleAlert, Eye, Palette, Save, Sparkles } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import EventImageField from '../components/EventImageField'
import { EventMedallions, CinematicIntro } from '../components/EventCinematic'
import { useEventStore } from '../store/EventStore'
import { useAuth } from '../store/AuthStore'
import { getEventPublicPath } from '../utils/eventSlug'
import { canManage } from '../utils/commerce'
import { DEFAULT_ACCENT, detectLogoAccent, getEventVisual, isSafeVisualImage } from '../utils/eventVisual'

function VisualForm({ event }) {
  const navigate = useNavigate()
  const { saveEvent, isLocalDemo } = useEventStore()
  const { currentUser } = useAuth()
  const [visual, setVisual] = useState(() => getEventVisual(event))
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null)
  const [playIntro, setPlayIntro] = useState(false)
  const onBusyChange = useCallback(value => setBusy(value), [])
  useEffect(() => { setVisual(getEventVisual(event)) }, [event])
  const editable = canManage(currentUser, event)
  const update = (key, value) => setVisual(previous => ({ ...previous, [key]: value }))
  const onLogoChange = async url => {
    setVisual(previous => ({ ...previous, logo: url }))
    if (!url) return
    const accent = await detectLogoAccent(url)
    if (accent) setVisual(previous => previous.logo === url && previous.automaticColor ? { ...previous, primary: accent } : previous)
    else setNotice({ type: 'warning', message: 'Logo carregada, mas a cor não foi reconhecida automaticamente. Se quiser, escolha a cor manualmente.' })
  }
  async function save() {
    if (!editable || busy || saving) return
    setNotice(null)
    if (!isSafeVisualImage(visual.logo, isLocalDemo)) { setNotice({ type: 'error', message: 'Use uma imagem enviada pelo seletor ou um link HTTPS válido.' }); return }
    setSaving(true)
    try {
      await saveEvent({ ...event, visualExperience: { ...visual, density: Number(visual.density) } })
      setNotice({ type: 'success', message: 'Experiência salva com sucesso. As alterações já estão registradas neste evento.' })
      if (!isLocalDemo) navigate('/admin/experiencia/' + encodeURIComponent(event.id), { replace: true })
    } catch (error) { setNotice({ type: 'error', message: 'Não foi possível salvar: ' + (error.message || 'Erro inesperado.') }) }
    finally { setSaving(false) }
  }
  return <div className="ix-visual-editor-layout">
    <section className="ix-visual-editor-controls">
      <header><span className="section-kicker"><Palette size={16} /> IDENTIDADE VISUAL</span><h1>{event.title}</h1><p>Configure a entrada cinematográfica e o universo visual da página deste evento.</p></header>
      <div className="ix-control-card">
        <label className="ix-toggle-row"><span><strong>Ativar experiência personalizada</strong><small>Quando desligada, o evento continua com o visual padrão.</small></span><input type="checkbox" checked={visual.enabled} onChange={e => update('enabled', e.target.checked)} /></label>
        <EventImageField value={visual.logo} label="Logo do cliente (fundo transparente recomendado)" organizationId={event.organizerId} onChange={onLogoChange} onBusyChange={onBusyChange} />
        <div className="ix-color-controls">
          <label className="ix-toggle-row"><span><strong>Extrair cor da logo</strong><small>Ao carregar outra logo, a cor principal será sugerida automaticamente.</small></span><input type="checkbox" checked={visual.automaticColor} onChange={e => update('automaticColor', e.target.checked)} /></label>
          <label>Cor principal do evento <div className="ix-color-chooser"><input aria-label="Escolher cor" type="color" value={visual.primary || DEFAULT_ACCENT} onChange={e => update('primary', e.target.value)} /><strong>{visual.primary}</strong></div></label>
        </div>
        <label className="ix-toggle-row"><span><strong>Vinheta cinematográfica</strong><small>Raios convergem para a logo por cerca de dois segundos.</small></span><input type="checkbox" checked={visual.intro} onChange={e => update('intro', e.target.checked)} /></label>
        <label className="ix-toggle-row"><span><strong>Medalhões flutuantes em 3D</strong><small>Usa a logo e as fotos das atrações já cadastradas.</small></span><input type="checkbox" checked={visual.medallions} onChange={e => update('medallions', e.target.checked)} /></label>
        <label className="ix-range-field">Quantidade de medalhões: <strong>{visual.density}</strong><input type="range" min="3" max="12" step="1" value={visual.density} onChange={e => update('density', Number(e.target.value))} /></label>
        <p className="ix-footnote">Fotos de DJs e cantores: no painel do evento, abra “Editar”, depois “Atrações e programação” e carregue as imagens.</p>
        {notice && <div className={`ix-editor-notice ${notice.type}`} role="status" aria-live="polite">{notice.type === 'success' ? <CheckCircle2 size={21}/> : <CircleAlert size={21}/>}<div><strong>{notice.type === 'success' ? 'Alterações salvas' : notice.type === 'error' ? 'Não foi possível salvar' : 'Atenção'}</strong><span>{notice.message}</span></div></div>}
        <div className="ix-editor-actions">
          <button type="button" className="primary-small" disabled={busy || saving || !editable} onClick={save}><Save size={17}/>{saving ? 'Salvando...' : busy ? 'Enviando imagem...' : 'Salvar experiência'}</button>
          <Link className="ghost-btn" to={`${getEventPublicPath(event)}?preview=1&cinema=1`} target="_blank" rel="noreferrer"><Eye size={17}/> Ver página com vinheta</Link>
        </div>
      </div>
    </section>
    <aside className="ix-visual-demo" style={{ '--ix-accent': visual.primary }}>
      <div className="ix-demo-badge"><Sparkles size={15} /> PRÉ-VISUALIZAÇÃO AO VIVO</div>
      <div className="ix-demo-stage">
        <div className="ix-demo-rays" aria-hidden="true"/>
        {visual.medallions && <EventMedallions event={event} visual={visual} />}
        <div className="ix-demo-content">
          {visual.logo ? <img src={visual.logo} alt="Prévia da logo" /> : <div className="ix-demo-fallback">{event.title?.slice(0, 2)?.toUpperCase() || 'EX'}</div>}
          <h2>{event.title}</h2>
          <span>UMA EXPERIÊNCIA EXCLUSIVA</span>
          <button type="button" onClick={() => setPlayIntro(true)}>▶ Testar vinheta de 2 segundos</button>
        </div>
      </div>
      <p>Para mudar as fotos que caem no fundo, edite as atrações do evento. As alterações nesta prévia só são publicadas depois de salvar.</p>
    </aside>
    {playIntro && <CinematicIntro event={event} visual={visual} onFinish={() => setPlayIntro(false)} />}
  </div>
}

export default function EventVisualEditor() {
  const { eventKey } = useParams()
  const { events, loading } = useEventStore()
  const { currentUser } = useAuth()
  const permitted = useMemo(() => events.filter(event => canManage(currentUser, event)), [events, currentUser])
  const event = permitted.find(item => String(item.id) === eventKey)
  return <div className="ix-customizer-page">
    <div className="ix-customizer-top"><Link to="/admin?tab=events" className="ghost-btn"><ArrowLeft size={17}/> Voltar ao administrador</Link><strong>INGRESSOS EXPERIENCES <span>• ESTÚDIO VISUAL</span></strong></div>
    {!eventKey ? <section className="ix-event-picker"><span className="section-kicker">PERSONALIZAÇÃO POR CLIENTE</span><h1>Escolha o evento.</h1><p>Primeiro salve o evento no painel. Depois personalize a logo, as cores, a vinheta e os medalhões aqui.</p>{!loading && !permitted.length && <p>Nenhum evento disponível. Cadastre um evento no administrador.</p>}<div>{permitted.map(item => <Link key={item.id} to={'/admin/experiencia/' + encodeURIComponent(item.id)}><img src={item.image} alt=""/><span><strong>{item.title}</strong><small>{item.city} • {item.published ? 'Publicado' : 'Rascunho'}</small></span><ArrowRight size={18}/></Link>)}</div></section> : event ? <VisualForm key={event.id} event={event} /> : <section className="ix-event-picker"><h1>Evento não encontrado ou sem permissão.</h1><Link to="/admin/experiencia">Escolher outro evento</Link></section>}
  </div>
}
