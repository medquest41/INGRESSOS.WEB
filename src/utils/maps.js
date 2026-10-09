export function normalizeMapsUrl(value) {
  const text = String(value || '').trim()
  if (!text) return ''
  try {
    const url = new URL(text)
    const host = url.hostname.toLowerCase()
    const allowed = ['google.com', 'www.google.com', 'maps.google.com', 'google.com.br', 'www.google.com.br', 'maps.google.com.br', 'maps.app.goo.gl', 'goo.gl']
    if (url.protocol !== 'https:' || url.username || url.password || !allowed.includes(host) || (host === 'goo.gl' && !url.pathname.startsWith('/maps/'))) throw new Error()
    return url.href
  } catch { throw new Error('Cole um link HTTPS válido do Google Maps ou deixe este campo vazio.') }
}
export function eventMapsUrl(event) {
  try { const url = normalizeMapsUrl(event.mapsUrl); if (url) return url } catch { /* Fall back to the address for invalid legacy links. */ }
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent([event.address, event.city].filter(Boolean).join(' '))
}
