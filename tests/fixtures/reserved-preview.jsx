import '../../src/index.css'
import '../../src/App.css'
import React,{useState} from 'react'
import {createRoot} from 'react-dom/client'
import CamaroteMap from '../../src/components/CamaroteMap'
import ReservedUnitGenerator from '../../src/components/ReservedUnitGenerator'
import {generateReservedUnits} from '../../src/utils/reservedUnits'
export default function Preview(){const[event,setEvent]=useState({id:'synthetic',ticketTypes:generateReservedUnits(generateReservedUnits([],{kind:'camarote',count:15,start:1,price:1200,wristbands:10}),{kind:'table',count:20,start:1,price:400,wristbands:4})}),[selected,setSelected]=useState(null);return <><ReservedUnitGenerator event={event} onChange={setEvent}/><CamaroteMap local event={event} getRemaining={(_,t)=>t.name==='Camarote 02'?0:1} onSelect={setSelected}/><p data-testid="selected">{selected?.name}</p></>}
createRoot(document.getElementById('root')).render(<Preview/> )

