import {useState} from 'react'
import {venueMapUrl} from '../utils/venueMap'
import './VenueMap.css'
export default function VenueMap({event,local=false,expanded=false}){
 const [failed,setFailed]=useState(false)
 let url
 try{url=venueMapUrl(event.venueMapImage,{local})}catch{return null}
 if(!url)return null
 return <details className="venue-map-public" open={expanded}><summary>{event.venueMapTitle||'Mapa do evento • veja os setores'}</summary><p>Confira a localização dos setores antes de escolher seu ingresso.</p>{failed?<p>Não foi possível carregar o mapa. Consulte o organizador pelo WhatsApp do evento.</p>:<a href={url} target="_blank" rel="noopener noreferrer" aria-label="Ampliar mapa do evento em nova aba"><img src={url} alt={event.venueMapDescription||'Mapa dos setores do evento '+event.title} loading="lazy" onError={()=>setFailed(true)}/><span>Ampliar mapa ↗</span></a>}{event.venueMapDescription&&<p className="venue-map-description">{event.venueMapDescription}</p>}<small>Mapa de orientação. Confira o setor descrito no ingresso selecionado.</small></details>
}
