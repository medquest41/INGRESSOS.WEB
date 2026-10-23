import React from 'react'
import {createRoot} from 'react-dom/client'
import {MemoryRouter} from 'react-router-dom'
import EventOrderList from '../../src/components/EventOrderList'
import '../../src/index.css'
import '../../src/App.css'
const order={id:'00000000-0000-4000-8000-000000000010',eventId:'synthetic-event',eventTitle:'Evento de teste',eventDate:'01/01/2027',eventTime:'22:00',ticketName:'Camarote 01',batch:'Teste',status:'approved',total:1200,wristbands:10,buyer:{name:'Comprador de teste',phone:'45999999999',email:'synthetic@example.com'},ticketCodes:Array.from({length:10},(_,i)=>({code:'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),used:false,status:'valid'}))}
createRoot(document.getElementById('root')).render(<MemoryRouter><EventOrderList orders={[order]} events={[{id:'synthetic-event',title:'Evento de teste'}]} eventId="synthetic-event" canViewCpf cancelOrder={()=>{throw Error('Unexpected cancellation')}}/></MemoryRouter>)
