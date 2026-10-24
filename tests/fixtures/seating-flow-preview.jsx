import React,{useState} from 'react'
import {createRoot} from 'react-dom/client'
import {MemoryRouter} from 'react-router-dom'
import EventSeating from '../../src/components/EventSeating'
import CheckoutSeating from '../../src/components/CheckoutSeating'
import VenueMapEditor from '../../src/components/VenueMapEditor'
import {generateReservedUnits} from '../../src/utils/reservedUnits'
import '../../src/index.css'
import '../../src/App.css'
const uploadedPlan=new URLSearchParams(location.search).has('photo')?'https://mapa.example.test/planta-enviada.svg':''
const initial={venueMapImage:uploadedPlan,id:'synthetic',slug:'evento-de-teste',title:'Evento de teste',venueMapTitle:'Escolha seu camarote ou mesa VIP',ticketTypes:new URLSearchParams(location.search).has('empty')?[]:generateReservedUnits(generateReservedUnits([],{kind:'camarote',count:15,start:1,price:1200,wristbands:15}),{kind:'table',count:20,start:1,price:400,wristbands:4})}
export default function Preview(){
 const [event,setEvent]=useState(()=>JSON.parse(localStorage.getItem('synthetic-seating-preview')||'null')||initial),[view,setView]=useState('public'),[selected,setSelected]=useState(null)
 return <MemoryRouter><main style={{maxWidth:1050,margin:'auto',padding:16}}><nav><button onClick={()=>setView('public')}>Visualizar evento</button><button onClick={()=>setView('admin')}>Configurar mapa</button></nav>{view==='public'?<><section data-testid="attractions"><h2>Atrações de teste</h2></section><EventSeating local event={event} getRemaining={(_,t)=>t.name==='Camarote 02'?0:1} selectedId={selected?.id} onSelect={setSelected} onBuy={ticket=>{setSelected(ticket);setView('checkout')}}/><section data-testid="sales"><h2>Ingressos disponíveis</h2></section></>:view==='checkout'?<><h1>Dados da compra</h1><CheckoutSeating event={event} ticket={selected} getRemaining={()=>1} local/><label>Nome do comprador<input/></label></>:<><VenueMapEditor event={event} organizationId="00000000-0000-4000-8000-000000000001" onChange={setEvent} onBusyChange={()=>{}}/><button onClick={()=>localStorage.setItem('synthetic-seating-preview',JSON.stringify(event))}>Salvar rascunho sintético</button></>}</main></MemoryRouter>
}
createRoot(document.getElementById('root')).render(<Preview/> )
