import CelebrationFireworks from './CelebrationFireworks'
import {useEffect,useRef,useState} from 'react'
import {celebrationCopy} from '../utils/purchaseCelebration'
import './PurchaseCelebration.css'
export default function PurchaseCelebration({order,event}){
 const dialog=useRef(null),[closed,setClosed]=useState(false)
 const key='ingressos_celebrated_v1:'+order.id
 const [seen]=useState(()=>{try{return sessionStorage.getItem(key)==='1'}catch{return false}})
 useEffect(()=>{if(seen||closed)return;dialog.current?.showModal();try{sessionStorage.setItem(key,'1')}catch{/* Optional, session-only display preference. */}},[key,seen,closed])
 if(seen||closed)return null
 const copy=celebrationCopy(order,event)
 function close(){dialog.current?.close();setClosed(true)}
 return <dialog ref={dialog} className="purchase-celebration" aria-labelledby="purchase-celebration-title" onCancel={close}><CelebrationFireworks/><button type="button" className="celebration-close" aria-label="Fechar comemoração" onClick={close}>×</button><span className="celebration-emblem" aria-hidden="true">✦</span><p className="celebration-kicker">COMPRA CONFIRMADA</p><h2 id="purchase-celebration-title">{copy.title}</h2><p className="celebration-place">{copy.place} está te esperando!</p><p>Prepare-se para viver momentos inesquecíveis em <strong>{copy.event}</strong>.</p><p className="celebration-tickets">{order.ticketCodes.length===1?'Seu ingresso já está disponível.':`Seus ${order.ticketCodes.length} ingressos já estão disponíveis.`}</p><button type="button" className="celebration-cta" onClick={close}>Ver meus ingressos →</button></dialog>
}
