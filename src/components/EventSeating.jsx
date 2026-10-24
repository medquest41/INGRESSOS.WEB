import EventLocationPreview from './EventLocationPreview'
import {venueMapUrl} from '../utils/venueMap'
import {useEffect,useRef,useState} from 'react'
import {createPortal} from 'react-dom'
import CamaroteMap from './CamaroteMap'
import VenueMap from './VenueMap'
import './EventSeating.css'
export default function EventSeating({event,openRequest=0,...props}){
 const dialog=useRef(null)
 const [opened,setOpened]=useState(false),[failedPreview,setFailedPreview]=useState('')
 let previewUrl='';try{previewUrl=venueMapUrl(event.venueMapImage,{local:props.local})}catch{/* Selection remains available without a preview. */}
 const imageFailed=!!previewUrl&&failedPreview===previewUrl
 function open(){setOpened(true);dialog.current?.showModal()}
 const numbered=event.ticketTypes?.some(t=>t.type==='camarote'&&!t.retiredForSales)
 useEffect(()=>{if((openRequest||window.location.hash==='#unidades-numeradas')&&numbered&&!dialog.current?.open)open()},[openRequest,numbered])
 if(!numbered)return <div className="event-seating event-map-location-layout"><VenueMap event={event} local={props.local} expanded/><EventLocationPreview event={event}/></div>
 function close(){dialog.current?.close();setOpened(false)}
 return <section className="event-seating seating-preview" id="escolher-unidade"><div className="event-map-location-layout"><div className="seating-map-preview">{previewUrl&&!imageFailed&&<button type="button" className="seating-plan-thumbnail" onClick={open} aria-label="Ampliar mapa e escolher unidade"><img src={previewUrl} alt={'Mapa do evento '+event.title} loading="lazy" onError={()=>setFailedPreview(previewUrl)}/><span>Toque para ampliar e escolher</span></button>}<div className="seating-preview-copy"><span className="section-kicker">MAPA DO EVENTO</span><h2>{event.venueMapTitle||'Escolha seu camarote, mesa ou grupo'}</h2><p>{imageFailed?'A prévia não carregou. Você pode escolher sua unidade pela lista.':'Compare a posição dos espaços e escolha o número no mapa ou na lista.'}</p><button className="primary-small" type="button" onClick={open}>Ver mapa e escolher número</button></div></div><EventLocationPreview event={event}/></div>{createPortal(<dialog onClose={()=>setOpened(false)} ref={dialog} className="seating-dialog" aria-labelledby="seating-dialog-title"><header><h2 id="seating-dialog-title">Escolha sua unidade</h2><button type="button" className="ghost-btn" onClick={close} aria-label="Fechar seleção de unidade">Fechar ✕</button></header><p>Selecione uma categoria e um número disponível. Confira o valor e os ingressos inclusos antes de continuar.</p>{opened&&<CamaroteMap event={event} {...props} buyLabel="Continuar para pagamento" onBuy={ticket=>{close();props.onBuy?.(ticket)}}/>}</dialog>,document.body)}</section>
}
