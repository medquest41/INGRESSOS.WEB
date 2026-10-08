export const attractionTypes = ['DJ', 'Banda', 'Cantor(a)', 'Show', 'Palestra', 'Apresentação', 'Outro']
export const attractionStatuses = { confirmed: 'Confirmado', planned: 'A confirmar', cancelled: 'Cancelado' }

// Read legacy names without rewriting existing event data.
export function normalizeAttractions(value) {
  if (!Array.isArray(value)) return []
  return value.map((entry, index) => {
    const item = typeof entry === 'string' ? { name: entry, status: 'confirmed' } : entry || {}
    return { ...item, id: item.id || `legacy-${index}`, name: String(item.name || ''), type: item.type || 'Outro',
      date: item.date || '', startTime: item.startTime || '', endTime: item.endTime || '', endsNextDay: Boolean(item.endsNextDay),
      stage: item.stage || '', description: item.description || '', image: item.image || '',
      status: Object.hasOwn(attractionStatuses, item.status) ? item.status : 'planned', visible: item.visible !== false, featured: Boolean(item.featured) }
  })
}

export function attractionImageUrl(value, allowDemo = false) {
  if (!value) return ''
  if (allowDemo && /^data:image\/(png|jpeg|webp|gif);base64,/i.test(value)) return value
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : '' } catch { return '' }
}

export function prepareAttractions(value, allowDemo = false) {
  const items = normalizeAttractions(value)
  if (items.length > 100) throw new Error('Use no máximo 100 atrações por evento.')
  return items.map((item, index) => {
    const name = item.name.trim()
    if (!name || name.length > 120) throw new Error(`Atração ${index + 1}: informe um nome com até 120 caracteres.`)
    for (const field of ['startTime', 'endTime']) {
      if (item[field] && !/^([01]\d|2[0-3]):[0-5]\d$/.test(item[field])) throw new Error(`Atração ${index + 1}: horário inválido.`)
    }
    if (item.date && (!/^\d{4}-\d{2}-\d{2}$/.test(item.date) || Number.isNaN(Date.parse(item.date)) || new Date(item.date).toISOString().slice(0,10) !== item.date)) throw new Error(`Atração ${index + 1}: data inválida.`)
    if (item.startTime && item.endTime && !item.endsNextDay && item.endTime <= item.startTime) throw new Error(`Atração ${index + 1}: o fim deve ser depois do início. Para terminar após meia-noite, marque Termina no dia seguinte.`)
    if (item.image && !attractionImageUrl(item.image, allowDemo)) throw new Error(`Atração ${index + 1}: use uma foto enviada pelo seletor ou um link HTTPS válido.`)
    if (item.description.length > 1000 || item.stage.length > 120) throw new Error(`Atração ${index + 1}: descrição ou palco muito longo.`)
    return { ...item, name, stage: item.stage.trim(), description: item.description.trim(), image: item.image.trim() }
  })
}
