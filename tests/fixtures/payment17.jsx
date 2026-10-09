import React from 'react'
import {createRoot} from 'react-dom/client'
import {BrowserRouter} from 'react-router-dom'
import InlinePayment from '../../src/components/InlinePayment'
import '../../src/App.css'
const confirmed=()=>{document.documentElement.dataset.confirmed='true'}
createRoot(document.getElementById('root')).render(<BrowserRouter><InlinePayment orderId="10000000-0000-4000-8000-000000000001" onConfirmed={confirmed}/></BrowserRouter>)
