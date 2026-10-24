import {MapPin,ArrowUpRight} from 'lucide-react'
import {eventMapsUrl} from '../utils/maps'
export default function EventLocationPreview({event}){
 if(![event.location,event.address,event.city,event.mapsUrl].some(value=>String(value||'').trim()))return null
 return <aside className="event-location-preview" aria-label="Localização do evento"><span className="location-preview-icon" aria-hidden="true"><MapPin size={28}/></span><span className="section-kicker">LOCALIZAÇÃO</span><h3>{event.location||'Como chegar'}</h3>{event.address&&<p>{event.address}</p>}{event.city&&<p className="muted">{event.city}</p>}<a className="ghost-btn" href={eventMapsUrl(event)} target="_blank" rel="noopener noreferrer">Abrir localização no Google Maps <ArrowUpRight size={16}/></a></aside>
}
