/* oxlint-disable react/set-state-in-effect -- Synchronize the selected event. */
import { useEffect, useState } from 'react'
import { Percent, Save, ShieldCheck } from 'lucide-react'

const clampPercent = value => Math.min(100, Math.max(0, Number(value) || 0))

export default function EventFeeSettings({ event, isPrimaryAdmin = false, saveEvent }) {
  const [percent, setPercent] = useState(() => Number(event?.feeRate ?? 0.1) * 100)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const isAdmin = isPrimaryAdmin
  const canEdit = isAdmin

  useEffect(() => {
    setPercent(Number(event?.feeRate ?? 0.1) * 100)
    setMessage('')
  }, [event?.id, event?.feeRate, event?.feeEditableByOrganizer])

  if (!event) return null

  async function save() {
    if (!canEdit || busy) return
    setBusy(true)
    setMessage('')
    try {
      await saveEvent({
        ...event,
        feeRate: clampPercent(percent) / 100,
        feeEditableByOrganizer: false,
      })
      setMessage('Taxa salva com sucesso.')
    } catch (error) {
      setMessage(error.message || 'Não foi possível salvar a taxa.')
    } finally {
      setBusy(false)
    }
  }

  const preview = 100 * clampPercent(percent) / 100
  return <>
    <div className="admin-title"><div><span className="section-kicker">CONFIGURAÇÃO FINANCEIRA</span><h1>Taxa da plataforma.</h1></div></div>
    <section className="admin-panel fee-settings-card">
      <div className="team-card-title"><Percent/><div><h2>Taxa deste evento</h2><p>Todo evento começa em 10%. O valor abaixo vale somente para este evento.</p></div></div>
      <div className="form-grid">
        <label>Percentual da plataforma (%)
          <input type="number" inputMode="decimal" min="0" max="100" step="0.01" value={percent} disabled={!canEdit || busy} onChange={e => setPercent(e.target.value)} />
        </label>
        <label>Prévia para R$ 100,00 em ingressos
          <input value={`R$ ${preview.toFixed(2).replace('.', ',')}`} disabled readOnly />
        </label>
      </div>
      <div className="fee-security-note"><ShieldCheck size={18}/><span><strong>Protegido no banco.</strong> Somente o administrador principal altera o percentual, inclusive em solicitações enviadas manualmente ao banco.</span></div>
      <button className="primary-small" disabled={!canEdit || busy} onClick={save}><Save size={17}/>{busy ? 'Salvando...' : 'Salvar taxa'}</button>
      {message && <p role="status" className="team-success">{message}</p>}
    </section>
  </>
}
