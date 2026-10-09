import { Navigate, useLocation } from 'react-router-dom'
import LoadingScreen from './LoadingScreen'
import { useAuth } from '../store/AuthStore'
import { loginPath } from '../utils/authReturn'

export default function ProtectedRoute({ children, roles }) {
  const { currentUser, loading } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingScreen text="Verificando sessão..."/>

  if (!currentUser) {
    return <Navigate to={loginPath(location.pathname + location.search)} replace state={{ from: location.pathname + location.search }} />
  }

  if (Array.isArray(roles) && roles.length && !roles.includes(currentUser.role)) {
    return <Navigate to="/eventos" replace />
  }

  return children
}
