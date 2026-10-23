import React,{useState} from 'react'
import {createRoot} from 'react-dom/client'
import ReservedUnitGenerator from '../../src/components/ReservedUnitGenerator'
import TicketBatchEditor from '../../src/components/TicketBatchEditor'
import CamaroteMap from '../../src/components/CamaroteMap'
import {validateTicketDrafts} from '../../src/utils/reservedUnits'
import '../../src/index.css'
import '../../src/App.css'
export default function Preview(){const[event,setEvent]=useState({id:'synthetic',ticketTypes:[{id:'existing',name:'Camarote existente',type:'camarote',price:1200,available:1,wristbands:10}]}),[error,setError]=useState('');return <main style={{maxWidth:1000,margin:'auto',padding:16}}><ReservedUnitGenerator event={event} onChange={setEvent}/>{event.ticketTypes.map((ticket,index)=><TicketBatchEditor key={ticket.id} ticket={ticket} index={index} isLocalDemo onChange={(field,value)=>setEvent(current=>({...current,ticketTypes:current.ticketTypes.map(t=>t.id===ticket.id?{...t,[field]:value}:t)}))} onRemove={()=>setEvent(current=>({...current,ticketTypes:current.ticketTypes.filter(t=>t.id!==ticket.id)}))}/>)}<button type="button" onClick={()=>{try{validateTicketDrafts(event.ticketTypes);setError('Válido')}catch(e){setError(e.message)}}}>Validar rascunho de teste</button><p data-testid="draft-status">{error}</p><CamaroteMap local event={event} onSelect={()=>{}}/></main>}
createRoot(document.getElementById('root')).render(<Preview/> )
