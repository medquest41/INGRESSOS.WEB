import CamaroteMap from './CamaroteMap'
import VenueMap from './VenueMap'
export default function EventSeating({event,...props}){
 const numbered=event.ticketTypes?.some(t=>t.type==='camarote')
 return <div className="event-seating">{numbered?<CamaroteMap event={event} {...props}/>:<VenueMap event={event} local={props.local} expanded/>}</div>
}
