import { Navigate, useLocation } from 'react-router-dom'
import LoadingScreen from './LoadingScreen'
import { useAuth } from '../store/AuthStore'

export default function ProtectedRoute({ children, roles }) {
  const { currentUser, loading } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingScreen text="Verificando sessão..."/>

  if (!currentUser) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }

  if (Array.isArray(roles) && roles.length && !roles.includes(currentUser.role)) {
    return <Navigate to="/ingressos" replace />
  }

  return children
}
