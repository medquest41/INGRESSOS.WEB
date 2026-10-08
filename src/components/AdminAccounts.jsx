import { useMemo, useState } from 'react'
import { MailPlus, Search, ShieldCheck, Trash2, UserCog, UserPlus } from 'lucide-react'
import { useAuth } from '../store/AuthStore'
import { useEventStore } from '../store/EventStore'
import { formatCpf } from '../utils/buyerSearch'
import './AdminAccounts.css'

const allowedRoles = [
  ['organizador', 'Organizador'],
  ['financeiro', 'Financeiro'],
  ['checkin', 'Check-in'],
  ['cliente', 'Cliente'],
]

export default function AdminAccounts() {
  const { currentUser, users, organizations = [], invitations = [], isLocalDemo, inviteUser, toggleUserActive, updateUserProfile, deleteUserSafely, changeUserPassword } = useAuth()
  const { orders } = useEventStore()
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [draft, setDraft] = useState({ name: '', email: '', password: '', role: 'organizador', organizerId: '', organizerName: '' })

  const cpfByUser = useMemo(() => {
    const map = new Map()
    for (const order of orders || []) {
      if (order.userId && order.buyer?.cpf && !map.has(String(order.userId))) map.set(String(order.userId), order.buyer.cpf)
    }
    return map
  }, [orders])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\D/g, '')
    const raw = query.trim().toLowerCase()
    if (!raw) return users
    return users.filter(user => {
      const cpf = String(cpfByUser.get(String(user.id)) || '').replace(/\D/g, '')
      return `${user.name || ''} ${user.email || ''} ${user.organizerName || ''}`.toLowerCase().includes(raw) || (q && cpf.includes(q))
    })
  }, [users, query, cpfByUser])

  async function submit(event) {
    event.preventDefault()
    setError(''); setMessage(''); setBusy('invite')
    try {
      const result = await inviteUser(draft)
      setMessage(result?.status === 'existing' ? 'Conta existente vinculada com sucesso.' : isLocalDemo ? 'Conta criada no modo local.' : 'Convite enviado por e-mail. A pessoa cria o acesso pelo link recebido.')
      setDraft({ name: '', email: '', password: '', role: 'organizador', organizerId: '', organizerName: '' })
    } catch (err) { setError(err.message || 'Não foi possível adicionar a conta.') }
    finally { setBusy('') }
  }

  async function recoverPassword(user) {
    setError(''); setMessage('')
    try {
      if (isLocalDemo) {
        const password = window.prompt(`Nova senha para ${user.name} (mínimo 6 caracteres):`)
        if (!password) return
        await changeUserPassword(user.id, password)
        setMessage('Senha local alterada.')
      } else {
        await changeUserPassword(user.id)
        setMessage('Link de recuperação enviado para o e-mail da conta.')
      }
    } catch (err) { setError(err.message || 'Não foi possível iniciar a recuperação de senha.') }
  }

  async function toggle(user) {
    setError(''); setMessage('')
    try { await toggleUserActive(user.id); setMessage(user.active===false?'Conta ativada.':'Conta desativada.') }
    catch (err) { setError(err.message || 'Não foi possível alterar a conta.') }
  }

  async function remove(user) {
    if (!window.confirm(`Excluir/desativar a conta de ${user.name}?\n\nSe houver pedidos ou histórico, os registros serão preservados e a conta será apenas desativada.`)) return
    setError(''); setMessage(''); setBusy('delete:' + user.id)
    try {
      const result = await deleteUserSafely(user.id)
      setMessage(result === 'deactivated_history' ? 'A conta possui histórico e foi desativada com segurança. Pedidos e registros foram preservados.' : 'Conta excluída com sucesso.')
    } catch (err) { setError(err.message || 'Não foi possível excluir a conta.') }
    finally { setBusy('') }
  }

  async function changeRole(user, role) {
    setError(''); setBusy('role:' + user.id)
    try {
      const needsOrg = ['organizador','financeiro','checkin'].includes(role)
      let organizerId = user.organizerId || ''
      if (needsOrg && !organizerId) organizerId = organizations.find(org => org.active !== false)?.id || ''
      const org = organizations.find(item => item.id === organizerId)
      await updateUserProfile(user.id, { role, organizerId, organizerName: org?.name || user.organizerName || '' })
      setMessage('Perfil atualizado.')
    } catch (err) { setError(err.message || 'Não foi possível alterar o perfil.') }
    finally { setBusy('') }
  }

  return <>
    <div className="admin-title"><div><span className="section-kicker">ADMINISTRADOR GERAL</span><h1>Contas.</h1><p className="muted">Adicione acessos, pesquise por nome, e-mail ou CPF e remova contas com proteção do histórico.</p></div></div>

    <div className="accounts-layout">
      <form className="admin-panel account-create-card" onSubmit={submit}>
        <div className="team-card-title"><UserPlus/><div><h2>Adicionar conta</h2><p>{isLocalDemo ? 'Cria um acesso somente neste navegador.' : 'Envia um link para a pessoa entrar sem você precisar criar ou saber a senha dela.'}</p></div></div>
        <div className="form-grid">
          <label>Nome completo<input required value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} /></label>
          <label>E-mail<input required type="email" value={draft.email} onChange={e=>setDraft({...draft,email:e.target.value})} /></label>
          {isLocalDemo && <label>Senha inicial<input required minLength="6" type="password" value={draft.password} onChange={e=>setDraft({...draft,password:e.target.value})}/></label>}
          <label>Tipo de conta<select value={draft.role} onChange={e=>setDraft({...draft,role:e.target.value,organizerId:'',organizerName:''})}>{allowedRoles.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
          {draft.role === 'organizador' && <label className="full">Empresa / organizador<input required={!draft.organizerId} placeholder="Ex.: Alta Temporada Eventos" value={draft.organizerName} onChange={e=>setDraft({...draft,organizerName:e.target.value})}/></label>}
          {['financeiro','checkin'].includes(draft.role) && <label className="full">Organização<select required value={draft.organizerId} onChange={e=>setDraft({...draft,organizerId:e.target.value})}><option value="">Selecione</option>{organizations.filter(o=>o.active!==false).map(o=><option value={o.id} key={o.id}>{o.name}</option>)}</select></label>}
        </div>
        <div className="account-security-note"><ShieldCheck/><span><strong>Sem senha no painel.</strong> Em produção, o acesso é ativado pelo e-mail enviado ao usuário.</span></div>
        <button className="primary-small" disabled={busy==='invite'}>{isLocalDemo ? <UserPlus/> : <MailPlus/>}{busy==='invite'?'Aguarde...':isLocalDemo?'Criar conta local':'Enviar convite'}</button>
      </form>

      <section className="admin-panel account-list-card">
        <div className="account-search"><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar nome, e-mail ou CPF"/></div>
        {error && <div className="auth-error" role="alert">{error}</div>}
        {message && <p className="team-success" role="status">{message}</p>}
        {!isLocalDemo && invitations.filter(i=>i.status==='pending').length>0 && <div className="pending-invites"><strong>Convites pendentes</strong>{invitations.filter(i=>i.status==='pending').map(i=><span key={i.id}>{i.name} • {i.email}</span>)}</div>}
        <div className="account-list">
          {filtered.map(user => {
            const cpf = cpfByUser.get(String(user.id))
            const primary = String(user.email||'').toLowerCase() === 'ingressosaltatemporada@gmail.com'
            return <article key={user.id} className={user.active===false?'account-disabled':''}>
              <div className="team-avatar">{String(user.name||'?').slice(0,1).toUpperCase()}</div>
              <div className="account-copy"><strong>{user.name}</strong><span>{user.email}</span>{cpf && <small>CPF em compras: {formatCpf(cpf)}</small>}<small>{user.organizerName || (primary ? 'Administrador principal' : '')}</small></div>
              <div className="account-actions">
                {primary ? <span className="primary-admin-badge"><ShieldCheck/>Administrador principal</span> : <>
                  <select aria-label={`Perfil de ${user.name}`} value={user.role} disabled={busy==='role:'+user.id} onChange={e=>changeRole(user,e.target.value)}>{allowedRoles.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
                  <button className="ghost-btn" onClick={()=>recoverPassword(user)}><UserCog/>Recuperar senha</button>
                  <button className="ghost-btn" onClick={()=>toggle(user)}>{user.active===false?'Ativar':'Desativar'}</button>
                  <button className="ghost-btn account-delete" disabled={busy==='delete:'+user.id || user.id===currentUser.id} onClick={()=>remove(user)}><Trash2/>Excluir</button>
                </>}
              </div>
            </article>
          })}
          {filtered.length===0 && <p>Nenhuma conta encontrada.</p>}
        </div>
      </section>
    </div>
  </>
}
