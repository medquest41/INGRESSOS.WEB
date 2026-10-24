import {addReservedCategory,generateReservedUnits,getReservedCategories,unitKind} from './reservedUnits.js'
export function prepareMapItems(event,{name,prefix,count,start,price,wristbands,size=5},id=()=>crypto.randomUUID()){
 const label=String(name||'').trim()
 let category=getReservedCategories(event).find(c=>c.name.toLocaleLowerCase('pt-BR')===label.toLocaleLowerCase('pt-BR'))
 const newCategory=!category
 if(!category)category=addReservedCategory(event,label,prefix,id).category
 const related=(event.ticketTypes||[]).filter(t=>unitKind(t)===category.id)
 const first=String(start??'').trim()===''?Math.max(0,...related.map(t=>Number(t.unitNumber)||0))+1:Number(start)
 const mapSize=Number(size);if(!Number.isFinite(mapSize)||mapSize<1||mapSize>14)throw Error('Escolha um tamanho entre 1% e 14%.')
 const units=generateReservedUnits(event.ticketTypes||[],{category,count:Number(count),start:first,price,wristbands:Number(wristbands)},id).slice((event.ticketTypes||[]).length).map(t=>({...t,mapSize}))
 return {category,newCategory,units}
}
