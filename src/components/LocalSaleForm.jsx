import CamaroteMap from './CamaroteMap'
import {publicTicketOptions} from '../utils/ticketPresentation'
import {requiredUnitCategory} from '../utils/unitSelection'
import {useEffect,useRef,useState} from 'react'
import {useEventStore} from '../store/EventStore'
import {useAuth} from '../store/AuthStore'
import {canManage} from '../utils/commerce'
import {localSaleBuyer,localSaleTerms} from '../utils/localSale'
import {getLocalSaleCapabilities} from '../services/localSales'
import {shareOrderTickets} from '../services/ticketShare'
import AdminOrderTickets from './AdminOrderTickets'
import BirthDateInput from './BirthDateInput'
import './LocalSaleForm.css'
const brl=value=>Number(value||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const empty={name:'',cpf:'',phone:'',email:'',birthDate:''}
export default function LocalSaleForm({event}){
 const {currentUser}=useAuth(),{createLocalSale,getRemaining,isLocalDemo}=useEventStore()
 const [ready,setReady]=useState(isLocalDemo),[error,setError]=useState(''),[ticketId,setTicketId]=useState(''),[quantity,setQuantity]=useState(1),[buyer,setBuyer]=useState(empty),[received,setReceived]=useState(false),[eligible,setEligible]=useState(false),[busy,setBusy]=useState(false),[locked,setLocked]=useState(false),[order,setOrder]=useState(null),[showTickets,setShowTickets]=useState(false)
 const [choiceId,setChoiceId]=useState(''),[category,setCategory]=useState(null)
 const [saleName,setSaleName]=useState(''),[salePrice,setSalePrice]=useState('')
 const identity=useRef(null),errorBox=useRef(null)
 const [attemptTotal,setAttemptTotal]=useState(null),[now,setNow]=useState(()=>Date.now())
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer)},[])
 const attempt=useRef(null),requestId=useRef(crypto.randomUUID())
 useEffect(()=>{if(isLocalDemo)return;let live=true;getLocalSaleCapabilities(event.id).then(()=>{if(live)setReady(true)}).catch(e=>{if(live)setError(e.message)});return()=>{live=false}},[event.id,isLocalDemo])
 if(!event.published||event.archived)return <p role="alert">Publique e ative o evento antes de registrar uma venda local.</p>
 if(!canManage(currentUser,event))return <p role="alert">Somente o organizador responsável pode gerar ingressos deste evento.</p>
 const options=(event.ticketTypes||[]).filter(t=>t.active!==false&&!t.retiredForSales&&!t.numberedCategoryId)
 const choices=publicTicketOptions(event)
 const ticket=options.find(t=>t.id===ticketId),exclusive=['camarote','table'].includes(ticket?.type)
 const units=exclusive?1:Number(quantity),count=ticket?.type==='camarote'?Number(ticket.wristbands):units,total=locked&&attemptTotal!=null?attemptTotal:Number(salePrice||0)*units
 const disabled=busy||locked||!ready
 function chooseTicket(t){setTicketId(t?.id||'');setSaleName(t?.name||'');setSalePrice(t?.price??'');setQuantity(1);setReceived(false)}
 async function submit(e){
  e.preventDefault();if(busy||!ready)return;setError('')
  try{
   if(!attempt.current){
    if(!ticket||getRemaining(event,ticket)<units)throw Error('Escolha um ingresso disponível.')
    localSaleBuyer(buyer,event)
    const terms=localSaleTerms(ticket,{name:saleName,unitPriceCents:salePrice===''?null:Math.round(Number(salePrice)*100)})
    if(!received||!eligible)throw Error('Confirme o recebimento e a conferência presencial das regras do evento.')
    setAttemptTotal(total)
    attempt.current={eventId:event.id,ticketId:ticket.id,quantity:units,buyer:{...buyer},saleOverrides:terms,requestId:requestId.current,received,eligible,expectedCents:Math.round(total*100)}
   }
   setBusy(true);setLocked(true)
   const result=await createLocalSale(attempt.current);setOrder(result);setShowTickets(true)
  }catch(err){setError(err.message);requestAnimationFrame(()=>{errorBox.current?.scrollIntoView({block:'center',behavior:'smooth'});errorBox.current?.focus()});if(!attempt.current||err.definitive||isLocalDemo){attempt.current=null;requestId.current=crypto.randomUUID();setLocked(false)}}finally{setBusy(false)}
 }
 return <section className="admin-panel local-sale-panel"><h1>Gerar ingresso — venda local</h1><p>Registre o dinheiro recebido pessoalmente. Esta operação não faz cobrança online e não tem taxa da plataforma.</p>{!ready&&!error&&<p role="status">Conferindo a habilitação da venda local…</p>}{error&&<p ref={errorBox} tabIndex={-1} role="alert" className="local-sale-error">{error}</p>}{order?<div className="local-sale-result" role="status"><h2>Venda local registrada</h2><p>{order.ticketCodes.length} ingresso(s) emitido(s) • Total recebido: {brl(order.total)}</p><p>Taxa da plataforma: R$ 0,00. O valor foi recebido pelo organizador, fora do Mercado Pago.</p><button type="button" className="primary-small" onClick={()=>setShowTickets(true)}>Ver ingressos e baixar PDF</button>{<button type="button" className="ghost-btn" disabled={busy} onClick={async()=>{setBusy(true);try{await shareOrderTickets(order)}catch(err){setError(err.message)}finally{setBusy(false)}}}>Enviar pelo WhatsApp</button>}<button type="button" className="ghost-btn" onClick={()=>{attempt.current=null;requestId.current=crypto.randomUUID();setOrder(null);setLocked(false);setBuyer(empty);setReceived(false);setEligible(false);setTicketId('');setChoiceId('');setCategory(null);setQuantity(1);setError('')}}>Nova venda local</button></div>:<form className="buyer-form" onSubmit={submit}><div className="form-grid"><label>Ingresso<select aria-label="Ingresso" required disabled={disabled} value={choiceId} onChange={e=>{const choice=choices.find(t=>t.id===e.target.value);const scope=requiredUnitCategory(event,choice);setChoiceId(e.target.value);setCategory(scope?.id||null);chooseTicket(scope?null:choice)}}><option value="">Selecione o ingresso ou a categoria</option>{choices.map(t=><option key={t.id} value={t.id} disabled={!requiredUnitCategory(event,t)&&(t.active===false||!getRemaining(event,t)||!!t.startsAt&&new Date(t.startsAt).getTime()>now||!!t.endsAt&&new Date(t.endsAt).getTime()<=now)}>{t.name}{requiredUnitCategory(event,t)?' • Escolher número':' • '+brl(t.price)+' • '+getRemaining(event,t)+' disponível(is)'}</option>)}</select></label><label>Quantidade de unidades<input required disabled={disabled||exclusive} type="number" min="1" max={Math.min(10,ticket?getRemaining(event,ticket):10)} value={units} onChange={e=>{setQuantity(e.target.value);setReceived(false)}}/></label></div>{category&&<details className="local-sale-unit-picker" open={!ticketId}><summary>{ticket?'Trocar mesa ou camarote: '+ticket.name:'Escolher número no mapa ou na lista'}</summary><CamaroteMap key={category} saleMode="cash" event={{...event,feeRate:0}} local={isLocalDemo} readOnly={disabled} getRemaining={getRemaining} categoryOnly={category} initialCategory={category} selectedId={ticketId} buyLabel="Usar esta unidade na venda local" onSelect={chooseTicket} onBuy={t=>{chooseTicket(t);identity.current?.scrollIntoView({block:'start',behavior:'smooth'})}}/>{!ticketId&&<p role="status">Escolha um número disponível no mapa ou na lista para continuar.</p>}</details>}{ticket&&<p className="local-sale-selection"><strong>{ticket.name}</strong> • {exclusive?'Compra da unidade inteira. ':''}Esta venda gera {count} ingresso(s) com QR Code individual.{ticket.type==='table'?' Esta modalidade antiga emite um QR para a entrada do grupo.':''}</p>}{ticket&&<div className="local-sale-overrides"><h2>Dados desta venda</h2><div className="form-grid"><label>Nome do ingresso nesta venda<input required disabled={disabled} maxLength={120} value={saleName} onChange={e=>{setSaleName(e.target.value);setReceived(false)}}/></label><label>Valor por unidade nesta venda (R$)<input required disabled={disabled} type="number" min="0" max="1000000" step="0.01" value={salePrice} onChange={e=>{setSalePrice(e.target.value);setReceived(false)}}/></label></div><p>As alterações valem somente para esta venda. O cadastro, a numeração e os ingressos inclusos permanecem os mesmos.</p></div>}<fieldset ref={identity}><legend>Identificação opcional</legend><p>Se preferir, deixe tudo vazio. O PDF mostrará Venda local. Dados preenchidos identificam o primeiro ingresso.</p><div className="form-grid">{[['name','Nome ou identificação (opcional)','text'],['cpf','CPF (opcional)','text'],['phone','WhatsApp com DDD (opcional)','tel'],['email','E-mail para recuperar a compra (opcional)','email']].map(([key,label,type])=><label key={key}>{label}<input disabled={disabled} type={type} maxLength={key==='name'?120:key==='email'?254:30} value={buyer[key]} onChange={e=>setBuyer({...buyer,[key]:e.target.value})}/></label>)}<label>Data de nascimento (opcional)<BirthDateInput disabled={disabled} value={buyer.birthDate} onChange={value=>setBuyer({...buyer,birthDate:value})}/></label></div></fieldset><div className="local-sale-total"><strong>Total a receber: {brl(total)}</strong><span>Taxa da plataforma: R$ 0,00</span></div><label className="check16"><input type="checkbox" required disabled={disabled} checked={received} onChange={e=>setReceived(e.target.checked)}/>Confirmo que recebi {brl(total)} em dinheiro.</label><label className="check16"><input type="checkbox" required disabled={disabled} checked={eligible} onChange={e=>setEligible(e.target.checked)}/>Conferi presencialmente as regras de idade e documentação dos portadores.</label><button type="submit" className="primary-small" disabled={!ready||busy||(!ticket&&!locked)}>{busy?'Confirmando emissão…':locked?'Tentar novamente e recuperar a mesma emissão':'Confirmar recebimento e gerar ingressos'}</button>{locked&&!busy&&<p>A tentativa foi preservada para evitar duplicação. Tente novamente antes de iniciar outra venda.</p>}</form>}{order&&showTickets&&<AdminOrderTickets order={order} onClose={()=>setShowTickets(false)}/>}</section>
}
