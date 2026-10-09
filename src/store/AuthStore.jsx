/* oxlint-disable react/only-export-components */
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { loginPath } from '../utils/authReturn'
import { paged } from '../lib/pagination'
import { supabase, result, isLocalDemo, runtime } from '../lib/supabase'
import { LocalAuthProvider, useLocalAuth } from './LocalAuthStore'
export const PRIMARY_ADMIN_EMAIL = 'ingressosaltatemporada@gmail.com'
export const ROLE_LABELS = { admin: 'Administrador Geral', organizador: 'Organizador', financeiro: 'Financeiro', checkin: 'Check-in', cliente: 'Cliente' }
const Context = createContext(null)
function LocalBridge({ children }) { const value = useLocalAuth(); return <Context.Provider value={{ ...value, loading: false, isLocalDemo: true }}>{children}</Context.Provider> }
const profile = (p, email) => ({ ...p, email: p.email || email, organizerId: p.organization_id, organizerName: p.organizations?.name || '' })
function RemoteAuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [users, setUsers] = useState([])
  const [organizations, setOrganizations] = useState([])
  const [invitations, setInvitations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const generation = useRef(0)
  const sessionIdentity = useRef(null)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      if (active) { generation.current++; const id=next?.user?.id||null;if(sessionIdentity.current!==id){setCurrentUser(null);setUsers([]);setOrganizations([]);setInvitations([]);setLoading(true)}sessionIdentity.current=id;setSession(next);setRevision(v=>v+1) }
    })
    supabase.auth.getSession().then(({error: err}) => { if (active && err) {setError(err.message); setLoading(false)} })
    return () => { active = false; subscription.unsubscribe() }
  }, [])
  useEffect(() => {
    const id = ++generation.current
    let cancelled = false
    async function load() {
      try {
        setError('')
        if (!session) return
        const p = await result(supabase.from('profiles').select('*,organizations(name)').eq('id',session.user.id).single())
        if (!p.active) throw new Error('Acesso desativado. Fale com o administrador.')
        const rows = p.role === 'admin' ? await result(paged(()=>supabase.from('profiles').select('*,organizations(name)',{count:'exact'}).order('id'))) : [p]
        const orgs = await result(paged(()=>supabase.from('organizations').select('*',{count:'exact'}).order('name').order('id')))
        let inviteRows = []
        if (p.role === 'admin' && String(p.email || session.user.email || '').toLowerCase() === PRIMARY_ADMIN_EMAIL) {
          try { inviteRows = await result(paged(()=>supabase.from('admin_invitations').select('*',{count:'exact'}).order('created_at',{ascending:false}))) }
          catch { inviteRows = [] }
        }
        if (!cancelled && id === generation.current) {setCurrentUser({...profile(p,session.user.email),guest:session.user.is_anonymous===true}); setUsers(rows.map(x=>profile(x)));setOrganizations(orgs);setInvitations(inviteRows)}
      } catch (err) { if (!cancelled && id === generation.current) {setError(err.message);setCurrentUser(null);setUsers([]);setOrganizations([]);setInvitations([])} }
      finally { if (!cancelled && id === generation.current) setLoading(false) }
    }
    load()
    return () => {cancelled = true}
  }, [session, revision])
  const refresh = () => setRevision(v=>v+1)
  async function startGuest(){return result(supabase.auth.signInAnonymously({options:{data:{name:'Visitante'}}}))}
  async function login(email,password) { return result(supabase.auth.signInWithPassword({ email: email.trim(), password })) }
  async function logout() { try {await result(supabase.auth.signOut());setCurrentUser(null);setUsers([])} catch(err){setError(err.message)} }
  async function registerCustomer({name,email,password,returnTo,cpf,phone,birthDate}) {
    const data = await result(supabase.auth.signUp({email:email.trim(),password,options:{data:{name:name.trim(),cpf,phone,birthDate},emailRedirectTo:location.origin+loginPath(returnTo)}}))
    return { confirmationRequired: !data.session }
  }
  async function resetPassword(email) { return result(supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:location.origin+'/redefinir-senha'})) }
  async function changeUserPassword(userId) { const u=users.find(x=>x.id===userId); if(!u?.email) throw new Error('Usuário não encontrado.'); await resetPassword(u.email) }
  async function createUser(input) {
    await result(supabase.rpc('assign_member',{member_email:input.email.trim(),member_role:input.role,organization:input.organizerId==='org-main'?null:input.organizerId||null,organization_name:input.organizerName||null}))
    refresh()
  }
  async function toggleUserActive(id) { const u=users.find(x=>x.id===id);await result(supabase.rpc('set_member',{member_id:id,member_role:u.role,organization:u.organizerId,enabled:!u.active}));refresh() }
  async function updateUserProfile(id,changes) {await result(supabase.rpc('set_member',{member_id:id,member_role:changes.role,organization:changes.organizerId==='org-main'?null:changes.organizerId,enabled:users.find(x=>x.id===id).active}));refresh()}
  async function saveOrganization(org) {const id=await result(supabase.rpc('save_organization',{organization:org.id||null,label:org.name,enabled:org.active!==false}));if(org.whatsapp!==undefined)await result(supabase.rpc('set_organization_contact',{organization:id,phone:org.whatsapp}));refresh();return id}

  async function inviteUser(input) {
    const outcome = await result(supabase.rpc('prepare_account_invite',{
      invite_name: input.name.trim(),
      invite_email: input.email.trim(),
      invite_role: input.role,
      organization: input.organizerId === 'org-main' ? null : input.organizerId || null,
      organization_name: input.organizerName || null,
    }))
    if (outcome?.status === 'pending') {
      await result(supabase.auth.signInWithOtp({
        email: input.email.trim(),
        options: { shouldCreateUser: true, emailRedirectTo: location.origin + '/login' },
      }))
    }
    refresh()
    return outcome
  }
  async function deleteUserSafely(id) { const status=await result(supabase.rpc('safe_delete_member',{member_id:id}));refresh();return status }
  async function becomeOrganizer(name) { const id=await result(supabase.rpc('become_organizer',{organization_name:name.trim()}));refresh();return id }
  const value={currentUser,users,organizations,invitations,loading,error,needsSetup:false,startGuest,login,logout,registerCustomer,resetPassword,changeUserPassword,createUser,inviteUser,deleteUserSafely,becomeOrganizer,toggleUserActive,updateUserProfile,saveOrganization,roleLabels:ROLE_LABELS,isLocalDemo:false}
  return <Context.Provider value={value}>{error && <div role="alert" className="auth-error">{error} <button onClick={refresh}>Tentar novamente</button>{session && <button onClick={logout}>Sair</button>}</div>}{children}</Context.Provider>
}
export function AuthProvider({ children }) {
  if (runtime.mode === 'error') return <main className="empty-page"><h1>Configuração necessária</h1><p role="alert">{runtime.error}</p></main>
  if (isLocalDemo) return <LocalAuthProvider><LocalBridge><div className="demo-warning" role="status">Demonstração DEV: dados somente neste navegador, sem cobrança.</div>{children}</LocalBridge></LocalAuthProvider>
  return <RemoteAuthProvider>{children}</RemoteAuthProvider>
}
export function useAuth() { const ctx=useContext(Context);if(!ctx)throw new Error('AuthProvider ausente');return ctx }
