// A sold legacy SKU cannot become an exclusive group by reducing its stock to 1.
// Keep its identity and capacity; create a distinct SKU for future group sales.
export function editTicketDraft(event,index,field,value,{originalTickets=[],orders=[],id=()=>crypto.randomUUID()}={}){
 const ticket=event.ticketTypes[index]
 if(!ticket)return event
 const normalized=['price','available','wristbands'].includes(field)?value===''?'':Number(value):value
 let next={...ticket,[field]:normalized}
 const original=originalTickets.find(t=>t.id===ticket.id)
 const upgrade=field==='type'&&value==='camarote'&&original&&['individual','table'].includes(original.type)&&!original.unitNumber&&orders.some(o=>o.ticketId===original.id)
 const types=event.ticketTypes.map((t,i)=>i===index?next:t)
 if(upgrade){
  next={...next,id:id(),available:1,wristbands:next.wristbands??'',salesPredecessorId:original.id,retiredForSales:false,active:true}
  types[index]=next
  types.push({...original,active:false,retiredForSales:true})
 }
 return {...event,ticketTypes:types}
}
