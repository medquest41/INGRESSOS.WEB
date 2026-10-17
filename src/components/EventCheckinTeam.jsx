/* oxlint-disable react/set-state-in-effect -- Reset the remote team list when its event changes. */
import { useEffect, useRef, useState } from 'react'
import { rpc } from '../services/remoteData'

export default function EventCheckinTeam({ event }) {
  const [members, setMembers] = useState([])
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const lock = useRef(false)
  const generation = useRef(0)
  const portariaUrl = new URL('/admin/evento/' + event.id + '/checkin', window.location.origin).href
  useEffect(() => {
    let live = true
    const id = ++generation.current
    setLoading(true); setReady(false); setMembers([]); setError(''); setMessage('')
    rpc('event_checkin_team_v18', { target_event: event.id })
      .then(data => { if (live && id === generation.current) { setMembers(data || []); setReady(true) } })
      .catch(err => { if (live && id === generation.current) setError(err.message?.includes('event_checkin_team_v18') ? 'Ativação do banco pendente: aplique o SQL da atualização 18 e atualize esta lista.' : err.message) })
      .finally(() => { if (live && id === generation.current) setLoading(false) })
    return () => { live = false; generation.current = id + 1 }
  }, [event.id, revision])
  async function change(memberEmail, enabled, remove = false) {
    if (lock.current || !ready) return
    lock.current = true; setBusy(true); setError(''); setMessage('')
    const id = generation.current
    try {
      await rpc(remove ? 'remove_event_checkin_member' : 'set_event_checkin_member', {
        target_event: event.id, member_email: memberEmail.trim().toLowerCase(), ...(remove ? {} : { enabled }),
      })
      const rows = await rpc('event_checkin_team_v18', { target_event: event.id })
      if (id !== generation.current) return
      setMembers(rows || []); setEmail('')
      setMessage(remove ? 'Acesso removido deste evento.' : enabled ? 'Acesso ao check-in ativado neste evento.' : 'Acesso ao check-in desativado neste evento.')
    } catch (err) { if (id === generation.current) setError(err.message || 'Não foi possível salvar o acesso. Tente novamente.') }
    finally { lock.current = false; setBusy(false) }
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(portariaUrl); setMessage('Link da portaria copiado.'); setError('') }
    catch { setError('Não foi possível copiar automaticamente. Selecione e copie o endereço abaixo.') }
  }
  return <section className="admin-panel" aria-busy={loading || busy}>
    <span className="section-kicker">EQUIPE DESTE EVENTO</span><h2>Gerenciar equipe</h2>
    <p>O mesmo e-mail pode ser autorizado em vários eventos. Autorize o e-mail usado pela pessoa na própria conta. Se ainda não tiver conta, o convite será reconhecido após o cadastro e a confirmação desse e-mail. O acesso permite somente o check-in deste evento.</p>
    <form onSubmit={e => { e.preventDefault(); change(email, true) }}>
      <label>E-mail da pessoa<input type="email" required autoComplete="off" value={email} onChange={e => setEmail(e.target.value)} placeholder="pessoa@exemplo.com" disabled={busy || loading || !ready} /></label>
      <button className="primary-small" disabled={busy || loading || !ready}>{busy ? 'Salvando…' : 'Autorizar portaria'}</button>
    </form>
    {error && <div role="alert" className="auth-error">{error} <button type="button" disabled={busy || loading} onClick={() => setRevision(v => v + 1)}>Atualizar lista</button></div>}
    {message && <p role="status" className="team-success">{message}</p>}
    <h3>Pessoas autorizadas ({members.length})</h3>
    {loading ? <p role="status">Carregando equipe…</p> : !error && members.length === 0 ? <p>Nenhuma pessoa autorizada neste evento.</p> : null}
    {members.map(member => <div className="order-row" key={member.id}>
      <div><strong>{member.name || member.email}</strong><p>{member.email} • {member.active ? 'Ativo' : 'Inativo'}</p>
        {member.pending && <p>Aguardando cadastro ou confirmação do e-mail.</p>}
        {member.inheritedAccess && <p>Esta conta também possui acesso de gestão neste evento. Estes controles alteram somente o vínculo de portaria.</p>}
        {member.accountActive === false && <p>Conta desativada pelo administrador.</p>}
      </div>
      <button type="button" className="ghost-btn" disabled={busy || loading || !ready} onClick={() => change(member.email, !member.active)}>{member.active ? 'Desativar' : 'Ativar'}</button>
      <button type="button" className="ghost-btn" disabled={busy || loading || !ready} onClick={() => change(member.email, false, true)}>Remover acesso</button>
    </div>)}
    <p>Envie à equipe este endereço para entrar com a própria conta:</p>
    <div className="portaria-link"><a href={portariaUrl} style={{ overflowWrap: 'anywhere' }}>{portariaUrl}</a><button type="button" className="ghost-btn" onClick={copyLink}>Copiar link</button></div>
  </section>
}
