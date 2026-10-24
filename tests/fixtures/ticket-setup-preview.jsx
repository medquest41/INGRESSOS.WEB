import {editTicketDraft} from '../../src/utils/groupUpgrade'
import React,{useState} from 'react'
import {createRoot} from 'react-dom/client'
import ReservedUnitGenerator from '../../src/components/ReservedUnitGenerator'
import TicketBatchEditor from '../../src/components/TicketBatchEditor'
import CamaroteMap from '../../src/components/CamaroteMap'
import {validateTicketDrafts} from '../../src/utils/reservedUnits'
import '../../src/index.css'
import '../../src/App.css'
const legacy=new URLSearchParams(location.search).has('legacy')
const original=legacy?{id:'existing',name:'Camarote existente',type:'individual',price:1200,available:50}:{id:'existing',name:'Camarote existente',type:'camarote',price:1200,available:1,wristbands:10}
export default function Preview(){const[event,setEvent]=useState({id:'synthetic',ticketTypes:[original]}),[error,setError]=useState('');return <main style={{maxWidth:1000,margin:'auto',padding:16}}><ReservedUnitGenerator event={event} onChange={setEvent}/>{event.ticketTypes.map((ticket,index)=><TicketBatchEditor key={ticket.id} ticket={ticket} index={index} isLocalDemo={!legacy} onChange={(field,value)=>setEvent(current=>editTicketDraft(current,index,field,value,{originalTickets:[original],orders:legacy?[{ticketId:original.id}]:[]}))} onRemove={()=>setEvent(current=>({...current,ticketTypes:current.ticketTypes.filter(t=>t.id!==ticket.id)}))}/>)}<button type="button" onClick={()=>{try{validateTicketDrafts(event.ticketTypes);setError('Válido')}catch(e){setError(e.message)}}}>Validar rascunho de teste</button><p data-testid="draft-status">{error}</p><CamaroteMap local event={event} onSelect={()=>{}}/></main>}
createRoot(document.getElementById('root')).render(<Preview/> )
