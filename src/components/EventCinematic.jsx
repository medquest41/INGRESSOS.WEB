/* oxlint-disable react/set-state-in-effect -- Update portal mount targets and session-scoped intro when the selected event changes. */
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import EventAmbient from './EventAmbient'
import { useParams, useSearchParams } from 'react-router-dom'
import { useEventStore } from '../store/EventStore'
import { useAuth } from '../store/AuthStore'
import { canManage } from '../utils/commerce'
import { matchesEventRoute } from '../utils/eventSlug'
import { normalizeAttractions } from '../utils/attractions'
import { getEventVisual } from '../utils/eventVisual'

const BEAMS = Array.from({ length: 18 }, (_, index) => index)

function medallionImages(event, visual) {
  const entries = []
  if (visual.logo) entries.push({ image: visual.logo, label: event.title || 'Evento', type: 'logo' })
  normalizeAttractions(event.attractions)
    .filter(item => item.image && item.visible && item.status !== 'cancelled')
    .forEach(item => entries.push({ image: item.image, label: item.name, type: 'artist' }))
  return entries
}

export function EventMedallions({ event, visual, placement = 'hero' }) {
  const photos = useMemo(() => medallionImages(event, visual), [event, visual])
  const count = Math.min(visual.density, placement === 'ticket' ? 5 : placement === 'backdrop' ? 6 : 12)
  if (!photos.length || !visual.medallions) return null
  return <div className={`ix-medallion-sky ix-medallion-sky--${placement}`} aria-hidden="true">
    {Array.from({ length: count }, (_, i) => {
      const item = photos[i % photos.length]
      const left = placement === 'backdrop' ? 8 + i * (84 / Math.max(1, count - 1)) : 7 + ((i * 29 + 13) % 84)
      const delay = -((i * 1.7) % 16)
      const duration = placement === 'backdrop' ? 22 + (i % 5) * 3.2 : 12 + (i % 5) * 2.2
      const size = 66 + (i % 4) * (placement === 'backdrop' ? 12 : 24)
      return <div className={`ix-medallion ix-medallion--${item.type}`} key={`${item.image}-${i}`}
        style={{ '--ix-left': `${left}%`, '--ix-delay': `${delay}s`, '--ix-duration': `${duration}s`, '--ix-size': `${size}px`, '--ix-drift': `${(i % 2 ? 1 : -1) * (24 + i * 5)}px` }}>
        <img src={item.image} alt="" loading="lazy" referrerPolicy="no-referrer" />
      </div>
    })}
  </div>
}

// An isolated background lane keeps animation outside every interactive/content region.
export function EventBackdrop({ event, checkout = false }) {
  const visual = useMemo(() => getEventVisual(event), [event])
  const photos = useMemo(() => medallionImages(event, visual), [event, visual])
  if (!visual.enabled || !visual.medallions || !photos.length) return null
  return <div className={`ix-event-backdrop${checkout ? ' ix-event-backdrop--checkout' : ''}`} style={{ '--ix-accent': visual.primary }} aria-hidden="true">
    <EventMedallions event={event} visual={visual} placement="backdrop" />
  </div>
}

export function CinematicIntro({ event, visual, onFinish }) {
  useEffect(() => {
    const timer = window.setTimeout(onFinish, 1950)
    return () => window.clearTimeout(timer)
  }, [onFinish])
  return <div className="ix-cinematic-intro" style={{ '--ix-accent': visual.primary }} role="status" aria-label={`Preparando experiência ${event.title}`}>
    <div className="ix-cinematic-starfield" aria-hidden="true" />
    <div className="ix-cinematic-vortex" aria-hidden="true">
      {BEAMS.map(index => <span key={index} className="ix-cinematic-ray" style={{ '--ix-angle': `${index * 20}deg`, '--ix-raydelay': `${(index % 5) * 65}ms` }}/>) }
    </div>
    <div className="ix-cinematic-center">
      {visual.logo ? <img className="ix-cinematic-logo" src={visual.logo} alt={event.title} /> : <strong className="ix-cinematic-title">{event.title}</strong>}
      <small>UMA EXPERIÊNCIA EXCLUSIVA</small>
    </div>
    <button className="ix-cinematic-skip" type="button" onClick={onFinish}>Pular animação</button>
  </div>
}

export default function EventCinematic({ children }) {
  const { eventKey } = useParams()
  const [searchParams] = useSearchParams()
  const { events } = useEventStore()
  const { currentUser } = useAuth()
  const event = useMemo(() => events.find(item => matchesEventRoute(item, eventKey)), [events, eventKey])
  const visual = useMemo(() => getEventVisual(event), [event])
  const [targets, setTargets] = useState({})
  const [showIntro, setShowIntro] = useState(false)
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const allowed = Boolean(event && ((event.published && !event.archived) || (searchParams.get('preview') === '1' && canManage(currentUser, event))))

  useEffect(() => {
    setTargets({ page: document.querySelector('.event-page'), ticket: document.querySelector('.ticket-section') })
  }, [eventKey, event])

  useEffect(() => {
    if (!allowed || !visual.enabled || !visual.intro || reducedMotion) return
    const key = `ix-cinematic-seen:${event.id}`
    let seen = false
    try { seen = sessionStorage.getItem(key) === '1' } catch { /* storage indisponível */ }
    const forced = searchParams.get('cinema') === '1'
    if (!seen || forced) {
      setShowIntro(true)
      try { sessionStorage.setItem(key, '1') } catch { /* storage indisponível */ }
    }
  }, [allowed, event?.id, visual.enabled, visual.intro, reducedMotion, searchParams])

  return <div className={visual.enabled && allowed ? 'ix-event-universe-enabled' : ''} style={{ '--ix-accent': visual.primary }}>
    {children}
    {allowed && visual.enabled && visual.medallions && targets.page && createPortal(<EventAmbient event={event} visual={visual} />, targets.page)}
    {allowed && visual.enabled && visual.medallions && !reducedMotion && targets.ticket && createPortal(<EventMedallions event={event} visual={visual} placement="ticket" />, targets.ticket)}
    {allowed && visual.enabled && showIntro && <CinematicIntro event={event} visual={visual} onFinish={() => setShowIntro(false)} />}
  </div>
}

