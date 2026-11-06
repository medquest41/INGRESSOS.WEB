import {useEffect,useRef,useState} from 'react'
export default function useEventMotion(eventId){
 const root=useRef(null)
 const [paused,setPaused]=useState(()=>{try{return localStorage.getItem('ingressos_motion_paused')==='true'}catch{return false}})
 const [reduced,setReduced]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches)
 useEffect(()=>{const media=window.matchMedia('(prefers-reduced-motion: reduce)');const change=()=>setReduced(media.matches);const preference=e=>setPaused(e.detail===true);media.addEventListener('change',change);window.addEventListener('ingressos-motion-change',preference);return()=>{media.removeEventListener('change',change);window.removeEventListener('ingressos-motion-change',preference)}},[])
 const enabled=!paused&&!reduced
 useEffect(()=>{
  const element=root.current;if(!element)return
  let frame=0,card=null
  const fine=window.matchMedia('(hover: hover) and (pointer: fine)')
  const reset=()=>{if(frame)cancelAnimationFrame(frame);frame=0;card?.style.removeProperty('--tilt-x');card?.style.removeProperty('--tilt-y');card=null}
  const move=e=>{if(!enabled||!fine.matches)return;const target=e.target.closest('.ticket-option:not(:disabled)');if(!target||!element.contains(target)){reset();return}if(card!==target)reset();card=target;if(frame)cancelAnimationFrame(frame);const x=e.clientX,y=e.clientY;frame=requestAnimationFrame(()=>{frame=0;if(!card)return;const r=card.getBoundingClientRect();card.style.setProperty('--tilt-x',((.5-(y-r.top)/r.height)*5).toFixed(2)+'deg');card.style.setProperty('--tilt-y',(((x-r.left)/r.width-.5)*5).toFixed(2)+'deg')})}
  const visibility=()=>{element.dataset.motionPaused=String(document.hidden||!enabled);if(document.hidden)reset()}
  visibility();document.addEventListener('visibilitychange',visibility);element.addEventListener('pointermove',move);element.addEventListener('pointerleave',reset)
  const observer=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(entries=>entries.forEach(entry=>{entry.target.dataset.motionVisible=String(entry.isIntersecting)}),{rootMargin:'50px'})
  element.querySelectorAll('.ticket-option,.event-hero,.event-section,.ticket-section,.event-about,.event-location-card,.event-location-preview,.seating-map-preview,.attraction-program-card,.purchase-summary,.event-main>.admin-panel,.vip16>article,.buyer-form,.checkout-summary,.auth-card,.event-card').forEach(node=>observer?.observe(node))
  return()=>{reset();observer?.disconnect();document.removeEventListener('visibilitychange',visibility);element.removeEventListener('pointermove',move);element.removeEventListener('pointerleave',reset)}
 },[eventId,enabled])
 function toggle(){const next=!paused;setPaused(next);try{localStorage.setItem('ingressos_motion_paused',String(next));window.dispatchEvent(new CustomEvent('ingressos-motion-change',{detail:next}))}catch{/* Preference remains available for this page. */}}
 return {root,enabled,paused,reduced,toggle}
}
