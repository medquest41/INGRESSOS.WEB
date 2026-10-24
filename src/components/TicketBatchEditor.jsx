import { toBrasiliaInput, fromBrasiliaInput } from '../utils/batchTime'
import './TicketBatchEditor.css'

export default function TicketBatchEditor({ ticket, index, isLocalDemo, hasOrders=false, hidden=false, onChange, onRemove }) {
  return <details hidden={hidden} className="ticket-batch-editor" data-ticket-index={index} aria-label={`Ingresso ${index + 1}`}><summary className="ticket-batch-summary"><span><small>INGRESSO {index+1}</small><strong>{ticket.name||'Novo ingresso'}{ticket.retiredForSales?' • Histórico preservado':''}{ticket.batch?' • '+ticket.batch:''}</strong><span>{ticket.price!==''&&ticket.price!=null?Number(ticket.price).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'Preço a preencher'} • {ticket.type==='camarote'?(ticket.wristbands!==''&&ticket.wristbands!=null?ticket.wristbands+' ingressos por unidade':'Ingressos por unidade a preencher'):(ticket.available!==''&&ticket.available!=null?ticket.available+' unidades':'Estoque a preencher')}</span></span><span className="ticket-batch-expand"><span className="ticket-show">Abrir edição ▾</span><span className="ticket-hide">Recolher ▴</span></span></summary><div className="ticket-batch-content">
    <header>
      <div><span>INGRESSO {index + 1}</span><h4>{ticket.name || 'Novo ingresso'}</h4></div>
      <button type="button" className="danger" onClick={onRemove}>Excluir este ingresso</button>
    </header>
    <div className="ticket-batch-fields">{ticket.reservationCategoryName&&<p>Categoria: <strong>{ticket.reservationCategoryName}</strong></p>}
      <label>Nome do ingresso<input data-field="name" value={ticket.name} onChange={e => onChange('name', e.target.value)} placeholder="Ex.: Pista, VIP, Camarote 01" /></label>
      {ticket.salesPredecessorId&&<p role="status">Nova opção de Grupo para as próximas compras. Ao salvar, o cadastro anterior sai das novas vendas e seus pedidos e QR Codes continuam preservados.</p>}
      {ticket.retiredForSales&&<p role="note">Cadastro anterior preservado para consultar o histórico. As novas vendas usam a opção de Grupo criada separadamente.</p>}
      {hasOrders&&<p role="note">Este cadastro já tem pedidos. Para vender com outra quantidade de ingressos inclusos, adicione um novo tipo de ingresso ou uma nova unidade. Os pedidos e QR Codes anteriores são preservados.</p>}
      <label>Tipo de entrada<select value={ticket.type==='camarote'&&ticket.reservationKind==='group'?'group':ticket.type==='camarote'&&ticket.reservationKind==='table'?'vip-table':ticket.type} onChange={e => {onChange('reservationKind',e.target.value==='group'?'group':e.target.value==='vip-table'?'table':'camarote');onChange('type', ['group','vip-table'].includes(e.target.value)?'camarote':e.target.value);if(['group','camarote','vip-table'].includes(e.target.value)){onChange('available',1);onChange('wristbands',ticket.wristbands??'')}}}><option value="individual">Individual — uma pessoa</option><option value="group">Grupo — vários ingressos com QR individuais</option><option value="camarote">Unidade inteira — ingressos individuais</option><option value="vip-table">Mesa VIP inteira — ingressos individuais (existente)</option>{ticket.type==='table'&&<option value="table">Legado: mesa com apenas 1 QR para o grupo</option>}</select><small>{ticket.type==='camarote'?'Cada unidade é vendida inteira. Cada ingresso incluso terá um QR exclusivo.':ticket.type === 'table' ? 'Esta opção antiga emite apenas 1 QR para todo o grupo. Para emitir vários ingressos, escolha Grupo e informe a quantidade. Pedidos anteriores não serão modificados.' : 'Cada unidade corresponde a um ingresso individual.'}</small></label>
      <label>Setor<input value={ticket.sector || ''} onChange={e => onChange('sector', e.target.value)} placeholder="Ex.: Pista Premium, VIP ou Camarotes" /></label>
      <label>O que este ingresso inclui<textarea aria-label="O que este ingresso inclui" rows={3} maxLength={1500} value={ticket.description||''} onChange={e=>onChange('description',e.target.value)} placeholder="Ex.: acesso à área VIP. Informe os benefícios, restrições e se inclui bebidas ou alimentação."/></label>
      <label>Nome do lote<input value={ticket.batch || ''} onChange={e => onChange('batch', e.target.value)} placeholder="Ex.: 1º lote" /></label>
      <label className="ticket-price-field">{ticket.type==='camarote'?'Preço da unidade inteira (R$)':'Preço do ingresso (R$)'}<input aria-label="Preço do ingresso (R$)" type="number" inputMode="decimal" min="0" step="0.01" data-field="price" value={ticket.price??''} placeholder="" onChange={e => onChange('price', e.target.value)} /><small>Valor de uma unidade. Ex.: 85,00. Zero significa gratuito.</small></label>
      <label>{ticket.type==='camarote'?'Estoque exclusivo desta unidade':'Estoque do lote (unidades à venda)'}<input aria-label="Quantidade de ingressos" type="number" inputMode="numeric" min="0" step="1" disabled={ticket.type==='camarote'} data-field="available" value={ticket.type==='camarote'?1:ticket.available??''} onChange={e => onChange('available', e.target.value)} /><small>Estoque total à venda, incluindo unidades já vendidas. Os ingressos inclusos são definidos separadamente.</small></label>
      {ticket.type!=='camarote'&&/camarote/i.test(ticket.name||'')&&<p role="note">Este ingresso está configurado para emitir um QR por unidade comprada. Para vender o camarote inteiro com vários QR Codes, escolha “Grupo — vários ingressos com QR individuais” e informe as pulseiras inclusas.</p>}
      {ticket.type==='camarote'&&<><label>{ticket.reservationKind==='group'?'Quantidade de ingressos por grupo':'Ingressos gerados por unidade'}<input aria-label="Pulseiras inclusas" type="number" min="1" max="100" step="1" required data-field="wristbands" value={ticket.wristbands??''} onChange={e=>onChange('wristbands',e.target.value)}/><small>Escolha de 1 a 100 ingressos. Ex.: 10 gera 10 QR Codes exclusivos, com uma entrada por pessoa, após o pagamento confirmado. O preço acima é pela unidade inteira.</small></label><p>Use “Categorias e unidades numeradas” para criar vários números de uma vez. Cada cartão representa uma unidade exclusiva.</p></>}
    </div>
    {(!isLocalDemo||ticket.type==='camarote') && <>
      <label className="ticket-batch-check"><input type="checkbox" checked={ticket.active !== false} onChange={e => onChange('active', e.target.checked)} /><span>Disponível para venda</span></label>
      <details className="ticket-batch-schedule">
        <summary>Período de venda e ordem dos lotes</summary>
        <p>Opcional. Sem datas, o lote fica disponível enquanto houver estoque. Horário de Brasília.</p>
        <div className="ticket-batch-fields">
          <label>Começar as vendas em<input type="datetime-local" value={toBrasiliaInput(ticket.startsAt)} onChange={e => onChange('startsAt', fromBrasiliaInput(e.target.value))} /></label>
          <label>Encerrar as vendas em<input type="datetime-local" value={toBrasiliaInput(ticket.endsAt)} onChange={e => onChange('endsAt', fromBrasiliaInput(e.target.value))} /></label>
          <label>Ordem do lote<input type="number" min="0" step="1" value={ticket.position??''} onChange={e => onChange('position', e.target.value===''?'':Number(e.target.value))} /><small>Use 1 para o primeiro lote, 2 para o segundo, e assim por diante.</small></label>
        </div>
        <label className="ticket-batch-check"><input type="checkbox" checked={Boolean(ticket.sequential)} onChange={e => onChange('sequential', e.target.checked)} /><span>Liberar somente após os lotes anteriores deste setor</span></label>
      </details>
    </>}
  </div></details>
}


