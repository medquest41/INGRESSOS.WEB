import React,{useState} from 'react'
import {createRoot} from 'react-dom/client'
import EditorSection from '../../src/components/EditorSection'
import TicketBatchEditor from '../../src/components/TicketBatchEditor'
import {validateTicketDrafts} from '../../src/utils/reservedUnits'
import {eventSaveError,focusEditorError} from '../../src/utils/eventSaveError'
import '../../src/index.css'
export default function Preview(){const[tickets,setTickets]=useState([0,1].map(i=>({id:String(i),name:'Camarote 01',type:'camarote',available:1,price:100,wristbands:15}))),[message,setMessage]=useState('');function save(){try{validateTicketDrafts(tickets);setMessage('Salvo no teste')}catch(e){const friendly=eventSaveError(e);setMessage(friendly.message);requestAnimationFrame(()=>focusEditorError(friendly.message,`.ticket-batch-editor[data-ticket-index="${e.ticketIndex}"] [data-field="${e.field}"]`))}}return <main className="event-editor" style={{maxWidth:900,margin:'auto',padding:16}}><button onClick={save}>Salvar teste</button>{message&&<p className="event-save-error" role="alert" tabIndex={-1}>{message}</p>}<EditorSection title="Ingressos e preços">{tickets.map((ticket,index)=><TicketBatchEditor key={ticket.id} ticket={ticket} index={index} isLocalDemo onRemove={()=>{}} onChange={(field,value)=>setTickets(previous=>previous.map((t,i)=>i===index?{...t,[field]:value}:t))}/>)}</EditorSection></main>}
createRoot(document.getElementById('root')).render(<Preview/> )
