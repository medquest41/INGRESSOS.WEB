import CamaroteMap from './CamaroteMap'
import {Link} from 'react-router-dom'
import {getEventPublicPath} from '../utils/eventSlug'
import './CheckoutSeating.css'
export default function CheckoutSeating({event,ticket,getRemaining,local=false,locked=false}){
 if(ticket.type!=='camarote')return null
 const count=Number(ticket.wristbands)
 return <section className="checkout-seating" aria-label="Conferir unidade e ingressos inclusos"><h2>{ticket.name}</h2><p>1 unidade inteira • {count} ingressos individuais inclusos • um único pagamento.</p><CamaroteMap event={event} selectedId={ticket.id} getRemaining={getRemaining} local={local} readOnly/><details><summary>Ver os {count} ingressos inclusos</summary><p>A numeração identifica cada ingresso deste pedido. Os QR Codes exclusivos serão liberados após a confirmação do pagamento.</p><ol className="included-ticket-numbers">{Array.from({length:count},(_,i)=><li key={i}>Ingresso {i+1} de {count}</li>)}</ol></details>{!locked&&<Link className="ghost-btn" to={getEventPublicPath(event)+'#unidades-numeradas'}>Escolher outra unidade</Link>}</section>
}
