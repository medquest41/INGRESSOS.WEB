export const IMAGE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }
export function validateImageFile(file) {
  if (!file || !IMAGE_TYPES[file.type]) throw new Error('Escolha uma imagem JPG, PNG, WebP ou GIF.')
  if (!file.size || file.size > 8 * 1024 * 1024) throw new Error('A imagem deve ter até 8 MB e não pode estar vazia.')
  return IMAGE_TYPES[file.type]
}
