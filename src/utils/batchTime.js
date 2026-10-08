export function toBrasiliaInput(value) {
  if (!value || Number.isNaN(new Date(value).getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value))
  const p = Object.fromEntries(parts.map(item => [item.type, item.value]))
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}
export function fromBrasiliaInput(value) {
  if (!value) return ''
  const date = new Date(value + '-03:00')
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}
