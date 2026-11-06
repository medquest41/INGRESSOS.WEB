import React from 'react'
import {createRoot} from 'react-dom/client'
import PurchaseCelebration from '../../src/components/PurchaseCelebration'
import '../../src/index.css'
createRoot(document.getElementById('root')).render(<><h1>Meus ingressos</h1><PurchaseCelebration order={{id:'synthetic-paid',eventTitle:'Réveillon 2027',buyer:{name:'Ana Oliveira'},ticketCodes:Array.from({length:4},()=>({status:'valid'}))}} event={{location:'Praia Zucco'}}/></>)
