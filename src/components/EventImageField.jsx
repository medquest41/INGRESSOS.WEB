import { useEffect, useRef, useState } from 'react'
import { supabase, isLocalDemo } from '../lib/supabase'
import { validateImageFile } from '../utils/imageFile'
import './EventImageField.css'

export default function EventImageField({ value, organizationId, onChange, onBusyChange, label = 'Imagem do evento', disabled = false }) {
  const fileInput = useRef(null)
  const busyRef = useRef(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; onBusyChange(false) } }, [onBusyChange])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [previewFailed, setPreviewFailed] = useState(false)
  async function upload(file) {
    if (busyRef.current || disabled) return
    busyRef.current = true
    setBusy(true)
    onBusyChange(true)
    setMessage('')
    try {
      const extension = validateImageFile(file)
      let url
      if (isLocalDemo) {
        url = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result)
          reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'))
          reader.readAsDataURL(file)
        })
      } else {
        if (!/^[0-9a-f-]{36}$/i.test(organizationId || '')) throw new Error('Selecione ou cadastre o organizador antes de enviar a imagem.')
        const path = `${organizationId}/${crypto.randomUUID()}.${extension}`
        const { error } = await supabase.storage.from('event-images').upload(path, file, { contentType: file.type, cacheControl: '3600', upsert: false })
        if (error) throw new Error(`Não foi possível enviar a imagem: ${error.message}. Confira se ATIVAR-UPLOAD-IMAGENS.sql foi executado no Supabase.`)
        url = supabase.storage.from('event-images').getPublicUrl(path).data.publicUrl
      }
      if (!mounted.current) return
      onChange(url)
      setPreviewFailed(false)
      setMessage('Imagem pronta. Clique em Salvar para vinculá-la ao evento.')
    } catch (err) { setMessage(err.message) }
    finally { busyRef.current = false; setBusy(false); onBusyChange(false) }
  }
  function paste(event) {
    const file = Array.from(event.clipboardData?.files || []).find(item => item.type.startsWith('image/'))
    if (file) { event.preventDefault(); void upload(file) }
  }
  return <div className="event-image-field" onPaste={paste}>
    <span>{label}</span>
    <div className="event-image-actions">
      <button type="button" className="ghost-btn" disabled={busy || disabled} onClick={() => fileInput.current?.click()}>{busy ? 'Enviando imagem...' : 'Escolher imagem nos arquivos'}</button>
      <input ref={fileInput} hidden type="file" disabled={busy || disabled} accept="image/jpeg,image/png,image/webp,image/gif" aria-label={'Arquivo da ' + label.toLowerCase()} onChange={e => { const file = e.target.files?.[0]; if (file) void upload(file); e.target.value = '' }} />
    </div>
    <label>Colar imagem com Ctrl+V<input disabled={busy || disabled} placeholder="Clique aqui e cole a imagem copiada" onChange={() => {}} value="" /></label>
    <small>No celular, use Escolher imagem. JPG, PNG, WebP ou GIF, até 8 MB. Use somente imagens públicas autorizadas para divulgação.</small>
    <label>Ou cole o link da imagem<input disabled={busy || disabled} type="url" value={value || ''} onChange={e => { onChange(e.target.value); setPreviewFailed(false) }} placeholder="https://..." /></label>
    {value && !previewFailed && <img className="event-image-preview" src={value} alt={'Prévia: ' + label.toLowerCase()} onError={() => setPreviewFailed(true)} />}
    {value && <button type="button" className="ghost-btn" disabled={busy || disabled} onClick={() => { onChange(''); setPreviewFailed(false) }}>Remover imagem</button>}
    {previewFailed && <p>Não foi possível visualizar essa imagem. Confira o arquivo ou o link.</p>}
    {message && <p role="status">{message}</p>}
  </div>
}
