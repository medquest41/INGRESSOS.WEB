import { Navigate, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import Eventos from './pages/Eventos'
import Evento from './pages/Evento'
import Checkout from './pages/Checkout'
import MeusIngressos from './pages/MeusIngressos'
import Login from './pages/Login'
import Admin from './pages/Admin'
import ProtectedRoute from './components/ProtectedRoute'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/eventos" element={<Eventos />} />
      <Route path="/evento/:eventKey" element={<Evento />} />
      <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
      <Route path="/ingressos" element={<ProtectedRoute><MeusIngressos /></ProtectedRoute>} />
      <Route path="/login" element={<Login />} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={['admin', 'organizador', 'financeiro', 'checkin']}>
            <Admin />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
