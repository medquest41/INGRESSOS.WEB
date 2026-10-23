import { toBrasiliaInput, fromBrasiliaInput } from '../utils/batchTime'
import './TicketBatchEditor.css'

export default function TicketBatchEditor({ ticket, index, isLocalDemo, onChange, onRemove }) {
  return <article className="ticket-batch-editor" aria-label={`Ingresso ${index + 1}`}>
    <header>
      <div><span>INGRESSO {index + 1}</span><h4>{ticket.name || 'Novo ingresso'}</h4></div>
      <button type="button" className="danger" onClick={onRemove}>Excluir este ingresso</button>
    </header>
    <div className="ticket-batch-fields">
      <label>Nome do ingresso<input value={ticket.name} onChange={e => onChange('name', e.target.value)} placeholder="Ex.: Pista, VIP, Camarote 01" /></label>
      <label>Tipo de entrada<select value={ticket.type} onChange={e => {onChange('type', e.target.value);if(e.target.value==='camarote'){onChange('available',1);onChange('wristbands',ticket.wristbands??8)}}}><option value="individual">Individual — uma pessoa</option><option value="camarote">Camarote inteiro — pulseiras individuais</option><option value="table">Mesa — QR único para o grupo</option></select><small>{ticket.type==='camarote'?'Preço do camarote inteiro. Cada pulseira terá um QR exclusivo.':ticket.type === 'table' ? 'O preço é por mesa ou camarote, não por pessoa.' : 'Cada unidade corresponde a um ingresso individual.'}</small></label>
      <label>Setor<input value={ticket.sector || ''} onChange={e => onChange('sector', e.target.value)} placeholder="Ex.: Pista Premium, VIP ou Camarotes" /></label>
      <label>O que este ingresso inclui<textarea aria-label="O que este ingresso inclui" rows={3} maxLength={1500} value={ticket.description||''} onChange={e=>onChange('description',e.target.value)} placeholder="Ex.: acesso à área VIP. Informe os benefícios, restrições e se inclui bebidas ou alimentação."/></label>
      <label>Nome do lote<input value={ticket.batch || ''} onChange={e => onChange('batch', e.target.value)} placeholder="Ex.: 1º lote" /></label>
      <label className="ticket-price-field">{ticket.type==='camarote'?'Preço do camarote inteiro (R$)':'Preço do ingresso (R$)'}<input aria-label="Preço do ingresso (R$)" type="number" inputMode="decimal" min="0" step="0.01" value={Number(ticket.price) === 0 ? '' : ticket.price} placeholder="" onChange={e => onChange('price', e.target.value)} /><small>Valor de uma unidade. Ex.: 85,00. Zero significa gratuito.</small></label>
      <label>{ticket.type==='camarote'?'Estoque deste camarote':'Estoque do lote (unidades à venda)'}<input aria-label="Quantidade de ingressos" type="number" inputMode="numeric" min="0" step="1" disabled={ticket.type==='camarote'} value={ticket.type==='camarote'?1:ticket.available} onChange={e => onChange('available', e.target.value)} /><small>Estoque total à venda, incluindo unidades já vendidas. Não é a quantidade de pulseiras por camarote.</small></label>
      {ticket.type!=='camarote'&&/camarote/i.test(ticket.name||'')&&<p role="note">Este ingresso está configurado para emitir um QR por unidade comprada. Para vender o camarote inteiro com vários QR Codes, escolha “Camarote inteiro — pulseiras individuais” e informe as pulseiras inclusas.</p>}
      {ticket.type==='camarote'&&<><label>Quantidade de ingressos por camarote<input aria-label="Pulseiras inclusas" type="number" min="1" max="100" step="1" required value={ticket.wristbands??8} onChange={e=>onChange('wristbands',Number(e.target.value))}/><small>Escolha de 1 a 100 ingressos. Ex.: 10 gera 10 QR Codes exclusivos, com uma entrada por pessoa, após o pagamento confirmado. O preço acima é pelo camarote inteiro.</small></label><p>Cadastre cada camarote numerado separadamente. Estoque exclusivo: um camarote. Desative a venda para bloquear pelo Admin.</p></>}
    </div>
    {(!isLocalDemo||ticket.type==='camarote') && <>
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

