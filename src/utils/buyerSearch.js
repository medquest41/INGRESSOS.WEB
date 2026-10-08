export function formatCpf(value) {
  const digits = String(value || '').replace(/\D/g, '')
  return digits.length === 11 ? digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : digits || 'Não informado'
}
export function matchesBuyerSearch(record, query) {
  const text = String(query || '').trim().toLowerCase()
  if (!text) return true
  const buyer = record.buyer || record
  if ([record.id, record.eventTitle, buyer.name, buyer.email].filter(Boolean).join(' ').toLowerCase().includes(text)) return true
  if (!/^[\d.\-\s]+$/.test(text)) return false
  const digits = text.replace(/\D/g, '')
  return Boolean(digits && String(buyer.cpf || '').replace(/\D/g, '').includes(digits))
}
