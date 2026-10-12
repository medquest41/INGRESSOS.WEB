import {useEffect,useRef,useState} from 'react'
import {Link} from 'react-router-dom'
import {Timer} from 'lucide-react'
import './ReservationDeadline.css'
export default function ReservationDeadline({seconds,deadline,status,onCheck}){
 const dialog=useRef(null),[dismissed,setDismissed]=useState(''),checked=useRef('')
 const terminal=['approved','cancelled','refunded','review','rejected','charged_back','confirming','in_process','authorized'].includes(status)
 const expired=seconds===0||status==='expired'
 const key=deadline+':'+(expired?'expired':'warning')
 const show=Boolean(deadline&&!terminal&&(expired||seconds<=120)&&dismissed!==key)
 useEffect(()=>{const el=dialog.current;if(!el)return;if(show&&!el.open)el.showModal();if(!show&&el.open)el.close();return()=>{if(el.open)el.close()}},[show])
 useEffect(()=>{if(expired&&deadline&&!terminal&&checked.current!==deadline){checked.current=deadline;onCheck?.()}},[expired,deadline,terminal,onCheck])
 if(!deadline||terminal)return null
 const time=Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0')
 return <><div className={'reservation-clock '+(expired?'expired':seconds<=120?'urgent':'')}><Timer size={23} aria-hidden="true"/><div><strong>{expired?'Prazo da reserva encerrado':'Tempo para concluir o pagamento'}</strong><span>{expired?'Confira o status antes de tentar novamente.':time}</span></div></div><dialog ref={dialog} className="reservation-warning" aria-labelledby="reservation-warning-title" aria-describedby="reservation-warning-text" onCancel={()=>setDismissed(key)}><Timer size={42} aria-hidden="true"/><h2 id="reservation-warning-title">{expired?'O prazo da sua reserva terminou':'Seu tempo de compra está acabando'}</h2><p id="reservation-warning-text">{expired?'Não pague o código vencido. Confira seus pedidos: se você já pagou, aguarde a confirmação antes de fazer outra compra.':'Faltam '+time+' para concluir o pagamento. A reserva segue o prazo informado pelo sistema de pagamento.'}</p><p>{expired?'Seus dados preenchidos continuam salvos neste navegador. Uma nova compra depende da disponibilidade de ingressos.':'O prazo não pode ser prorrogado nesta compra. Conclua o pagamento antes de o tempo terminar.'}</p>{expired?<Link className="checkout-button" to="/ingressos">Conferir meus pedidos</Link>:<button type="button" className="checkout-button" onClick={()=>setDismissed(key)}>Continuar meu pagamento</button>}<button type="button" className="ghost-btn" onClick={()=>{setDismissed(key);onCheck?.()}}>Já paguei — verificar pagamento</button><button type="button" className="ghost-btn" onClick={()=>setDismissed(key)}>Fechar aviso</button></dialog></>
}
