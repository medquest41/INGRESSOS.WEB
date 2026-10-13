import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cropRect } from '../utils/imageCrop'
import './ImageCropEditor.css'

export default function ImageCropEditor({ src, initialRatio = 16 / 9, onCancel, onApply }) {
  const canvas = useRef(null)
  const image = useRef(null)
  const drag = useRef(null)
  const dialog = useRef(null)
  const [ratio, setRatio] = useState(initialRatio)
  const [position, setPosition] = useState({ x: 50, y: 50, zoom: 1 })
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    const previous = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.current?.focus()
    return () => { document.body.style.overflow = overflow; previous?.focus() }
  }, [])
  useEffect(() => {
    let active = true
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => { if (active) { image.current = img; setReady(true) } }
    img.onerror = () => { if (active) setError('Este link não permite editar a imagem. Envie o arquivo pelo botão Escolher imagem.') }
    img.src = src
    return () => { active = false }
  }, [src])
  useEffect(() => {
    if (!ready || !canvas.current) return
    const target = canvas.current
    target.width = 1600
    target.height = Math.round(1600 / ratio)
    const rect = cropRect(image.current.naturalWidth, image.current.naturalHeight, ratio, position)
    target.getContext('2d').drawImage(image.current, rect.x, rect.y, rect.width, rect.height, 0, 0, target.width, target.height)
  }, [ready, ratio, position])
  async function apply() {
    setSaving(true)
    setError('')
    try {
      const blob = await new Promise((resolve, reject) => {
        canvas.current.toBlob(result => result ? resolve(result) : reject(new Error('Não foi possível preparar o recorte.')), 'image/png')
      })
      await onApply(new File([blob], 'imagem-recortada.png', { type: 'image/png' }))
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }
  function move(event) {
    if (!drag.current) return
    const box = canvas.current.getBoundingClientRect()
    const start = drag.current
    setPosition(p => ({ ...p, x: Math.max(0, Math.min(100, start.x - (event.clientX - start.clientX) / box.width * 100)), y: Math.max(0, Math.min(100, start.y - (event.clientY - start.clientY) / box.height * 100)) }))
  }
  function keyboard(event) {
    if (event.key === 'Escape') { event.preventDefault(); if (!saving) onCancel() }
    if (event.key === 'Tab') {
      const nodes = [...dialog.current.querySelectorAll('button:not(:disabled),select:not(:disabled),input:not(:disabled)')]
      const first = nodes[0], last = nodes[nodes.length - 1]
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
  }
  return createPortal(<div className="image-crop-overlay">
    <section ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="image-crop-title" className="image-crop-dialog" onKeyDown={keyboard}>
      <h2 id="image-crop-title">Ajustar enquadramento</h2>
      <p>Arraste a foto ou use os controles para escolher a parte que aparece. A imagem original será preservada.</p>
      <label>Formato<select disabled={saving} value={ratio} onChange={e => { setRatio(Number(e.target.value)); setPosition({ x: 50, y: 50, zoom: 1 }) }}>
        <option value={16 / 9}>Capa horizontal (16:9)</option><option value={1}>Quadrado (1:1)</option><option value={4 / 5}>Retrato (4:5)</option>
      </select></label>
      {!ready && !error && <p role="status">Carregando imagem...</p>}
      <canvas ref={canvas} className="image-crop-canvas" aria-label="Prévia do recorte; use os controles abaixo para ajustar" style={{ aspectRatio: ratio }}
        onPointerDown={e => { if (!ready || saving) return; drag.current = { ...position, clientX: e.clientX, clientY: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId) }}
        onPointerMove={move} onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }} />
      <div className="image-crop-controls">{[['zoom', 'Zoom', 1, 3, .05], ['x', 'Posição horizontal', 0, 100, 1], ['y', 'Posição vertical', 0, 100, 1]].map(([key, label, min, max, step]) =>
        <label key={key}>{label}<input type="range" min={min} max={max} step={step} value={position[key]} disabled={!ready || saving} onChange={e => setPosition(p => ({ ...p, [key]: Number(e.target.value) }))}/></label>)}</div>
      <small>O recorte preenche o formato escolhido. No celular, a capa pode ter um corte adicional nas laterais.</small>
      {error && <p role="alert">{error}</p>}
      <div className="image-crop-actions"><button type="button" disabled={saving} onClick={onCancel}>Cancelar</button><button type="button" disabled={!ready || saving} onClick={() => setPosition({ x: 50, y: 50, zoom: 1 })}>Centralizar</button><button type="button" disabled={!ready || saving} onClick={apply}>{saving ? 'Aplicando...' : 'Aplicar recorte'}</button></div>
    </section>
  </div>, document.body)
}
