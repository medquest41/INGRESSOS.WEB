import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, LockKeyhole, Mail, ShieldCheck, Sparkles, UserRound } from 'lucide-react'
import Brand from '../components/Brand'
import { useAuth } from '../store/AuthStore'

export default function Login() {
  const { currentUser, needsSetup, setupAdmin, login, registerCustomer } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [register, setRegister] = useState(false)
  const setup = needsSetup && (location.state?.from || '').startsWith('/admin')

  const destination = location.state?.from || '/ingressos'

  if (currentUser) return <Navigate to={currentUser.role === 'cliente' && destination === '/admin' ? '/ingressos' : destination} replace />

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')

    try {
      if (setup) {
        await setupAdmin(form)
      } else if (register) {
        await registerCustomer(form)
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
          <h1>{setup ? 'Crie o administrador principal.' : 'Controle sua operação.'}</h1>
          <p>
            {setup
              ? 'Este primeiro cadastro cria o acesso principal do sistema. Depois você poderá adicionar organizadores, financeiro e equipe de check-in pelo próprio painel.'
              : 'Entre com seu e-mail e senha para acessar eventos, vendas, links de divulgação e check-in.'}
          </p>

          <div className="auth-feature-list">
            <div><ShieldCheck /><span><strong>Acessos por perfil</strong><small>Admin, organizador, financeiro e check-in.</small></span></div>
            <div><LockKeyhole /><span><strong>Área administrativa protegida</strong><small>O painel deixa de ficar aberto para qualquer visitante.</small></span></div>
          </div>
        </section>

        <form className="auth-card" onSubmit={submit}>
          <div className="auth-card-icon"><ShieldCheck /></div>
          <span>{setup ? 'CONFIGURAÇÃO INICIAL' : 'ACESSO AO PAINEL'}</span>
          <h2>{setup ? 'Administrador principal' : 'Entrar'}</h2>

          {(setup || register) && (
            <label>
              Seu nome
              <div className="auth-input"><UserRound /><input required autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome do administrador" /></div>
            </label>
          )}

          <label>
            E-mail
            <div className="auth-input"><Mail /><input required type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="seu@email.com" /></div>
          </label>

          <label>
            Senha
            <div className="auth-input"><LockKeyhole /><input required minLength={6} type="password" autoComplete={setup ? 'new-password' : 'current-password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mínimo de 6 caracteres" /></div>
          </label>

          {error && <div className="auth-error">{error}</div>}
          {!setup && <button type="button" className="ghost-btn" onClick={() => setRegister(!register)}>{register ? 'Já tenho conta — entrar' : 'Criar conta de cliente'}</button>}

          <button className="checkout-button" disabled={busy}>
            {busy ? 'Aguarde...' : setup ? 'Criar administrador' : register ? 'Criar conta' : 'Entrar'}
            {!busy && <ArrowRight size={18} />}
          </button>

          <small className="auth-local-note">
            Segurança local de desenvolvimento. Antes da publicação, este login será conectado ao Supabase para autenticação real no servidor.
          </small>
        </form>
      </main>
    </div>
  )
}
