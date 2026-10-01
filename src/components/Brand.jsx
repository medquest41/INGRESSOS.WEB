import { Ticket } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Brand({ compact = false }) {
  return (
    <Link to="/" className={`brand ${compact ? 'compact' : ''}`}>
      <div className="brand-mark"><Ticket size={21} /></div>
      <div className="brand-copy"><strong>INGRESSOS</strong><span>EXPERIENCES</span></div>
    </Link>
  )
}
