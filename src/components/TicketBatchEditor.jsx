import { toBrasiliaInput, fromBrasiliaInput } from '../utils/batchTime'
import './TicketBatchEditor.css'

export default function TicketBatchEditor({ ticket, index, isLocalDemo, onChange, onRemove }) {
  return <article className="ticket-batch-editor" aria-label={`Ingresso ${index + 1}`}>
    <header>
      <div><span>INGRESSO {index + 1}</span><h4>{ticket.name || 'Novo ingresso'}</h4></div>
      <button type="button" className="danger" onClick={onRemove}>Excluir este ingresso</button>
    </header>
    <div className="ticket-batch-fields">
      <label>Nome do ingresso<input value={ticket.name} onChange={e => onChange('name', e.target.value)} placeholder="Ex.: Pista ou VIP" /></label>
      <label>Setor<input value={ticket.sector || ''} onChange={e => onChange('sector', e.target.value)} placeholder="Ex.: Pista, VIP ou Open Bar" /></label>
      <label>Nome do lote<input value={ticket.batch || ''} onChange={e => onChange('batch', e.target.value)} placeholder="Ex.: 1º lote" /></label>
      <label className="ticket-price-field">Preço do ingresso (R$)<input aria-label="Preço do ingresso (R$)" type="number" inputMode="decimal" min="0" step="0.01" value={Number(ticket.price) === 0 ? '' : ticket.price} placeholder="" onChange={e => onChange('price', e.target.value)} /><small>Valor de uma unidade. Ex.: 85,00. Zero significa gratuito.</small></label>
      <label>Quantidade de ingressos<input aria-label="Quantidade de ingressos" type="number" inputMode="numeric" min="0" step="1" value={ticket.available} onChange={e => onChange('available', e.target.value)} /><small>Estoque total deste lote, incluindo unidades já vendidas.</small></label>
      <label>Tipo de entrada<select value={ticket.type} onChange={e => onChange('type', e.target.value)}><option value="individual">Individual — uma pessoa</option><option value="table">Mesa / camarote — entrada de grupo</option></select><small>{ticket.type === 'table' ? 'O preço é por mesa ou camarote, não por pessoa.' : 'Cada unidade corresponde a um ingresso individual.'}</small></label>
    </div>
    {!isLocalDemo && <>
      <label className="ticket-batch-check"><input type="checkbox" checked={ticket.active !== false} onChange={e => onChange('active', e.target.checked)} /><span>Disponível para venda</span></label>
      <details className="ticket-batch-schedule">
        <summary>Período de venda e ordem dos lotes</summary>
        <p>Opcional. Sem datas, o lote fica disponível enquanto houver estoque. Horário de Brasília.</p>
        <div className="ticket-batch-fields">
          <label>Começar as vendas em<input type="datetime-local" value={toBrasiliaInput(ticket.startsAt)} onChange={e => onChange('startsAt', fromBrasiliaInput(e.target.value))} /></label>
          <label>Encerrar as vendas em<input type="datetime-local" value={toBrasiliaInput(ticket.endsAt)} onChange={e => onChange('endsAt', fromBrasiliaInput(e.target.value))} /></label>
          <label>Ordem do lote<input type="number" min="0" step="1" value={ticket.position || 0} onChange={e => onChange('position', Number(e.target.value))} /><small>Use 1 para o primeiro lote, 2 para o segundo, e assim por diante.</small></label>
        </div>
        <label className="ticket-batch-check"><input type="checkbox" checked={Boolean(ticket.sequential)} onChange={e => onChange('sequential', e.target.checked)} /><span>Liberar somente após os lotes anteriores deste setor</span></label>
      </details>
    </>}
  </article>
}

