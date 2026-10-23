export const unitKind=t=>t.reservationKind==='table'?'table':'camarote'
export const unitLabel=t=>unitKind(t)==='table'?'Mesa VIP':'Camarote'
export function generateReservedUnits(existing,{kind,count,start,price,wristbands},id=()=>crypto.randomUUID()) {
 if(!['table','camarote'].includes(kind)||!Number.isInteger(count)||count<1||count>100||!Number.isInteger(start)||start<1||start+count>1000)throw Error('Informe de 1 a 100 unidades e uma numeração válida.')
 if(price===''||!Number.isFinite(Number(price))||Number(price)<0)throw Error('Informe o preço integral de cada unidade.')
 if(!Number.isInteger(wristbands)||wristbands<1||wristbands>100)throw Error('Informe de 1 a 100 ingressos por unidade.')
 const names=new Set(existing.map(t=>t.name.trim().toLowerCase()))
 const units=Array.from({length:count},(_,i)=>{const number=start+i,name=(kind==='table'?'Mesa VIP ':'Camarote ')+String(number).padStart(2,'0');if(names.has(name.toLowerCase()))throw Error(name+' já existe. Ajuste o número inicial.');return {id:id(),name,type:'camarote',reservationKind:kind,unitNumber:number,sector:kind==='table'?'Mesas VIP':'Camarotes',batch:'Reserva numerada',price:Number(price),available:1,active:true,wristbands,mapX:12+(i%5)*19,mapY:(kind==='table'?62:28)+Math.floor(i/5)*(23/Math.max(1,Math.ceil(count/5)-1))}})
 return [...existing,...units]
}
