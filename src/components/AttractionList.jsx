import { Clock3, MapPin, Music2 } from 'lucide-react'
import { normalizeAttractions, attractionImageUrl, attractionStatuses } from '../utils/attractions'
import './Attractions.css'

function dateLabel(date) { return date ? date.split('-').reverse().join('/') : '' }
export default function AttractionList({ value, allowDemo = false }) {
  const items = normalizeAttractions(value).filter(item => item.visible && item.name.trim())
  if (!items.length) return null
  return <section className="attractions-section">
    <span className="section-kicker">ATRAÇÕES E PROGRAMAÇÃO</span>
    <h2>Prepare-se para a noite.</h2>
    <div className="attraction-grid attraction-program-grid">
      {items.map((item, index) => {
        const image = attractionImageUrl(item.image, allowDemo)
        return <article className={`attraction-card attraction-program-card ${item.featured ? 'featured' : ''}`} key={item.id}>
          <div className="attraction-photo">{image ? <img src={image} alt={item.name} loading="lazy" onError={e => { e.currentTarget.hidden = true }}/>: <Music2 aria-hidden="true"/>}<span>{String(index + 1).padStart(2, '0')}</span>{item.featured && <b>DESTAQUE</b>}</div>
          <div className="attraction-program-copy"><span className="attraction-type">{item.type}</span><strong>{item.name}</strong>
            <small className={'attraction-status ' + item.status}>{attractionStatuses[item.status]}</small>
            <p className="attraction-time"><Clock3 size={15}/>{dateLabel(item.date)}{item.date && ' • '}{item.startTime || 'Horário a definir'}{item.endTime && ` às ${item.endTime}`}{item.endsNextDay && item.endTime && ' (dia seguinte)'}</p>
            {item.stage && <p className="attraction-stage"><MapPin size={15}/>{item.stage}</p>}
            {item.description && <p className="attraction-description">{item.description}</p>}
          </div>
        </article>
      })}
    </div>
  </section>
}
