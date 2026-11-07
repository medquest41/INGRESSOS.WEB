import {useLocation} from 'react-router-dom'
import useEventMotion from '../hooks/useEventMotion'
import '../pages/PublicFestival.css'
export default function PublicMotionShell({children}){
 const {pathname}=useLocation()
 const {root,paused,reduced,enabled,toggle}=useEventMotion(pathname)
 const excluded=pathname.startsWith('/evento/')||pathname.startsWith('/ingresso-compartilhado')
 if(excluded)return children
 return <div ref={root} className="site-public-fx" data-motion-paused={!enabled}>{children}<div className="public-motion-control"><button type="button" className="ghost-btn" disabled={reduced} aria-pressed={paused||reduced} onClick={toggle}>{reduced?'Animações reduzidas pelo aparelho':paused?'Ativar efeitos visuais':'Reduzir efeitos visuais'}</button></div></div>
}
