import { useLayoutEffect, useRef, useState } from 'react'
import { normalizeAttractions } from '../utils/attractions'

// Mask measured content rectangles instead of placing decorations over readable areas.
const protectedAreas = '.event-hero,.event-page-header,.event-about>*,.event-location-card,.event-main>:not(.event-information):not(.attractions-section),.attractions-section>.section-kicker,.attractions-section>h2,.attraction-card,.event-footer,.footer16,.cookies16'
export default function EventAmbient({ event, visual }) {
  const ref = useRef(null)
  const [geometry, setGeometry] = useState(null)
  useLayoutEffect(() => {
    const host = ref.current?.parentElement
    if (!host) return
    let frame
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const box = host.getBoundingClientRect()
        const holes = [...host.querySelectorAll(protectedAreas)].map(el => {
          const r = el.getBoundingClientRect()
          return `<rect x="${r.left-box.left-12}" y="${r.top-box.top-12}" width="${r.width+24}" height="${r.height+24}" fill="black"/>`
        }).join('')
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${box.width}" height="${box.height}"><rect width="100%" height="100%" fill="white"/>${holes}</svg>`
        setGeometry({ maskImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`, '--ix-travel': `${box.height}px` })
      })
    }
    const observer = new ResizeObserver(update)
    observer.observe(host)
    host.querySelectorAll(protectedAreas).forEach(el => observer.observe(el))
    window.addEventListener('resize', update)
    host.addEventListener('load', update, true)
    update()
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('resize', update); host.removeEventListener('load', update, true) }
  }, [event])
  const photos = normalizeAttractions(event.attractions).filter(a => a.image && a.visible && a.status !== 'cancelled').map(a => a.image)
  if (visual.logo) photos.push(visual.logo)
  return <div ref={ref} className="ix-ambient-field" aria-hidden="true" style={{ ...geometry, visibility: geometry ? 'visible' : 'hidden' }}>
    {photos.length > 0 && Array.from({ length: Math.min(visual.density + 6, 18) }, (_, i) => <span key={i} className="ix-ambient-medallion" style={{ left: `${3 + (i * 31) % 94}%`, '--ambient-size': `${56 + i % 3 * 18}px`, '--ambient-delay': `${-i * 5.7}s`, '--ambient-duration': `${48 + i % 4 * 9}s` }}><img src={photos[i % photos.length]} alt="" referrerPolicy="no-referrer"/></span>)}
  </div>
}
