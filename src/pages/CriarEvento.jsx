import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Building2, Percent, ShieldCheck, Sparkles } from 'lucide-react'
import Brand from '../components/Brand'
import { useAuth } from '../store/AuthStore'
import './CriarEvento.css'

export default function CriarEvento(){
  const { currentUser, loading, becomeOrganizer, isLocalDemo }=useAuth()
  const [name,setName]=useState('')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  if(loading)return <div className="empty-page">Verificando sua conta...</div>
  const hasPanel=currentUser&&['admin','organizador','financeiro','checkin'].includes(currentUser.role)
  async function create(){
    setBusy(true);setError('')
    try{await becomeOrganizer(name);window.location.assign('/admin?tab=events')}
    catch(err){setError(err.message||'Não foi possível criar seu espaço de organizador.')}
    finally{setBusy(false)}
  }
  return <div className="organizer-onboarding">
    <header className="simple-header"><Link to="/" className="event-back"><ArrowLeft/>Voltar</Link><Brand/><div/></header>
    <main className="organizer-onboarding-wrap">
      <section className="organizer-intro"><span className="section-kicker"><Sparkles/>PARA ORGANIZADORES</span><h1>Crie seu evento e acompanhe tudo em um só lugar.</h1><p>Cadastre o evento, configure lotes e ingressos, acompanhe vendas, clientes, financeiro, cupons e faça check-in pelo celular.</p><div className="organizer-benefits"><div><Building2/><span><strong>Seu próprio painel</strong><small>Você vê apenas seus eventos e sua operação.</small></span></div><div><Percent/><span><strong>Taxa padrão de 10%</strong><small>O percentual é definido pela plataforma e não pode ser alterado pelo organizador.</small></span></div><div><ShieldCheck/><span><strong>Permissões protegidas</strong><small>Configurações exclusivas do Administrador Geral continuam bloqueadas.</small></span></div></div></section>
      <section className="admin-panel organizer-start-card">
        {!currentUser?<><span className="section-kicker">PRIMEIRO PASSO</span><h2>Entre ou crie sua conta</h2><p>Depois de confirmar seu e-mail, você poderá criar sua organização e o primeiro evento.</p><Link className="primary-cta" to="/login" state={{from:'/criar-evento'}}>Entrar / criar conta <ArrowRight/></Link></>:hasPanel?<><span className="section-kicker">SUA CONTA</span><h2>{currentUser.role==='organizador'?'Seu painel já está liberado.':'Acessar painel'}</h2><p>{currentUser.role==='organizador'?'Crie e gerencie seus eventos, clientes e vendas.':'Este perfil já possui acesso administrativo.'}</p><Link className="primary-cta" to="/admin">Abrir meu painel <ArrowRight/></Link></>:<><span className="section-kicker">CRIAR ORGANIZAÇÃO</span><h2>Como seu evento será identificado?</h2><p>Use o nome da empresa, produtora, festa ou responsável pelos eventos.</p><label>Nome do organizador / empresa<input autoFocus minLength="2" maxLength="120" value={name} onChange={e=>setName(e.target.value)} placeholder="Ex.: Alta Temporada Eventos"/></label>{error&&<div className="auth-error">{error}</div>}<button className="primary-cta" disabled={busy||name.trim().length<2} onClick={create}>{busy?'Criando...':'Criar meu espaço'} {!busy&&<ArrowRight/>}</button><small>{isLocalDemo?'Modo local: alteração válida somente neste navegador.':'Ao continuar, sua conta de cliente passa a ter perfil de organizador.'}</small></>}
      </section>
    </main>
  </div>
}
