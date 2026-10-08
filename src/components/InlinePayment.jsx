import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { CreditCard, QrCode, Copy } from 'lucide-react'
import { getPaymentOrder, loadCardSdk, payInline, pollPayment } from '../services/inlinePayment'
import './InlinePayment.css'
const brl=v=>Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})

function CardForm({order,onResult}){
  const id='mp-card-'+useId().replace(/[^a-zA-Z0-9]/g,'')
  const [error,setError]=useState(''),[ready,setReady]=useState(false)
  const pending=useRef(false)
  useEffect(()=>{
    let active=true,controller
    loadCardSdk().then(async MercadoPago=>{
      if(!active)return
      const mp=new MercadoPago(order.publicKey,{locale:'pt-BR'})
      controller=await mp.bricks().create('cardPayment',id,{
        initialization:{amount:order.total,payer:{email:order.email}},
        customization:{visual:{style:{theme:'dark'}},paymentMethods:{minInstallments:1,maxInstallments:1}},
        callbacks:{onReady:()=>{if(active)setReady(true)},onError:()=>{if(active)setError('Confira os dados ou recarregue o formulário de cartão.')},onSubmit:async form=>{
          if(pending.current)throw new Error('Pagamento em processamento.')
          pending.current=true;setError('')
          try{const result=await payInline(order.id,'card',{token:form.token,payment_method_id:form.payment_method_id,issuer_id:form.issuer_id,installments:form.installments});if(active)onResult(result)}
          catch(err){if(active)setError(err.message);throw err}
          finally{pending.current=false}
        }}
      })
      if(!active)controller.unmount()
    }).catch(err=>{if(active)setError(err.message)})
    return()=>{active=false;controller?.unmount()}
  },[id,order,onResult])
  return <div><p>Informe os dados no formulário seguro do Mercado Pago. Pagamento à vista.</p>{!ready&&!error&&<p role="status">Carregando formulário de cartão…</p>}<div id={id}/>{error&&<p role="alert" className="auth-error">{error}</p>}</div>
}

function CardChallenge({publicKey,paymentId,externalResourceURL,creq}){
  const id='mp-challenge-'+useId().replace(/[^a-zA-Z0-9]/g,'')
  const [error,setError]=useState('')
  useEffect(()=>{
    let active=true,controller
    loadCardSdk().then(async MercadoPago=>{
      if(!active)return
      controller=await new MercadoPago(publicKey,{locale:'pt-BR'}).bricks().create('statusScreen',id,{initialization:{paymentId,additionalInfo:{externalResourceURL,creq}},callbacks:{onReady:()=>{},onError:()=>{if(active)setError('A confirmação do banco não carregou. Confira o pedido antes de tentar novamente.')}}})
      if(!active)controller.unmount()
    }).catch(err=>{if(active)setError(err.message)})
    return()=>{active=false;controller?.unmount()}
  },[id,publicKey,paymentId,externalResourceURL,creq])
  return <div><p>Seu banco pediu uma confirmação adicional. Conclua a verificação abaixo.</p><div id={id}/>{error&&<p role="alert" className="auth-error">{error}</p>}</div>
}

