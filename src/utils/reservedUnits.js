const text=value=>typeof value==='string'?value.trim():''
export const unitKind=t=>text(t.reservationCategoryId)||(t.reservationKind==='table'?'table':t.reservationKind==='group'?'group':'camarote')
export const unitLabel=t=>text(t.reservationCategoryName)||(t.reservationKind==='table'?'Mesa VIP':t.reservationKind==='group'?'Grupo':'Camarote')
export function getReservedCategories(event){
 const result=new Map()
 for(const c of event.reservationCategories||[])if(text(c.id)&&text(c.name))result.set(c.id,{id:c.id,name:text(c.name),prefix:text(c.prefix)||text(c.name)})
 for(const t of event.ticketTypes||[])if(t.type==='camarote'&&!result.has(unitKind(t)))result.set(unitKind(t),{id:unitKind(t),name:text(t.reservationCategoryName)||(t.reservationKind==='table'?'Mesas VIP':t.reservationKind==='group'?'Grupos':'Camarotes'),prefix:unitLabel(t)})
 return [...result.values()]
}
export function addReservedCategory(event,name,prefix,id=()=>crypto.randomUUID()){
 name=text(name);prefix=text(prefix)||name
 if(!name||name.length>60||prefix.length>60)throw Error('Informe um nome de categoria com até 60 caracteres.')
 if(getReservedCategories(event).some(c=>c.name.toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR')))throw Error('Esta categoria já existe. Selecione-a na lista.')
 const category={id:id(),name,prefix}
 return {category,event:{...event,reservationCategories:[...(event.reservationCategories||[]),category]}}
}
export function generateReservedUnits(existing,{kind,category,count,start,price,wristbands},id=()=>crypto.randomUUID()) {
 const custom=category&&text(category.id)&&text(category.name)
 if((!custom&&!['table','camarote'].includes(kind))||!Number.isInteger(count)||count<1||count>100||!Number.isInteger(start)||start<1||start+count>1000)throw Error('Selecione uma categoria, informe de 1 a 100 unidades e uma numeração válida.')
 if(price==null||String(price).trim()===''||!Number.isFinite(Number(price))||Number(price)<0)throw Error('Informe o preço integral de cada unidade.')
 if(!Number.isInteger(wristbands)||wristbands<1||wristbands>100)throw Error('Informe de 1 a 100 ingressos por unidade.')
 const prefix=custom?text(category.prefix)||text(category.name):kind==='table'?'Mesa VIP':'Camarote'
 if(prefix.length>60)throw Error('Nome da unidade muito longo.')
 const names=new Set(existing.map(t=>String(t.name||'').trim().toLocaleLowerCase('pt-BR')))
 const units=Array.from({length:count},(_,i)=>{const number=start+i,name=prefix+' '+String(number).padStart(2,'0');if(names.has(name.toLocaleLowerCase('pt-BR')))throw Error(name+' já existe. Ajuste o número inicial.');return {id:id(),name,type:'camarote',reservationKind:kind==='table'?'table':'camarote',...(custom?{reservationCategoryId:category.id,reservationCategoryName:category.name}:{}),unitNumber:number,sector:custom?category.name:kind==='table'?'Mesas VIP':'Camarotes',batch:'Reserva numerada',price:Number(price),available:1,active:true,wristbands,mapX:12+(i%5)*19,mapY:(kind==='table'?62:28)+Math.floor(i/5)*(23/Math.max(1,Math.ceil(count/5)-1))}})
 return [...existing,...units]
}
export function validateTicketDrafts(tickets){
 tickets.forEach((t,ticketIndex)=>{const name=t.name?.trim()||'Ingresso';const fail=(message,field)=>{throw Object.assign(Error(name+': '+message),{ticketIndex,field})};if(t.price===''||t.price==null||!Number.isFinite(Number(t.price))||Number(t.price)<0)fail('informe o preço. Use 0 somente se for gratuito.','price');if(t.available===''||t.available==null||!Number.isInteger(Number(t.available))||Number(t.available)<0)fail('informe o estoque.','available');if(t.type==='camarote'&&(t.wristbands===''||t.wristbands==null||!Number.isInteger(Number(t.wristbands))||Number(t.wristbands)<1||Number(t.wristbands)>100))fail('informe de 1 a 100 ingressos por unidade.','wristbands')})
}
