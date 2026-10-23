import {unitKind,getReservedCategories} from '../utils/reservedUnits'
import {useEffect,useState} from 'react'
import {rpc} from '../services/remoteData'
import {venueMapUrl} from '../utils/venueMap'
import './CamaroteMap.css'

const labels={available:'Disponível',reserved:'Reservado',sold:'Vendido',blocked:'Bloqueado',unavailable:'Indisponível'}
const brl=n=>Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
export default function CamaroteMap({event,getRemaining=()=>1,onSelect,selectedId,editor=false,onMove,local=false}){
 const [editingId,setEditingId]=useState(''),[statuses,setStatuses]=useState({}),[selected,setSelected]=useState(''),[category,setCategory]=useState(''),[zoom,setZoom]=useState(1)
 const rooms=(event.ticketTypes||[]).filter(t=>t.type==='camarote')
 const visibleRooms=editor?rooms:rooms.filter(t=>unitKind(t)===category)
 const categories=getReservedCategories(event).filter(c=>rooms.some(t=>unitKind(t)===c.id))
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
 const current=visibleRooms.find(t=>t.id===(editor?editingId:selected||selectedId))
 return <section className="camarote-section" id="unidades-numeradas" aria-label={editor?'Posicionar unidades numeradas':'Escolha sua unidade numerada'}>
  <h2>{editor?'Posicione as unidades numeradas':'Escolha sua unidade numerada'}</h2>
  <p>{editor?'Selecione o número e toque na planta. Ajuste também pelos campos abaixo.':'Cada número corresponde a uma unidade inteira. A disponibilidade é confirmada pelo servidor ao continuar o checkout.'}</p>
  {!editor&&<div className="reserved-categories">{categories.map(({id:kind,name:label})=><button type="button" className="ghost-btn" key={kind} aria-pressed={category===kind} onClick={()=>{setCategory(kind);setSelected('')}}>{label} • {rooms.filter(t=>unitKind(t)===kind&&status(t)==='available').length} disponíveis</button>)}</div>}
  {(editor||category)&&<>
  {editor&&<label>Unidade a posicionar<select value={editingId} onChange={e=>setEditingId(e.target.value)}><option value="">Selecione</option>{rooms.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}
  <label className="reserved-zoom">Ampliar mapa<input type="range" min="1" max="3" step="0.5" value={zoom} onChange={e=>setZoom(Number(e.target.value))}/></label><div className="reserved-map-scroll" tabIndex={0} role="region" aria-label="Mapa navegável: deslize para ver os números"><div style={{width:zoom===1?'100%':(zoom*100)+'%'}} className={'camarote-map '+(!url?'schematic':'')} onClick={editor?e=>{if(!editingId)return;const rect=e.currentTarget.getBoundingClientRect();onMove(editingId,Math.round((e.clientX-rect.left)/rect.width*100),Math.round((e.clientY-rect.top)/rect.height*100))}:undefined}>
   {url?<img src={url} alt={event.venueMapDescription||'Planta do evento'}/>:<div className="camarote-stage">PALCO / ÁREA PRINCIPAL</div>}
   {visibleRooms.map((t,i)=><button type="button" key={t.id} style={{left:(t.mapX??(15+(i%4)*23))+'%',top:(t.mapY??(40+Math.floor(i/4)*18)%90)+'%'}} className={'camarote-pin '+status(t)+(current?.id===t.id?' chosen':'')} disabled={!editor&&status(t)!=='available'} aria-label={t.name+' • '+labels[status(t)]+' • '+brl(t.price)+' • '+(t.wristbands||8)+' pulseiras'} aria-pressed={current?.id===t.id} onClick={e=>{e.stopPropagation();if(editor)setEditingId(t.id);else{setSelected(t.id);onSelect?.(t)}}}>{t.unitNumber||t.name}</button>)}
  </div>
  </div>
  <p className="camarote-legend">● Disponível · ● Reservado · ● Vendido · ● Bloqueado</p>
  {current&&<div className="camarote-detail" role="status"><strong>{current.name} • {brl(current.price)}</strong><p>{current.wristbands||8} ingressos individuais • {labels[status(current)]}</p>{editor&&<div className="form-grid">{['mapX','mapY'].map(key=><label key={key}>{key==='mapX'?'Posição horizontal (%)':'Posição vertical (%)'}<input type="number" min="0" max="100" value={current[key]??50} onChange={e=>onMove(current.id,key==='mapX'?Number(e.target.value):Number(current.mapX??50),key==='mapY'?Number(e.target.value):Number(current.mapY??50))}/></label>)}</div>}</div>}
  <div className="camarote-list">{visibleRooms.map(t=><button type="button" key={t.id} disabled={!editor&&status(t)!=='available'} onClick={()=>editor?setEditingId(t.id):(setSelected(t.id),onSelect?.(t))}>{t.name} • {brl(t.price)} • {t.wristbands||8} pulseiras • {labels[status(t)]}</button>)}</div>
 </>}
 </section>
}