export default function InlinePayment({orderId,initialMethod='pix',onConfirmed,onOrder}){
  const [order,setOrder]=useState(null),[method,setMethod]=useState(initialMethod),[result,setResult]=useState(null)
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[copied,setCopied]=useState(false),[now,setNow]=useState(Date.now)
  const [reload,setReload]=useState(0)
  const fetching=useRef(false),confirmed=useRef(false)
  const accept=useCallback(data=>{setResult(data);if(data.status==='approved'&&!confirmed.current){confirmed.current=true;onConfirmed?.()}},[onConfirmed])
  useEffect(()=>{
    let active=true
    getPaymentOrder(orderId).then(info=>{
      if(!active)return
      setOrder(info);onOrder?.(info)
      if(['approved','cancelled','refunded','review','expired','rejected'].includes(info.status))accept({status:info.status})
      else if(info.activeMethod){setMethod(info.activeMethod);setResult({status:'pending',method:info.activeMethod})}
    }).catch(err=>{if(active)setError(err.message)})
    return()=>{active=false}
  },[orderId,onOrder,accept,reload])
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer)},[])
  const seconds=order?Math.max(0,Math.ceil((new Date(result?.expiresAt||order.expiresAt).getTime()-now)/1000)):0
  const waiting=Boolean(result&&['creating','pending','in_process','authorized','confirming'].includes(result.status))
  const check=useCallback(async()=>{
    if(fetching.current)return
    fetching.current=true
    try{accept(await pollPayment(orderId));setError('')}catch(err){setError(err.message)}finally{fetching.current=false}
  },[orderId,accept])
  useEffect(()=>{
    if(!waiting)return
    const first=setTimeout(()=>{void check()},0),timer=setInterval(()=>{void check()},8000)
    return()=>{clearTimeout(first);clearInterval(timer)}
  },[waiting,check])
  async function generatePix(){
    if(busy)return
    setBusy(true);setError('')
    try{accept(await payInline(orderId,'pix'))}catch(err){setError(err.message)}finally{setBusy(false)}
  }
  const locked=Boolean(waiting)||['approved','review','cancelled','refunded','expired'].includes(result?.status)
  return <section className="inline-payment admin-panel" aria-label="Pagamento do ingresso">
    <h2>Como você quer pagar?</h2>
    {error&&<p role="alert" className="auth-error">{error}</p>}
    {!order?<div><p role="status">{error?'O pagamento não carregou.':'Carregando pagamento…'}</p>{error&&<button className="ghost-btn" onClick={()=>{setError('');setReload(n=>n+1)}}>Tentar novamente</button>}<Link to="/ingressos">Ver meus pedidos</Link></div>:<>
      <p className="inline-payment-total">Total do pedido: <strong>{brl(order.total)}</strong></p>
      <div className="payment-options"><button type="button" disabled={locked||busy} className={method==='pix'?'active':''} onClick={()=>{setMethod('pix');setResult(null)}}><QrCode/>Pix<span>QR Code e copia e cola</span></button><button type="button" disabled={locked||busy||!order.publicKey} className={method==='card'?'active':''} onClick={()=>{setMethod('card');setResult(null)}}><CreditCard/>Cartão<span>{order.publicKey?'Formulário seguro':'Ainda indisponível'}</span></button></div>
      {result?.status==='approved'?<p role="status" className="team-success">Pagamento confirmado. Seus ingressos estão disponíveis.</p>:<>
        {seconds===0?<p role="alert">Reserva expirada. Confira o pedido em Minha conta antes de fazer uma nova compra.</p>:<p>Reserva válida por {Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')}. Ao iniciar o pagamento, a validade é atualizada.</p>}
        {result?.status==='rejected'&&<p role="alert">Pagamento recusado. Nenhum ingresso foi emitido. Tente novamente ou escolha Pix.</p>}
        {result?.status==='expired'&&<p role="status">Pagamento expirado. O ingresso não foi liberado. Confira seus pedidos antes de iniciar outra compra.</p>}
        {result?.status==='review'&&<p role="alert">Pagamento em revisão. Confira o pedido em Minha conta.</p>}
        {['cancelled','refunded'].includes(result?.status)&&<p role="alert">Pedido cancelado ou estornado. Não pague o código Pix desse pedido.</p>}
        {method==='pix'&&result?.qrCode&&seconds>0&&result.status==='pending'&&<div className="inline-pix"><QRCodeSVG value={result.qrCode} size={224} marginSize={4}/><label>Pix copia e cola<textarea readOnly value={result.qrCode} rows={4}/></label><button type="button" className="primary-small" onClick={async()=>{try{await navigator.clipboard.writeText(result.qrCode);setCopied(true)}catch{setError('Selecione o código acima e copie manualmente.')}}}><Copy size={17}/>{copied?'Código copiado':'Copiar código Pix'}</button><p>Abra o aplicativo do seu banco e escaneie o QR Code ou cole o código Pix.</p></div>}
        {method==='pix'&&(!locked||result?.status==='creating')&&seconds>0&&<button type="button" className="checkout-button" disabled={busy} onClick={generatePix}>{busy?'Gerando Pix…':result?.status==='creating'?'Retomar geração do Pix':'Gerar QR Code Pix'}</button>}
        {method==='card'&&!locked&&seconds>0&&order.publicKey&&<CardForm order={order} onResult={accept}/>}
        {method==='card'&&result?.challenge&&order.publicKey&&<CardChallenge publicKey={order.publicKey} paymentId={result.paymentId} externalResourceURL={result.challenge.externalResourceURL} creq={result.challenge.creq}/>}
        {waiting&&<><p role="status">{result.status==='confirming'?'Pagamento recebido. Aguardando confirmação do pedido.':'Aguardando pagamento. A confirmação será atualizada automaticamente.'}</p><button type="button" className="ghost-btn" onClick={()=>{void check()}}>Verificar pagamento</button></>}
      </>}
      <Link to="/ingressos">Ver meus pedidos e ingressos</Link>
    </>}
  </section>
}
