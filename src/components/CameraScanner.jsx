import { useEffect, useRef, useState } from 'react'
export default function CameraScanner({ onScan }) {
  const video = useRef(null), controls = useRef(null), active = useRef(false)
  const [error,setError] = useState(''), [running,setRunning] = useState(false)
  function stop() { active.current=false; controls.current?.stop(); controls.current=null; setRunning(false) }
  useEffect(()=>()=>{active.current=false; controls.current?.stop()},[])
  async function start() {
    setError(''); setRunning(true); active.current=true
    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser')
      if (!active.current) return
      const reader = new BrowserQRCodeReader()
      const session = await reader.decodeFromConstraints({video:{facingMode:'environment'}},video.current,(result,_error,control)=>{
        if (result && active.current) { active.current=false; control.stop(); setRunning(false); onScan(result.getText()) }
      })
      controls.current=session
      if (!active.current) session.stop()
    } catch { active.current=false; setRunning(false); setError('Não foi possível abrir a câmera. Permita o acesso em HTTPS/localhost ou digite o código abaixo.') }
  }
  return <div className="camera-scanner"><video ref={video} muted playsInline hidden={!running}/><button className="ghost-btn" onClick={running?stop:start}>{running?'Parar câmera':'Ler QR Code com a câmera'}</button>{error&&<p role="alert">{error}</p>}</div>
}
