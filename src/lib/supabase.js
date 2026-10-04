import { createClient } from '@supabase/supabase-js'
import { resolveRuntime } from './runtime'
export const runtime = resolveRuntime(import.meta.env, import.meta.env.DEV)
export const isSupabaseConfigured = runtime.mode === 'supabase'
export const isLocalDemo = runtime.mode === 'local'
export const supabase = isSupabaseConfigured ? createClient(runtime.url, runtime.key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
}) : null
export async function result(request) {
  const { data, error } = await request
  if (error) throw new Error(error.message || 'Falha ao acessar o Supabase.')
  return data
}
