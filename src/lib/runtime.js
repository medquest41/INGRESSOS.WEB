export function resolveRuntime(env, dev) {
  const url = String(env.VITE_SUPABASE_URL || '').trim()
  const key = String(env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || '').trim()
  if (dev && env.VITE_LOCAL_DEMO === 'true') return { mode: 'local', url: '', key: '' }
  if (!url || !key) return { mode: 'error', error: 'Configure a URL e a chave pública do Supabase. A demonstração local exige DEV e VITE_LOCAL_DEMO=true.' }
  if (!url.startsWith('https://')) return { mode: 'error', error: 'A URL do Supabase deve usar HTTPS.' }
  let publicKey = /^sb_publishable_/.test(key)
  if (key.split('.').length === 3) {
    try { publicKey = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role === 'anon' } catch { publicKey = false }
  }
  if (!publicKey) return { mode: 'error', error: 'Chave inválida: o navegador aceita somente publishable ou anon. Nunca use chaves secretas.' }
  return { mode: 'supabase', url, key }
}
