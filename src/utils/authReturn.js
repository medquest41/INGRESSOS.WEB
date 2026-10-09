/* oxlint-disable no-control-regex -- Reject control characters in redirect input. */
// Only known application routes can be used as authentication destinations.
export function safeReturnTo(value) {
  if (typeof value !== 'string' || value.length > 2048 || /[\\\s\u0000-\u001f\u007f]/.test(value)) return null
  let decoded
  try { decoded = decodeURIComponent(value) } catch { return null }
  if (/[\\\s\u0000-\u001f\u007f]/.test(decoded) || !value.startsWith('/') || value.startsWith('//')) return null
  const url = new URL(value, 'https://return.invalid')
  if (url.origin !== 'https://return.invalid' || url.hash) return null
  const path = url.pathname
  if (!['/', '/eventos', '/ingressos', '/meus-ingressos', '/checkout', '/criar-evento', '/admin'].includes(path) &&
      !/^\/evento\/[a-zA-Z0-9_-]+$/.test(path) &&
      !/^\/admin\/evento\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)?$/.test(path)) return null
  return path + url.search
}

export function loginPath(returnTo) {
  const destination = safeReturnTo(returnTo) || '/eventos'
  return '/login?' + new URLSearchParams({ returnTo: destination })
}

export function authDestination(search, from) {
  const params = new URLSearchParams(search)
  // An explicit invalid parameter must fall back, never reuse stale navigation state.
  if (params.has('returnTo')) return safeReturnTo(params.get('returnTo')) || '/eventos'
  const legacy = safeReturnTo(from)
  // Ticket access must be an explicit URL intent, never a stale generic login state.
  if (legacy && ['/ingressos', '/meus-ingressos'].includes(legacy.split('?')[0])) return '/eventos'
  return legacy || '/eventos'
}
