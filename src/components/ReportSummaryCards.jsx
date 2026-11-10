import {useEffect,useRef,useState} from 'react'
import {Link} from 'react-router-dom'
import {MoreVertical,ArrowUpRight} from 'lucide-react'
import {reportMetrics,reportOrdersHref,reportAmount,matchesOrderStatus} from '../utils/orderReport'
import './ReportSummaryCards.css'
const brl=value=>Number(value||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
export default function ReportSummaryCards({sales,eventId=''}){
 const [open,setOpen]=useState(null),root=useRef(null),buttons=useRef({})
 useEffect(()=>{
  function close(event){if(!root.current?.contains(event.target))setOpen(null)}
  function escape(event){if(event.key==='Escape'){setOpen(null);buttons.current[open]?.focus()}}
  document.addEventListener('pointerdown',close);document.addEventListener('keydown',escape)
  return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',escape)}
 },[open])
 return <div ref={root} className="admin-stats report-summary-cards">{reportMetrics.map(metric=>{
  const rows=sales.filter(order=>matchesOrderStatus(order,metric.status))
  const value=metric.key==='cancelled'?rows.length:brl(rows.reduce((sum,order)=>sum+reportAmount(order,metric.key),0))
  return <div key={metric.key} className={'report-summary-card'+(open===metric.key?' report-menu-open':'')}><span>{metric.label}</span><strong>{value}</strong><button ref={node=>{buttons.current[metric.key]=node}} type="button" className="report-card-menu-button" aria-label={'Opções de '+metric.label} aria-expanded={open===metric.key} aria-controls={'report-menu-'+metric.key} onClick={()=>setOpen(open===metric.key?null:metric.key)}><MoreVertical aria-hidden="true"/></button>{open===metric.key&&<nav id={'report-menu-'+metric.key} className="report-card-menu" aria-label={'Ações de '+metric.label}><Link to={reportOrdersHref(eventId,metric)} onClick={()=>setOpen(null)}><ArrowUpRight aria-hidden="true"/>{metric.action}</Link></nav>}</div>
 })}</div>
}
