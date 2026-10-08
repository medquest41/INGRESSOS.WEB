import { useState } from 'react'
import { useAuth } from '../store/AuthStore'
import './EventOrganizerField.css'

export default function EventOrganizerField({ value, options, onChange }) {
  const { isLocalDemo, saveOrganization } = useAuth()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState([])
  const allOptions = [...options, ...created.filter(org => !options.some(item => item.id === org.id))]
  const selected = allOptions.some(org => org.id === value) ? value : ''

  async function create() {
    const label = name.trim()
    if (label.length < 2 || label.length > 120) {
      setError('Digite o nome do organizador com 2 a 120 caracteres.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const id = await saveOrganization({ name: label, active: true })
      if (typeof id !== 'string' || !id) throw new Error('Não foi possível confirmar o cadastro do organizador.')
      const org = { id, name: label }
      setCreated(items => [...items, org])
      onChange(org)
      setName('')
      setCreating(false)
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  return <div className="event-organizer-field">
    <label>Organizador
      <select aria-label="Organizador" value={selected} onChange={e => onChange(allOptions.find(org => org.id === e.target.value) || { id: '', name: '' })}>
        <option value="">{allOptions.length ? 'Selecione um organizador' : 'Nenhum organizador cadastrado'}</option>
        {allOptions.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
      </select>
    </label>
    <small>Selecione a empresa responsável pelo evento.</small>
    {!isLocalDemo && !creating && <button type="button" className="ghost-btn" onClick={() => { setCreating(true); setError('') }}>Cadastrar organizador</button>}
    {creating && <div>
      <label>Nome do novo organizador<input autoFocus maxLength={120} disabled={saving} value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Ingressos Alta Temporada" /></label>
      <button type="button" className="primary-small" disabled={saving} onClick={create}>{saving ? 'Cadastrando...' : 'Salvar organizador'}</button>
      <button type="button" className="ghost-btn" disabled={saving} onClick={() => { setCreating(false); setError('') }}>Cancelar cadastro</button>
    </div>}
    {error && <p role="alert" className="auth-error">{error}</p>}
  </div>
}
