const HEX = /^#[\da-f]{6}$/i
export const DEFAULT_ACCENT = '#29d885'

export function getEventVisual(event) {
  const visual = event?.visualExperience || {}
  return {
    enabled: visual.enabled === true,
    intro: visual.intro !== false,
    medallions: visual.medallions !== false,
    logo: typeof visual.logo === 'string' ? visual.logo : '',
    primary: HEX.test(visual.primary || '') ? visual.primary : DEFAULT_ACCENT,
    automaticColor: visual.automaticColor !== false,
    density: Math.max(3, Math.min(12, Number(visual.density) || 8)),
  }
}

export function rgbToHex(red, green, blue) {
  return '#' + [red, green, blue].map(channel => Math.round(channel).toString(16).padStart(2, '0')).join('')
}

// Usa Canvas só no navegador. Para imagens sem CORS, devolve a cor anterior.
export function detectLogoAccent(src) {
  return new Promise(resolve => {
    if (!src || typeof Image === 'undefined') return resolve(null)
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = 64
        const context = canvas.getContext('2d', { willReadFrequently: true })
        context.drawImage(image, 0, 0, 64, 64)
        const pixels = context.getImageData(0, 0, 64, 64).data
        const buckets = new Map()
        for (let offset = 0; offset < pixels.length; offset += 4) {
          if (pixels[offset + 3] < 140) continue
          const rgb = [pixels[offset], pixels[offset + 1], pixels[offset + 2]]
          const max = Math.max(...rgb), min = Math.min(...rgb)
          const saturation = max === 0 ? 0 : (max - min) / max
          const brightness = max / 255
          if (saturation < 0.27 || brightness < 0.13 || brightness > 0.97) continue
          const key = rgb.map(v => Math.round(v / 36)).join(',')
          const b = buckets.get(key) || { score: 0, sum: [0, 0, 0], count: 0 }
          const weight = Math.max(0.1, saturation * (1 - Math.abs(brightness - 0.55)))
          b.score += weight
          b.count += 1
          rgb.forEach((value, i) => { b.sum[i] += value })
          buckets.set(key, b)
        }
        const best = [...buckets.values()].sort((a, b) => b.score - a.score)[0]
        if (!best) return resolve(null)
        const average = best.sum.map(sum => sum / best.count)
        const highest = Math.max(...average)
        const multiplier = highest < 140 ? 160 / Math.max(highest, 1) : 1
        resolve(rgbToHex(...average.map(v => Math.min(245, v * multiplier))))
      } catch { resolve(null) }
    }
    image.onerror = () => resolve(null)
    image.src = src
  })
}

export function isSafeVisualImage(value, isDemo) {
  if (!value) return true
  if (isDemo && /^data:image\/(png|jpeg|webp|gif);base64,/i.test(value)) return true
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
  } catch { return false }
}
