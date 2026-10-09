import {useParams,Link} from 'react-router-dom'
import {useEventStore} from '../store/EventStore'
import {eventIsPublic} from '../utils/experience'
import {getEventPublicPath} from '../utils/eventSlug'
import Activity from '../components/Activity'
export default function OrganizerEvents(){const {organizerId}=useParams(),{events}=useEventStore();const list=events.filter(e=>e.organizerId===organizerId&&eventIsPublic(e));return <main className="institutional16"><Link to="/eventos">← Eventos</Link><h1>{list[0]?.organizerName||'Eventos do organizador'}</h1><p>{list.length} eventos ativos</p><div className="event-grid">{list.map(e=><Link className="event-card" key={e.id} to={getEventPublicPath(e)}><div className="event-image"><img src={e.image} alt={e.title}/></div><div className="event-content"><span>{e.category} • {e.genre}</span><h2>{e.title}</h2><p>{e.location} • {e.city}</p><Activity event={e}/><span>Ver detalhes →</span></div></Link>)}</div></main>}
