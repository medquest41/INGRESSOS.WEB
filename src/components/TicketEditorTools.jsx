import {searchText} from '../utils/unitSelection'
export default function TicketEditorTools({tickets,query,onQuery}){
 const count=tickets.filter(t=>searchText([t.name,t.sector,t.batch].join(' ')).includes(searchText(query))).length
 return <div className="ticket-editor-tools"><label>Buscar ingresso, camarote ou mesa<input type="search" value={query} placeholder="Ex.: Camarote 17" onChange={e=>onQuery(e.target.value)}/></label><span>{count} de {tickets.length} cadastros</span>{query&&<button type="button" className="ghost-btn" onClick={()=>onQuery('')}>Limpar busca</button>}<button type="button" className="ghost-btn" onClick={e=>e.currentTarget.closest('.editor-disclosure-content').querySelectorAll('.ticket-batch-editor').forEach(el=>{el.open=false})}>Recolher todos os ingressos</button></div>
}
