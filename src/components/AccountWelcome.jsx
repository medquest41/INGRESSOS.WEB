import {useEffect,useRef,useState} from 'react'
import {useAuth} from '../store/AuthStore'
import {readAuthWelcome,clearAuthWelcome} from '../utils/authWelcome'
import './AccountWelcome.css'
function WelcomeDialog({user,kind}){
 const dialog=useRef(null),[closed,setClosed]=useState(false)
 useEffect(()=>{dialog.current?.showModal();clearAuthWelcome()},[])
 if(closed)return null
 function close(){dialog.current?.close();setClosed(true)}
 const name=String(user.name||'').trim().split(/\s+/)[0]
 return <dialog ref={dialog} className="account-welcome" aria-labelledby="account-welcome-title" onCancel={close}><button type="button" className="account-welcome-close" aria-label="Fechar boas-vindas" onClick={close}>×</button><div className="account-welcome-medal" aria-hidden="true">✦</div><p className="section-kicker">{kind==='signup'?'CONTA PRONTA':'ACESSO CONFIRMADO'}</p><h2 id="account-welcome-title">{kind==='signup'?'Bem-vindo':'Que bom ter você aqui'}{name?', '+name:''}!</h2><p>Sua próxima experiência começa agora.</p><button type="button" className="primary-cta" onClick={close}>Continuar →</button></dialog>
}
export default function AccountWelcome(){
 const {currentUser}=useAuth(),[attempt,setAttempt]=useState(readAuthWelcome)
 useEffect(()=>{const read=()=>setAttempt(readAuthWelcome());window.addEventListener('ingressos-auth-welcome',read);return()=>window.removeEventListener('ingressos-auth-welcome',read)},[])
 if(!attempt||!currentUser||currentUser.guest||currentUser.active===false)return null
 return <WelcomeDialog key={currentUser.id+':'+attempt.at} user={currentUser} kind={attempt.kind}/>
}
