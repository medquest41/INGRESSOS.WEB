import { createClient } from '@supabase/supabase-js'
// Prepared adapter; the local providers remain active until the server workflow is deployed.
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
export const supabase = url && key ? createClient(url, key) : null
function client() { if (!supabase) throw new Error('Configure URL e chave pública do Supabase.'); return supabase }
export const supabaseAuth = {
  signIn: (email,password) => client().auth.signInWithPassword({email,password}),
  signUp: (email,password,name) => client().auth.signUp({email,password,options:{data:{name}}}),
  signOut: () => client().auth.signOut(),
  resetPassword: (email,redirectTo) => client().auth.resetPasswordForEmail(email,{redirectTo}),
  getUser: () => client().auth.getUser(),
}
export const supabaseData = {
  publishedEvents: () => client().from('events').select('*,ticket_types(*)').eq('published',true).eq('archived',false),
  myOrders: () => client().from('orders').select('*,tickets(*)').order('created_at',{ascending:false}),
  checkIn: code => client().rpc('check_in',{ticket_code:code}),
}
