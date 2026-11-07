import {useEffect,useState} from 'react'
export default function useTicketReleaseClock(event,onRelease){
 const [now,setNow]=useState(()=>Date.now())
 useEffect(()=>{const update=()=>{setNow(Date.now());onRelease?.()};const future=(event?.ticketTypes||[]).map(t=>new Date(t.startsAt||'').getTime()).filter(d=>Number.isFinite(d)&&d>now);const timer=future.length?setTimeout(update,Math.min(2147483647,Math.max(150,Math.min(...future)-Date.now()+150))):null;const visible=()=>{if(!document.hidden)update()};document.addEventListener('visibilitychange',visible);return()=>{if(timer)clearTimeout(timer);document.removeEventListener('visibilitychange',visible)}},[event,now,onRelease])
 return now
}
