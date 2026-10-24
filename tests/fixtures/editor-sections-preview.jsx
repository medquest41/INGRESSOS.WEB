import React,{useState} from 'react'
import {createRoot} from 'react-dom/client'
import EditorSection from '../../src/components/EditorSection'
import ExperienceEditor from '../../src/components/ExperienceEditor'
import '../../src/index.css'
export default function Preview(){const[event,setEvent]=useState({rules:'Regra original',vipLists:[]});return <main style={{maxWidth:1000,margin:'auto',padding:16}}><EditorSection title="Informações principais"><input aria-label="Nome do evento" defaultValue="Evento de teste"/></EditorSection><ExperienceEditor event={event} onChange={setEvent} isPrimaryAdmin/><EditorSection title="Ingressos e preços"><input aria-label="Preço de teste" defaultValue="100"/></EditorSection></main>}
createRoot(document.getElementById('root')).render(<Preview/> )

