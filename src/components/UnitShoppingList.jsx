import {scheduledTicketRelease} from '../utils/ticketRelease'
import TicketJewels from './TicketJewels'
import {ticketHighlightLabel,ticketHighlightValue} from '../utils/ticketPresentation'
import '../pages/TicketHighlights.css'
import {useState} from 'react'
import {unitMarkerLabel,filterUnits} from '../utils/unitSelection'
const brl=n=>Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
export default function UnitShoppingList({units,event,status,now,selectedId,onSelect,disabled=false,numberOnly=false}){
 const[query,setQuery]=useState(''),[availableOnly,setAvailableOnly]=useState(true),[sort,setSort]=useState('number')
 const matches=filterUnits(units,{query,availableOnly,sort,status:t=>scheduledTicketRelease(t,now)?'available':status(t)})
 return <aside className="unit-shopping-list" aria-label="Lista de unidades"><h3>Escolha pelo número</h3><label>Buscar nome ou número<input type="search" value={query} placeholder={numberOnly?'Ex.: 1 ou 10':'Ex.: 15 ou Camarote 15'} onChange={e=>setQuery(e.target.value)}/></label><div className="unit-list-filters"><label className="unit-available-check"><input type="checkbox" checked={availableOnly} onChange={e=>setAvailableOnly(e.target.checked)}/>Só disponíveis</label><label>Ordenar<select value={sort} onChange={e=>setSort(e.target.value)}><option value="number">Número / nome</option><option value="price">Menor preço</option></select></label></div><p className="muted" role="status">{matches.length} opções encontradas</p><div className={'unit-results'+(numberOnly?' unit-number-grid':'')}>{matches.map(t=>{
  const release=scheduledTicketRelease(t,now)
  return <button key={t.id} data-upcoming={release?'true':undefined} data-highlight={ticketHighlightValue(t,event)||undefined} type="button" disabled={disabled||status(t)!=='available'||!!release} aria-pressed={selectedId===t.id} onClick={()=>onSelect(t)}><TicketJewels/><span><strong>{numberOnly?'Mesa '+String(unitMarkerLabel(t)).padStart(2,'0'):t.name}</strong>{ticketHighlightLabel(t,event)&&<small className="unit-highlight-label">{ticketHighlightLabel(t,event)}</small>}<small>{t.wristbands} ingressos individuais inclusos</small></span><span><strong>{brl(t.price)}</strong>{release?<small className="unit-release-note">Vendas abrem em <time dateTime={release.iso}>{release.label}</time></small>:<small>{status(t)==='available'?'Disponível':status(t)==='reserved'?'Reservado':'Indisponível'}</small>}</span></button>
 })}</div>{!matches.length&&<div className="unit-empty"><p>Nenhuma unidade corresponde aos filtros.</p><button type="button" className="ghost-btn" onClick={()=>{setQuery('');setAvailableOnly(false)}}>Ver todos os números</button></div>}</aside>
}
