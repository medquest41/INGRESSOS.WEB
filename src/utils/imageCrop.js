// Pixel bounds shared by preview and export; originals are never modified.
export function cropRect(width, height, ratio, { x = 50, y = 50, zoom = 1 } = {}) {
  const scale = Math.max(1, Math.min(3, Number(zoom) || 1))
  const cropWidth = Math.min(width, height * ratio) / scale
  const cropHeight = cropWidth / ratio
  return { width: cropWidth, height: cropHeight,
    x: (width - cropWidth) * Math.max(0, Math.min(100, Number(x) || 0)) / 100,
    y: (height - cropHeight) * Math.max(0, Math.min(100, Number(y) || 0)) / 100 }
}
