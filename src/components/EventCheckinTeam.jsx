import { useEffect, useState } from 'react'
import { rpc } from '../services/remoteData'

export default function EventCheckinTeam({ event }) {
  const [members,setMembers]=useState([]),[email,setEmail]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('')
  const portariaUrl=new URL(`/admin/evento/${event.id}/checkin`,window.location.origin).href
  async function copyLink(){
    try{await navigator.clipboard.writeText(portariaUrl);setError('');setMessage('Link da portaria copiado.')}catch{setMessage('');setError('Não foi possível copiar automaticamente. Selecione e copie o endereço abaixo.')}
  }
  useEffect(()=>{let active=true;rpc('event_checkin_team',{target_event:event.id}).then(data=>{if(active)setMembers(data||[])}).catch(err=>{if(active)setError(err.message)});return()=>{active=false}},[event.id])
  async function change(memberEmail,enabled){
    if(busy)return
    setBusy(true);setError('');setMessage('')
    try{await rpc('set_event_checkin_member',{target_event:event.id,member_email:memberEmail.trim().toLowerCase(),enabled});setMembers(await rpc('event_checkin_team',{target_event:event.id})||[]);setEmail('');setMessage(enabled?'Acesso à portaria autorizado.':'Acesso removido deste evento.')}
    catch(err){setError(err.message||'Não foi possível salvar o acesso.')}
    finally{setBusy(false)}
  }
  return <section className="admin-panel"><span className="section-kicker">EQUIPE DESTE EVENTO</span><h2>Gerenciar equipe</h2><p>Cada pessoa usa sua própria conta. Adicione o e-mail para autorizar a validação deste evento. Quem ainda não tem conta poderá criar pelo link da portaria e confirmar o e-mail. A equipe não tem acesso a vendas, valores ou financeiro.</p><form onSubmit={e=>{e.preventDefault();change(email,true)}}><label>E-mail da pessoa<input type="email" required autoComplete="off" value={email} onChange={e=>setEmail(e.target.value)} placeholder="pessoa@exemplo.com" disabled={busy}/></label><button className="primary-small" disabled={busy}>{busy?'Salvando…':'Autorizar portaria'}</button></form>{error&&<p role="alert" className="auth-error">{error}</p>}{message&&<p role="status" className="team-success">{message}</p>}<h3>Pessoas autorizadas ({members.length})</h3>{members.map(member=><div className="order-row" key={member.id}><div><strong>{member.name}</strong><p>{member.email} • {member.pending?'Aguardando cadastro ou confirmação':member.active?'Acesso ativo':'Conta desativada'}</p></div><button className="ghost-btn" disabled={busy} onClick={()=>change(member.email,false)}>Remover acesso</button></div>)}<p>Envie à equipe este endereço para entrar com a própria conta:</p><div className="portaria-link"><a href={portariaUrl} style={{overflowWrap:'anywhere'}}>{portariaUrl}</a><button type="button" className="ghost-btn" onClick={copyLink}>Copiar link</button></div></section>
}
