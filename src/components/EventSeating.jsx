import {useEffect,useRef} from 'react'
import {createPortal} from 'react-dom'
import CamaroteMap from './CamaroteMap'
import VenueMap from './VenueMap'
import './EventSeating.css'
export default function EventSeating({event,openRequest=0,...props}){
 const dialog=useRef(null)
 const numbered=event.ticketTypes?.some(t=>t.type==='camarote'&&!t.retiredForSales)
 useEffect(()=>{if((openRequest||window.location.hash==='#unidades-numeradas')&&numbered&&!dialog.current?.open)dialog.current?.showModal()},[openRequest,numbered])
 if(!numbered)return <div className="event-seating"><VenueMap event={event} local={props.local} expanded/></div>
 function close(){dialog.current?.close()}
 return <section className="event-seating seating-preview" id="escolher-unidade"><h2>{event.venueMapTitle||'Escolha seu camarote, mesa ou grupo'}</h2><p>Veja o mapa e os números disponíveis. Escolha sua unidade para continuar ao pagamento.</p><button className="primary-small" type="button" onClick={()=>dialog.current.showModal()}>Ver mapa e escolher número</button>{createPortal(<dialog ref={dialog} className="seating-dialog" aria-labelledby="seating-dialog-title"><header><h2 id="seating-dialog-title">Escolha sua unidade</h2><button type="button" className="ghost-btn" onClick={close} aria-label="Fechar seleção de unidade">Fechar ✕</button></header><p>Selecione uma categoria e um número disponível. Confira o valor e os ingressos inclusos antes de continuar.</p><CamaroteMap event={event} {...props} buyLabel="Continuar para pagamento" onBuy={ticket=>{close();props.onBuy?.(ticket)}}/></dialog>,document.body)}</section>
}
