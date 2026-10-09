import { Link } from 'react-router-dom'
import { Palette } from 'lucide-react'
import { useAuth } from '../store/AuthStore'

export function VisualAdminShortcut() {
  const { currentUser } = useAuth()
  if (!['admin', 'organizador'].includes(currentUser?.role)) return null
  return <Link to="/admin/experiencia" className="ix-admin-visual-shortcut" title="Personalizar logo, cores, vinheta e medalhões dos eventos">
    <Palette size={20} /> <span>Experiência visual 3D</span>
  </Link>
}
