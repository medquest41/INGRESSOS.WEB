import { Navigate, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import Evento from './pages/Evento'
import Checkout from './pages/Checkout'
import MeusIngressos from './pages/MeusIngressos'
import Admin from './pages/Admin'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/evento/:id" element={<Evento />} />
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/ingressos" element={<MeusIngressos />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
