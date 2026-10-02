/* oxlint-disable react/only-export-components -- Context providers intentionally export their shared hook. */
import { createContext, useContext, useEffect, useMemo, useState } from 'react'

export const PRIMARY_ADMIN_EMAIL = 'medquest41@gmail.com'

const AuthContext = createContext(null)

const USERS_KEY = 'ingressos_auth_users_v1'
const SESSION_KEY = 'ingressos_auth_session_v1'

export const ROLE_LABELS = {
  admin: 'Administrador Geral',
  organizador: 'Organizador',
  financeiro: 'Financeiro',
  checkin: 'Check-in',
  cliente: 'Cliente',
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function normalizeEmail(value = '') {
  return String(value).trim().toLowerCase()
}

function slug(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

async function hashPassword(password) {
  const bytes = new TextEncoder().encode(String(password))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function readUsers() {
  const stored = readJson(USERS_KEY, [])
  const next = stored.map(user => normalizeEmail(user.email) === PRIMARY_ADMIN_EMAIL
    ? { ...user, email: PRIMARY_ADMIN_EMAIL, role: 'admin', active: true }
    : user)
  if (JSON.stringify(next) !== JSON.stringify(stored)) persistUsers(next)
  return next
}

function persistUsers(next) {
  localStorage.setItem(USERS_KEY, JSON.stringify(next))
}

export function AuthProvider({ children }) {
  const [users, setUsers] = useState(() => readUsers())
  const [sessionId, setSessionId] = useState(() => localStorage.getItem(SESSION_KEY) || '')

  const currentUser = useMemo(
    () => users.find((user) => user.id === sessionId && user.active !== false) || null,
    [users, sessionId],
  )

  const needsSetup = !users.some(user => normalizeEmail(user.email) === PRIMARY_ADMIN_EMAIL)
  useEffect(() => {
    const sync = event => { if (event.key === USERS_KEY) setUsers(readUsers()); if (event.key === SESSION_KEY) setSessionId(localStorage.getItem(SESSION_KEY) || '') }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  useEffect(() => {
    if (sessionId && !currentUser) {
      localStorage.removeItem(SESSION_KEY)
    }
  }, [sessionId, currentUser])

  function commitUsers(next) {
    persistUsers(next)
    setUsers(next)
  }

  async function setupAdmin({ name, email, password }) {
    const latest = readUsers()
    if (latest.some(user => normalizeEmail(user.email) === PRIMARY_ADMIN_EMAIL)) throw new Error('O administrador principal já foi configurado.')
    if (!name?.trim()) throw new Error('Informe seu nome.')
    if (normalizeEmail(email) !== PRIMARY_ADMIN_EMAIL) throw new Error('Use o e-mail do administrador principal: ' + PRIMARY_ADMIN_EMAIL)
    if (String(password || '').length < 6) throw new Error('A senha deve ter pelo menos 6 caracteres.')

    const passwordHash = await hashPassword(password)
    const admin = {
      id: `user-${Date.now()}`,
      name: name.trim(),
      email: normalizeEmail(email),
      passwordHash,
      role: 'admin',
      organizerId: 'org-main',
      organizerName: 'Organização principal',
      active: true,
      createdAt: new Date().toISOString(),
    }

    commitUsers([admin, ...latest])
    localStorage.setItem(SESSION_KEY, admin.id)
    setSessionId(admin.id)
    return admin
  }

  async function login(email, password) {
    const targetEmail = normalizeEmail(email)
    const passwordHash = await hashPassword(password)
    const user = users.find((item) => normalizeEmail(item.email) === targetEmail)

    if (!user || user.passwordHash !== passwordHash) {
      throw new Error('E-mail ou senha incorretos.')
    }

    if (user.active === false) {
      throw new Error('Este acesso está desativado. Fale com o administrador.')
    }

    localStorage.setItem(SESSION_KEY, user.id)
    setSessionId(user.id)
    return user
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY)
    setSessionId('')
  }

  async function registerCustomer({ name, email, password }) {
    const normalizedEmail = normalizeEmail(email)
    const latest = readUsers()
    if (normalizedEmail === PRIMARY_ADMIN_EMAIL) throw new Error('Configure o administrador principal pelo acesso /admin ou entre com sua senha.')
    if (!name?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new Error('Informe nome e e-mail válidos.')
    if (latest.some(user => user.email === normalizedEmail)) throw new Error('Este e-mail já possui conta. Entre com sua senha.')
    if (String(password || '').length < 6) throw new Error('Use pelo menos 6 caracteres na senha.')
    const user = { id: crypto.randomUUID(), name: name.trim(), email: normalizedEmail, passwordHash: await hashPassword(password), role: 'cliente', active: true, createdAt: new Date().toISOString() }
    commitUsers([...latest, user])
    localStorage.setItem(SESSION_KEY, user.id)
    setSessionId(user.id)
    return user
  }

  async function createUser({ name, email, password, role, organizerId, organizerName }) {
    if (currentUser?.role !== 'admin') throw new Error('Apenas o administrador pode criar acessos.')

    const normalizedEmail = normalizeEmail(email)
    if (!name?.trim()) throw new Error('Informe o nome do usuário.')
    if (!normalizedEmail) throw new Error('Informe um e-mail válido.')
    if (users.some((user) => user.email === normalizedEmail)) throw new Error('Este e-mail já possui acesso.')
    if (!ROLE_LABELS[role]) throw new Error('Selecione um perfil válido.')
    if (String(password || '').length < 6) throw new Error('A senha deve ter pelo menos 6 caracteres.')

    const organization = organizerName?.trim() || name.trim()
    let resolvedOrganizerId = organizerId || null

    if (role === 'organizador' && !resolvedOrganizerId) {
      resolvedOrganizerId = `org-${slug(organization) || Date.now()}`
    }

    if (['financeiro', 'checkin'].includes(role) && !resolvedOrganizerId) {
      resolvedOrganizerId = 'org-main'
    }

    const user = {
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: await hashPassword(password),
      role: normalizedEmail === PRIMARY_ADMIN_EMAIL ? 'admin' : role,
      organizerId: role === 'admin' ? 'org-main' : resolvedOrganizerId,
      organizerName: role === 'admin' ? 'Organização principal' : organization,
      active: true,
      createdAt: new Date().toISOString(),
    }

    commitUsers([user, ...users])
    return user
  }

  function toggleUserActive(userId) {
    if (currentUser?.role !== 'admin') return
    if (userId === currentUser.id || users.some(user => user.id === userId && normalizeEmail(user.email) === PRIMARY_ADMIN_EMAIL)) return

    commitUsers(
      users.map((user) =>
        user.id === userId ? { ...user, active: user.active === false } : user,
      ),
    )
  }

  function updateUserProfile(userId, changes) {
    if (currentUser?.role !== 'admin' || userId === currentUser.id) throw new Error('Não é possível alterar este perfil.')
    if (users.some(user => user.id === userId && normalizeEmail(user.email) === PRIMARY_ADMIN_EMAIL)) throw new Error('O administrador principal deve manter acesso total.')
    if (!ROLE_LABELS[changes.role]) throw new Error('Perfil inválido.')
    if (!['admin','cliente'].includes(changes.role) && !changes.organizerId) throw new Error('Selecione a organização.')
    const latest = readUsers()
    commitUsers(latest.map(user => user.id === userId ? { ...user, role: changes.role, organizerId: changes.role === 'admin' ? 'org-main' : changes.role === 'cliente' ? null : changes.organizerId, organizerName: changes.organizerName || '' } : user))
  }

  async function changeUserPassword(userId, password) {
    if (currentUser?.role !== 'admin') throw new Error('Apenas o administrador pode alterar senhas.')
    if (String(password || '').length < 6) throw new Error('A senha deve ter pelo menos 6 caracteres.')

    const passwordHash = await hashPassword(password)
    commitUsers(users.map((user) => (user.id === userId ? { ...user, passwordHash } : user)))
  }

  const value = {
      users,
      currentUser,
      needsSetup,
      setupAdmin,
      login,
      registerCustomer,
      logout,
      createUser,
      toggleUserActive,
      changeUserPassword,
      updateUserProfile,
      roleLabels: ROLE_LABELS,
    }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de AuthProvider')
  return ctx
}
