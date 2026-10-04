/* oxlint-disable react/only-export-components, react/set-state-in-effect -- Synchronize the authenticated remote dataset; never carry data between accounts. */
import { createContext,useContext,useEffect,useRef,useState } from 'react'
import { Link,useLocation } from 'react-router-dom'
import { useAuth } from './AuthStore'
import { LocalEventProvider,useLocalEventStore } from './LocalEventStore'
import { isLocalDemo } from '../lib/supabase'
import { eventPayload,loadRemote,rpc } from '../services/remoteData'
import LoadingScreen from '../components/LoadingScreen'
import { validateBuyer } from '../utils/commerce'
const Context=createContext(null)
const quoteRemote=(ticketId,quantity,coupon)=>rpc('quote_order',{batch_id:ticketId,units:quantity,coupon_code:coupon||''})
const empty={events:[],orders:[],coupons:[],history:[],summary:[],checkins:[]}
function LocalBridge({children}){const value=useLocalEventStore();return <Context.Provider value={{...value,isLocalDemo:true}}>{children}</Context.Provider>}
function RemoteEventProvider({children}){
 const {currentUser,loading:authLoading,organizations=[]}=useAuth()
 const location=useLocation()
 const [data,setData]=useState(empty),[error,setError]=useState(''),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0)
 const epoch=useRef(0)
 const identity=useRef(undefined)
 useEffect(()=>{
  const generation=++epoch.current;let live=true
  const nextIdentity=currentUser?.id||null
  if(identity.current!==nextIdentity){setData(empty);setLoading(true);identity.current=nextIdentity}
  setError('')
  if(authLoading)return
  loadRemote(currentUser).then(next=>{if(live&&epoch.current===generation)setData(next)}).catch(err=>{if(live&&epoch.current===generation)setError('Não foi possível carregar o banco: '+err.message)}).finally(()=>{if(live&&epoch.current===generation)setLoading(false)})
  return()=>{live=false}
 },[currentUser,authLoading,revision])
 const refresh=()=>setRevision(v=>v+1)
 useEffect(()=>{const onFocus=()=>refresh();window.addEventListener('focus',onFocus);return()=>window.removeEventListener('focus',onFocus)},[])
 async function mutate(name,args){const response=await rpc(name,args);refresh();return response}
 async function saveEvent(input){return mutate('save_event',{payload:eventPayload(input,organizations)})}
 async function placeOrder(input){validateBuyer({...input.buyer,email:currentUser.email});return mutate('create_order',{batch_id:input.ticketId,units:input.quantity,buyer_data:input.buyer,coupon_code:input.coupon||'',request_id:input.idempotencyKey,referral:input.source||null,campaign_name:input.campaign||null})}
 async function markTicketUsed(code){
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(code.trim()))return {found:false}
  const status=await mutate('check_in',{ticket_code:code.trim()});return {found:['valid','used','cancelled'].includes(status),alreadyUsed:status==='used',cancelled:status==='cancelled',forbidden:status==='forbidden'}
 }
 const value={...data,loading,error,refresh,isLocalDemo:false,saveEvent,placeOrder,markTicketUsed,cancelOrder:id=>mutate('cancel_order',{purchase_id:id}),saveCoupon:payload=>mutate('save_coupon',{payload}),getRemaining:(_event,ticket)=>ticket?.open?ticket.remaining:0,
 getQuote:(event,ticket,quantity)=>{if(!event?.published||event.archived||!ticket?.open)throw new Error('Ingresso indisponível neste lote.');if(!Number.isInteger(quantity)||quantity<1||quantity>10||quantity>ticket.remaining)throw new Error('Quantidade indisponível.');const subtotal=ticket.price*quantity,fee=Math.round(subtotal*event.feeRate*100)/100;return {subtotal,discount:0,fee,total:subtotal+fee}},
 quoteRemote}
 const isAuthPage=['/login','/redefinir-senha'].includes(location.pathname)
 return <Context.Provider value={value}>{!isAuthPage&&error?<main className="empty-page"><h1>Não foi possível carregar os dados</h1><p role="alert">{error}</p><button className="primary-small" onClick={refresh}>Tentar novamente</button><Link to="/login">Acessar conta</Link></main>:!isAuthPage&&(loading||authLoading)?<LoadingScreen/>:children}</Context.Provider>
}
export function EventProvider({children}){return isLocalDemo?<LocalEventProvider><LocalBridge>{children}</LocalBridge></LocalEventProvider>:<RemoteEventProvider>{children}</RemoteEventProvider>}
export function useEventStore(){const ctx=useContext(Context);if(!ctx)throw new Error('EventProvider ausente');return ctx}
