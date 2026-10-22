import {useEffect,useState} from 'react'
import {rpc} from '../services/remoteData'
import {venueMapUrl} from '../utils/venueMap'
import './CamaroteMap.css'

const labels={available:'Disponível',reserved:'Reservado',sold:'Vendido',blocked:'Bloqueado',unavailable:'Indisponível'}
const brl=n=>Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
export default function CamaroteMap({event,getRemaining=()=>1,onSelect,selectedId,editor=false,onMove,local=false}){
 const [editingId,setEditingId]=useState(''),[statuses,setStatuses]=useState({}),[selected,setSelected]=useState('')
 const rooms=(event.ticketTypes||[]).filter(t=>t.type==='camarote')
 const hasRooms=rooms.length>0
 useEffect(()=>{
  if(editor||local||!hasRooms)return
  let active=true
  const refresh=()=>rpc('camarote_availability',{target:event.id}).then(rows=>{if(active)setStatuses(Object.fromEntries(rows.map(r=>[r.id,r.status])))}).catch(()=>{if(active)setStatuses({})})
  refresh();const timer=setInterval(refresh,15000)
  return()=>{active=false;clearInterval(timer)}
 },[event.id,editor,local,hasRooms])
 if(!hasRooms)return null
 let url='';try{url=venueMapUrl(event.venueMapImage,{local})}catch{/* schematic remains usable */}
 const status=t=>t.active===false?'blocked':statuses[t.id]||(getRemaining(event,t)>0?'available':'unavailable')
 const current=rooms.find(t=>t.id===(editor?editingId:selected||selectedId))
 return <section className="camarote-section" aria-label={editor?'Posicionar camarotes':'Escolha seu camarote'}>
  <h2>{editor?'Posicione os camarotes':'Escolha seu camarote'}</h2>
  <p>{editor?'Selecione o número e toque na planta. Ajuste também pelos campos abaixo.':'Uma compra reserva o camarote inteiro. A disponibilidade é confirmada pelo servidor ao continuar o checkout.'}</p>
  {editor&&<label>Camarote a posicionar<select value={editingId} onChange={e=>setEditingId(e.target.value)}><option value="">Selecione</option>{rooms.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}
  <div className={'camarote-map '+(!url?'schematic':'')} onClick={editor?e=>{if(!editingId)return;const rect=e.currentTarget.getBoundingClientRect();onMove(editingId,Math.round((e.clientX-rect.left)/rect.width*100),Math.round((e.clientY-rect.top)/rect.height*100))}:undefined}>
   {url?<img src={url} alt={event.venueMapDescription||'Planta do evento'}/>:<div className="camarote-stage">PALCO / ÁREA PRINCIPAL</div>}
   {rooms.map((t,i)=><button type="button" key={t.id} style={{left:(t.mapX??(15+(i%4)*23))+'%',top:(t.mapY??(40+Math.floor(i/4)*18)%90)+'%'}} className={'camarote-pin '+status(t)+(current?.id===t.id?' chosen':'')} disabled={!editor&&status(t)!=='available'} aria-label={t.name+' • '+labels[status(t)]+' • '+brl(t.price)+' • '+(t.wristbands||8)+' pulseiras'} aria-pressed={current?.id===t.id} onClick={e=>{e.stopPropagation();if(editor)setEditingId(t.id);else{setSelected(t.id);onSelect?.(t)}}}>{t.name}</button>)}
  </div>
  <p className="camarote-legend">● Disponível · ● Reservado · ● Vendido · ● Bloqueado</p>
  {current&&<div className="camarote-detail" role="status"><strong>{current.name} • {brl(current.price)}</strong><p>{current.wristbands||8} pulseiras individuais • {labels[status(current)]}</p>{editor&&<div className="form-grid">{['mapX','mapY'].map(key=><label key={key}>{key==='mapX'?'Posição horizontal (%)':'Posição vertical (%)'}<input type="number" min="0" max="100" value={current[key]??50} onChange={e=>onMove(current.id,key==='mapX'?Number(e.target.value):Number(current.mapX??50),key==='mapY'?Number(e.target.value):Number(current.mapY??50))}/></label>)}</div>}</div>}
  <div className="camarote-list">{rooms.map(t=><button type="button" key={t.id} disabled={!editor&&status(t)!=='available'} onClick={()=>editor?setEditingId(t.id):(setSelected(t.id),onSelect?.(t))}>{t.name} • {brl(t.price)} • {t.wristbands||8} pulseiras • {labels[status(t)]}</button>)}</div>
 </section>
}
