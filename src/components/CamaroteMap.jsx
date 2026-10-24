import {unitKind,getReservedCategories} from '../utils/reservedUnits'
import {useEffect,useLayoutEffect,useRef,useState} from 'react'
import {rpc} from '../services/remoteData'
import {venueMapUrl} from '../utils/venueMap'
import './CamaroteMap.css'

const labels={available:'Disponível',reserved:'Reservado',sold:'Vendido',blocked:'Bloqueado',unavailable:'Indisponível'}
const brl=n=>Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
export default function CamaroteMap({event,getRemaining=()=>1,onSelect,onBuy,selectedId,readOnly=false,editor=false,onMove,local=false}){
 const [editingId,setEditingId]=useState(''),[statuses,setStatuses]=useState({}),[selected,setSelected]=useState(''),[category,setCategory]=useState(''),[zoom,setZoom]=useState(1),[mapRatio,setMapRatio]=useState(1.6)
 const viewport=useRef(null),chosenPin=useRef(null)
 const currentId=editor?editingId:readOnly?selectedId:selected||selectedId
 const rooms=(event.ticketTypes||[]).filter(t=>t.type==='camarote'&&(editor||!t.retiredForSales))
 const categories=getReservedCategories(event).filter(c=>rooms.some(t=>unitKind(t)===c.id))
 const selectedRoom=rooms.find(t=>t.id===selectedId)
 const activeCategory=readOnly&&selectedRoom?unitKind(selectedRoom):category|| (selectedRoom?unitKind(selectedRoom):categories[0]?.id)||''
 const visibleRooms=editor?rooms:rooms.filter(t=>unitKind(t)===activeCategory)
 const hasRooms=rooms.length>0
 useEffect(()=>{
  if(editor||local||!hasRooms)return
  let active=true
  const refresh=()=>rpc('camarote_availability',{target:event.id}).then(rows=>{if(active)setStatuses(Object.fromEntries(rows.map(r=>[r.id,r.status])))}).catch(()=>{if(active)setStatuses({})})
  refresh();const timer=setInterval(refresh,15000)
  return()=>{active=false;clearInterval(timer)}
 },[event.id,editor,local,hasRooms])
 useLayoutEffect(()=>{if(viewport.current&&chosenPin.current)viewport.current.scrollLeft=Math.max(0,chosenPin.current.offsetLeft-viewport.current.clientWidth/2)},[currentId,zoom,activeCategory,mapRatio])
 if(!hasRooms)return null
 let url='';try{url=venueMapUrl(event.venueMapImage,{local})}catch{/* schematic remains usable */}
 const status=t=>t.active===false?'blocked':statuses[t.id]||(getRemaining(event,t)>0?'available':'unavailable')
 const current=visibleRooms.find(t=>t.id===currentId)
 return <section className={'camarote-section'+(editor?' editor-mode':'')} id="unidades-numeradas" aria-label={editor?'Posicionar unidades numeradas':readOnly?'Mapa da unidade escolhida':'Escolha sua unidade numerada'}>
  <h2>{editor?'Posicione as unidades numeradas':readOnly?'Confira sua unidade no mapa':event.venueMapTitle||'Camarotes, mesas e unidades numeradas'}</h2>
  <p>{editor?'Selecione o número e toque na planta. Ajuste também pelos campos abaixo.':readOnly?'A unidade destacada corresponde à sua compra. Confira o número antes do pagamento.':'Escolha a categoria e toque no número desejado. O preço é pela unidade inteira, com a quantidade de ingressos informada.'}</p>
  {!editor&&!readOnly&&<div className="reserved-categories">{categories.map(({id:kind,name:label})=><button type="button" className="ghost-btn" key={kind} aria-pressed={activeCategory===kind} onClick={()=>{setCategory(kind);setSelected('')}}>{label} • {rooms.filter(t=>unitKind(t)===kind&&status(t)==='available').length} disponíveis</button>)}</div>}
  {(editor||activeCategory)&&<>
  {editor&&<label>Unidade a posicionar<select value={editingId} onChange={e=>setEditingId(e.target.value)}><option value="">Selecione</option>{rooms.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}
  <p className="muted">Deslize o mapa para os lados ou use a ampliação para conferir os números.</p><label className="reserved-zoom">Ampliar mapa<input type="range" min="1" max="3" step="0.5" value={zoom} onChange={e=>setZoom(Number(e.target.value))}/><output>{Math.round(zoom*100)}%</output></label>{editor&&<button type="button" className="ghost-btn" onClick={()=>{setZoom(1);if(viewport.current){viewport.current.scrollLeft=0;viewport.current.scrollTop=0}}}>Ajustar à tela</button>}<div ref={viewport} className="reserved-map-scroll" tabIndex={0} role="region" aria-label="Mapa navegável: deslize para ver os números"><div style={{width:editor?`min(${zoom*100}%, ${mapRatio*440*zoom}px, ${mapRatio*48*zoom}vh)`:zoom===1?'100%':(zoom*100)+'%'}} className={'camarote-map '+(!url?'schematic':'has-image')} onClick={editor?e=>{if(!editingId)return;const rect=e.currentTarget.getBoundingClientRect();onMove(editingId,Math.round((e.clientX-rect.left)/rect.width*100),Math.round((e.clientY-rect.top)/rect.height*100))}:undefined}>
   {url?<img onLoad={e=>{if(e.currentTarget.naturalWidth&&e.currentTarget.naturalHeight)setMapRatio(e.currentTarget.naturalWidth/e.currentTarget.naturalHeight);if(viewport.current&&chosenPin.current)viewport.current.scrollLeft=Math.max(0,chosenPin.current.offsetLeft-viewport.current.clientWidth/2)}} src={url} alt={event.venueMapDescription||'Planta do evento'}/>:<div className="camarote-stage">PALCO / ÁREA PRINCIPAL</div>}
   {visibleRooms.map((t,i)=><button type="button" key={t.id} ref={current?.id===t.id?chosenPin:null} style={{left:(t.mapX??(15+(i%4)*23))+'%',top:(t.mapY??(40+Math.floor(i/4)*18)%90)+'%'}} className={'camarote-pin '+status(t)+(current?.id===t.id?' chosen':'')} disabled={!editor&&(readOnly||status(t)!=='available')} aria-label={t.name+' • '+labels[status(t)]+' • '+brl(t.price)+' • '+(t.wristbands||8)+' pulseiras'} aria-pressed={current?.id===t.id} onClick={e=>{e.stopPropagation();if(editor)setEditingId(t.id);else{setSelected(t.id);onSelect?.(t)}}}>{t.unitNumber||t.name}</button>)}
  </div>
  </div>
  {url&&<p><a className="ghost-btn" href={url} target="_blank" rel="noopener noreferrer">Ver planta original enviada ↗</a><small> A mesma imagem cadastrada pelo organizador, sem os marcadores do site.</small></p>}
  {event.venueMapDescription&&<p>{event.venueMapDescription}</p>}
  <p className="camarote-legend">● Disponível · ● Reservado · ● Vendido · ● Bloqueado</p>
  {current&&<div className="camarote-detail" role="status"><strong>{current.name} • {brl(current.price)}</strong><p>{current.wristbands||8} ingressos individuais • {readOnly?'Unidade selecionada':labels[status(current)]}</p>{!editor&&!readOnly&&onBuy&&<button type="button" className="primary-small" disabled={status(current)!=='available'} onClick={()=>onBuy(current)}>Comprar {current.name}</button>}{editor&&<div className="form-grid">{['mapX','mapY'].map(key=><label key={key}>{key==='mapX'?'Posição horizontal (%)':'Posição vertical (%)'}<input type="number" min="0" max="100" value={current[key]??50} onChange={e=>onMove(current.id,key==='mapX'?Number(e.target.value):Number(current.mapX??50),key==='mapY'?Number(e.target.value):Number(current.mapY??50))}/></label>)}</div>}</div>}
  {!readOnly&&<details className="camarote-list-toggle"><summary>Escolher pela lista de nomes e números</summary><div className="camarote-list">{visibleRooms.map(t=><button type="button" key={t.id} disabled={!editor&&(readOnly||status(t)!=='available')} onClick={()=>editor?setEditingId(t.id):(setSelected(t.id),onSelect?.(t))}>{t.name} • {brl(t.price)} • {t.wristbands||8} pulseiras • {labels[status(t)]}</button>)}</div></details>}
 </>}
 </section>
}
