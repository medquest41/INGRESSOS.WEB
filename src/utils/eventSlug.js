export function slugifyEventTitle(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function normalizeEventRouteKey(value = '') {
  let text = String(value || '').trim()

  try {
    text = decodeURIComponent(text)
  } catch {
    // Mantém o texto original se vier com codificação inválida.
  }

  // Aceita slug puro, /evento/slug e até URL completa copiada no campo slug.
  try {
    if (/^https?:\/\//i.test(text)) {
      text = new URL(text).pathname
    }
  } catch {
    // Se não for uma URL válida, segue com o valor recebido.
  }

  text = text.split('#')[0].split('?')[0].replace(/\/+$/g, '')

  const parts = text.split('/').filter(Boolean)
  const lastPart = parts.length ? parts[parts.length - 1] : text

  return slugifyEventTitle(lastPart)
}

export function getEventSlug(event) {
  const explicitSlug = normalizeEventRouteKey(event?.slug || '')
  if (explicitSlug) return explicitSlug

  const titleSlug = slugifyEventTitle(event?.title || event?.name || '')
  if (titleSlug) return titleSlug

  return String(event?.id ?? '')
}

export function getEventPublicPath(event) {
  return `/evento/${getEventSlug(event)}`
}

// A origem inclui a porta local e acompanha o domínio publicado em produção.
export function getEventPublicUrl(event, { preview = false, origin = window.location.origin } = {}) {
  const url = new URL(getEventPublicPath(event), origin)
  if (preview) url.searchParams.set('preview', '1')
  return url.href
}

export function matchesEventRoute(event, routeKey) {
  if (!event || routeKey == null) return false

  const normalizedRoute = normalizeEventRouteKey(routeKey)
  const id = String(event?.id ?? '').trim().toLowerCase()
  const slug = getEventSlug(event)
  const titleSlug = slugifyEventTitle(event?.title || '')
  const nameSlug = slugifyEventTitle(event?.name || '')

  return [id, String(event.legacyId||''), slug, titleSlug, nameSlug]
    .filter(Boolean)
    .some((candidate) => candidate === normalizedRoute)
}
