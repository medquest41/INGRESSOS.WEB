// Keep the existing exclusive SKU as the first table, including its orders/QR.
// A separate inactive SKU is only a storefront selector; payment uses a child.
export function configureNumberedTables(event,ticketId,{count,start=1},id=()=>crypto.randomUUID()){
 const source=event.ticketTypes.find(t=>t.id===ticketId)
 if(!source||source.type!=='camarote'||source.reservationKind!=='table'||source.unitNumber)throw Error('Selecione uma mesa inteira sem numeração para configurar as mesas.')
 count=Number(count);start=Number(start)
 if(!Number.isInteger(count)||count<1||count>100||!Number.isInteger(start)||start<1||start+count-1>999)throw Error('Informe de 1 a 100 mesas e uma numeração entre 1 e 999.')
 if(!source.name?.trim()||source.price===''||source.price==null||!Number.isFinite(Number(source.price))||Number(source.price)<0||!Number.isInteger(Number(source.wristbands))||Number(source.wristbands)<1||Number(source.wristbands)>100)throw Error('Preencha nome, preço da mesa e quantidade de ingressos antes de gerar os números.')
 const parentId=source.numberedCategoryId?source.id:id()
 const categoryId=source.numberedCategoryId||'tables-'+parentId
 const existing=source.numberedCategoryId?event.ticketTypes.filter(t=>t.tableOfferId===parentId):[]
 if(existing.length&&(start!==Number(source.tableStart)||count<existing.length))throw Error('As mesas existentes foram preservadas. Mantenha o número inicial e uma quantidade igual ou maior. Para bloquear uma mesa, desative sua venda no cartão dela.')
 const name=source.name.trim()
 const parent={...source,id:parentId,active:false,numberedCategoryId:categoryId,tableCount:count,tableStart:start,tableUnitsActive:source.tableUnitsActive??source.active!==false}
 const first=source.numberedCategoryId?null:source
 const names=new Set(event.ticketTypes.filter(t=>t.id!==first?.id).map(t=>String(t.name||'').trim().toLocaleLowerCase('pt-BR')))
 const added=[]
 for(let i=existing.length;i<count;i++){
  const number=start+i,unitName=name.slice(0,100)+' — Mesa '+String(number).padStart(2,'0')
  if(names.has(unitName.toLocaleLowerCase('pt-BR')))throw Error('Já existe '+unitName+'. Altere o nome do combo para diferenciar as mesas.')
  names.add(unitName.toLocaleLowerCase('pt-BR'))
  const original=i===0?first:null
  const unit={...(original||source),id:original?.id||id(),name:unitName,unitNumber:number,tableOfferId:parentId,reservationCategoryId:categoryId,reservationCategoryName:name.slice(0,60),reservationKind:'table',active:original?original.active!==false:parent.tableUnitsActive,available:1,mapPositioned:original?original.mapX!=null&&original.mapY!=null:false}
  for(const field of ['numberedCategoryId','tableCount','tableStart','tableUnitsActive'])delete unit[field]
  if(!original){delete unit.mapX;delete unit.mapY}
  added.push(unit)
 }
 const categories=event.reservationCategories||[]
 // Rename the original before inserting the selector: save_event persists in order
 // and the database enforces unique names for exclusive SKUs.
 return {parentId,event:{...event,reservationCategories:categories.some(c=>c.id===categoryId)?categories:[...categories,{id:categoryId,name:name.slice(0,60),prefix:'Mesa'}],ticketTypes:event.ticketTypes.flatMap(t=>t.id===source.id?[...(first?[added.shift()]:[]),parent]:[t]).concat(added)}}
}
