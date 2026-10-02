import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../store/AuthStore'

export default function ProtectedRoute({ children, roles }) {
  const { currentUser } = useAuth()
  const location = useLocation()

  if (!currentUser) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }

  if (Array.isArray(roles) && roles.length && !roles.includes(currentUser.role)) {
    return <Navigate to="/ingressos" replace />
  }

  return children
}
