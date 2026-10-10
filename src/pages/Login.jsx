import { legalCatalog, acceptanceClaims } from '../services/legal'
import './LegalDocument.css'
import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, LockKeyhole, Mail, ShieldCheck, Sparkles, UserRound } from 'lucide-react'
import Brand from '../components/Brand'
import { validateBuyer } from '../utils/commerce'
import { authDestination } from '../utils/authReturn'
import { PRIMARY_ADMIN_EMAIL, useAuth } from '../store/AuthStore'

export default function Login() {
  const { currentUser, needsSetup, setupAdmin, login, registerCustomer, resetPassword, loading, isLocalDemo } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ name: '', email: '', password: '',cpf:'',phone:'',birthDate:'',emailConfirmation:'' })
  const [error, setError] = useState(()=>new URLSearchParams(location.hash.slice(1)).get('error_description')||'')
  const [legal,setLegal]=useState(null)
  const [termsAccepted,setTermsAccepted]=useState(false)
  const [marketing,setMarketing]=useState(false)
  useEffect(()=>{let active=true;legalCatalog().then(c=>{if(active)setLegal(c)}).catch(()=>{});return()=>{active=false}},[])
  const [notice,setNotice]=useState('')
  const [busy, setBusy] = useState(false)
  const [register, setRegister] = useState(new URLSearchParams(location.search).get('cadastro')==='1')
  const setup = needsSetup && (location.state?.from || '').startsWith('/admin')

  const destination = authDestination(location.search, location.state?.from)
  const portaria = /^\/admin\/evento\/[^/]+\/checkin$/.test(destination)

  if (loading) return <div className="empty-page" role="status">Verificando sessão...</div>

  if (currentUser && !currentUser.guest) return <Navigate to={destination} replace />

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('');setNotice('')

    try {
      if (setup) {
        await setupAdmin({ ...form, email: PRIMARY_ADMIN_EMAIL })
      } else if (register) {
        if(!termsAccepted)throw Error('Aceite os Termos de Uso para criar a conta.');
        const legalAcceptances=acceptanceClaims(legal,['termos','privacidade']);
        validateBuyer(form);if(form.email.trim().toLowerCase()!==form.emailConfirmation.trim().toLowerCase())throw Error('Os e-mails não coincidem.');
        const response = await registerCustomer({ ...form, legalAcceptances, marketing, returnTo: destination })
        if (response?.confirmationRequired) { setNotice(portaria?'Cadastro recebido. Confirme seu e-mail para ativar a conta e voltar à validação deste evento. Use o mesmo e-mail autorizado pelo organizador.':'Cadastro recebido. Confirme seu e-mail antes de entrar. Depois você também poderá criar seu próprio evento.'); setRegister(false); return }
      } else {
        await login(form.email, form.password)
      }
      navigate(destination, { replace: true })
    } catch (err) {
      setError(err.message || 'Não foi possível entrar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-orb auth-orb-one" />
      <div className="auth-orb auth-orb-two" />

      <header className="auth-header">
        <Link to="/" className="event-back"><ArrowLeft size={18} />Voltar ao site</Link>
        <Brand />
        <div />
      </header>

      <main className="auth-wrap">
        <section className="auth-copy">
          <span className="section-kicker"><Sparkles size={14} />ÁREA RESTRITA</span>
          <h1>{setup ? 'Crie o administrador principal.' : portaria ? 'Acesso à portaria do evento.' : 'Seu próximo rolê começa aqui.'}</h1>
          <p>
            {setup
              ? 'Este primeiro cadastro cria o acesso principal do sistema. Depois você poderá adicionar organizadores, financeiro e equipe de check-in pelo próprio painel.'
              : portaria ? 'Já tem conta? Entre abaixo. Se ainda não tem, escolha Criar conta e use o e-mail autorizado pelo organizador. Depois da confirmação, você poderá validar os ingressos deste evento.' : 'Entre para acompanhar seus ingressos e descobrir novas experiências.'}
          </p>

          <div className="auth-feature-list">
            <div><ShieldCheck /><span><strong>Acessos por perfil</strong><small>Admin, organizador, financeiro e check-in.</small></span></div>
            <div><LockKeyhole /><span><strong>Área administrativa protegida</strong><small>O painel deixa de ficar aberto para qualquer visitante.</small></span></div>
          </div>
        </section>

        <form className="auth-card" onSubmit={submit}>
          <div className="auth-card-icon"><ShieldCheck /></div>
          <span>{setup ? 'CONFIGURAÇÃO INICIAL' : portaria ? 'PORTARIA • SOMENTE VALIDAÇÃO' : 'ACESSO AO PAINEL'}</span>
          <h2>{setup ? 'Administrador principal' : register ? 'Criar conta' : 'Entrar'}</h2>

          {(setup || register) && (
            <label>
              Seu nome
              <div className="auth-input"><UserRound /><input required autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={setup ? "Nome do administrador" : "Nome de usuário"} /></div>
            </label>
          )}

          <label>
            E-mail
            <div className="auth-input"><Mail /><input required type="email" autoComplete="email" readOnly={setup} value={setup ? PRIMARY_ADMIN_EMAIL : form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="seu@email.com" /></div>
          </label>

          <label>
            Senha
            <div className="auth-input"><LockKeyhole /><input required minLength={register&&!isLocalDemo?8:6} type="password" autoComplete={setup||register ? 'new-password' : 'current-password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mínimo de 6 caracteres" /></div>
          </label>

          {register&&[['cpf','CPF','text'],['birthDate','Data de nascimento','date'],['phone','Celular com DDD','tel'],['emailConfirmation','Confirmar e-mail','email']].map(([key,label,type])=><label key={key}>{label}<input required type={type} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})}/></label>)}
          {register&&<div className="legal-controls"><label className="legal-choice"><input type="checkbox" required checked={termsAccepted} onChange={e=>setTermsAccepted(e.target.checked)}/><span>Li e concordo com os <Link to="/institucional/termos" target="_blank" rel="noopener noreferrer">Termos de Uso</Link> e estou ciente da <Link to="/institucional/privacidade" target="_blank" rel="noopener noreferrer">Política de Privacidade</Link>.</span></label><label className="legal-choice"><input type="checkbox" checked={marketing} onChange={e=>setMarketing(e.target.checked)}/><span>Desejo receber novidades, ofertas e informações sobre eventos.</span></label>{!legal?.ready&&<p role="status">Documentos em revisão. O cadastro com aceite será liberado após a aprovação das versões oficiais.</p>}</div>}
          {error && <div className="auth-error" role="alert">{error}</div>}
          {notice && <p className="team-success" role="status">{notice}</p>}
          {!isLocalDemo && <button type="button" className="ghost-btn" disabled={busy} onClick={async()=>{setBusy(true);try{if(!form.email)throw new Error('Informe seu e-mail acima.');await resetPassword(form.email);setError('');setNotice('Se houver uma conta, você receberá o link de recuperação.')}catch(err){setError(err.message)}finally{setBusy(false)}}}>Esqueci minha senha</button>}
          {!setup && <button type="button" className="ghost-btn" onClick={() => setRegister(!register)}>{register ? 'Já tenho conta — entrar' : 'Criar conta'}</button>}

          <button className="checkout-button" disabled={busy||(register&&(!termsAccepted||!legal?.ready))}>
            {busy ? 'Aguarde...' : setup ? 'Criar administrador' : register ? 'Criar conta' : 'Entrar'}
            {!busy && <ArrowRight size={18} />}
          </button>

          <small className="auth-local-note">
            {isLocalDemo ? 'Demonstração local de desenvolvimento.' : 'Acesso protegido pelo Supabase. Confirme seu e-mail após o cadastro.'}
          </small>
        </form>
      </main>
    </div>
  )
}
