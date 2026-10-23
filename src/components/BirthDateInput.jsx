const displayDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value.split('-').reverse().join('/') : value || ''
export default function BirthDateInput({value,onChange,...props}) {
 return <input {...props} type="text" inputMode="numeric" autoComplete="bday" placeholder="DD/MM/AAAA" maxLength={10} pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}" title="Digite a data no formato DD/MM/AAAA" value={displayDate(value)} onChange={event=>{
  const digits=event.target.value.replace(/\D/g,'').slice(0,8)
  const masked=digits.slice(0,2)+(digits.length>2?'/'+digits.slice(2,4):'')+(digits.length>4?'/'+digits.slice(4):'')
  onChange(digits.length===8?digits.slice(4)+'-'+digits.slice(2,4)+'-'+digits.slice(0,2):masked)
 }}/>
}
