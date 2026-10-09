export default function PartyAtmosphere() {
  return <div className="party-atmosphere" aria-hidden="true">
    <div className="party-orbit party-orbit-one"/><div className="party-orbit party-orbit-two"/>
    {[0,1,2].map(burst=><div className={`party-firework party-firework-${burst}`} key={burst}>
      {Array.from({length:12},(_,ray)=><i key={ray} style={{'--angle':`${ray*30}deg`}}/>)}</div>)}
    {Array.from({length:20},(_,index)=><span className="party-confetti" key={index} style={{left:`${(index*37)%100}%`,top:`${(index*23)%95}%`,'--delay':`${-index*.7}s`,'--drift':`${index%2?28:-28}px`,'--spin':`${index*31}deg`}}/>)}
    <div className="party-sparkline"/>
  </div>
}
