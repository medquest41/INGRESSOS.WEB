import { Navigate, Route, Routes } from 'react-router-dom'
import SharedTicket from './pages/SharedTicket'
import Home from './pages/Home'
import Institutional from './pages/Institutional'
import OrganizerEvents from './pages/OrganizerEvents'
import { Footer, CookieBanner } from './components/PublicChrome'
import './experience16.css'
import Eventos from './pages/Eventos'
import Evento from './pages/Evento'
import Checkout from './pages/Checkout'
import MeusIngressos from './pages/MeusIngressos'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import Admin from './pages/Admin'
import CriarEvento from './pages/CriarEvento'
import ProtectedRoute from './components/ProtectedRoute'
import EventCinematic from './components/EventCinematic'
import { VisualAdminShortcut } from './components/EventVisualEditor'
import EventVisualEditor from './pages/EventVisualEditor'
import './eventCinematic.css'

export default function App() {
  return (
    <><Routes>
      <Route path="/ingresso-compartilhado" element={<SharedTicket/>}/>
      <Route path="/institucional/:slug" element={<Institutional/>}/>
      <Route path="/organizador/:organizerId" element={<OrganizerEvents/>}/>
      <Route path="/" element={<Home />} />
      <Route path="/eventos" element={<Eventos />} />
      <Route path="/evento/:eventKey" element={<EventCinematic><Evento /></EventCinematic>} />
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/ingressos" element={<ProtectedRoute><MeusIngressos /></ProtectedRoute>} />
      <Route path="/meus-ingressos" element={<ProtectedRoute><MeusIngressos /></ProtectedRoute>} />
      <Route path="/login" element={<Login />} />
      <Route path="/redefinir-senha" element={<ResetPassword />} />
      <Route path="/criar-evento" element={<CriarEvento />} />
      <Route path="/admin/experiencia/:eventKey?" element={<ProtectedRoute roles={['admin','organizador']}><EventVisualEditor /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute roles={['admin', 'organizador', 'financeiro', 'checkin']}><Admin /><VisualAdminShortcut /></ProtectedRoute>} />
      <Route path="/admin/evento/:eventKey/:section?" element={<ProtectedRoute roles={['admin','organizador','financeiro','checkin']}><Admin /><VisualAdminShortcut /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes><Footer/><CookieBanner/></>
  )
}
