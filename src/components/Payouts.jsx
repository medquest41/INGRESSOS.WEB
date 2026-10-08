import { useState } from 'react'
import { payoutAmount } from '../utils/fees'
const brl = value => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
export default function Payouts({ orders, events, canRecord, recordPayout, isLocalDemo }) {
  const [references, setReferences] = useState({})
  const [busy, setBusy] = useState(null)
  const [message, setMessage] = useState('')
  const paid = orders.filter(order => order.status === 'approved' && order.total > 0)
  const records = orders.filter(order => order.total > 0 && (order.status === 'approved' || order.payoutStatus === 'paid' || order.paymentReview))
  const pending = paid.filter(order => order.payoutStatus !== 'paid')
  const known = pending.filter(order => payoutAmount(order) != null)
  const eligible = known.filter(order => payoutAmount(order) > 0)
  async function record(order) {
    if (busy) return
    setBusy(order.id); setMessage('')
    try { await recordPayout(order.id, references[order.id] || ''); setMessage('Repasse registrado. Este registro não realiza uma transferência bancária.') } catch (err) { setMessage(err.message) } finally { setBusy(null) }
  }
  return <section className="admin-panel">
    <h2>Repasses aos organizadores</h2>
    <p>{isLocalDemo ? 'Simulação local. ' : ''}As vendas entram no Mercado Pago da plataforma. Faça o Pix ou transferência e depois registre a referência aqui. Este painel não movimenta dinheiro.</p>
    <p>O saldo calculado não indica que o dinheiro já está disponível para saque. Confira a liberação, estornos e contestações no Mercado Pago antes de fazer o repasse.</p>
    <div className="admin-stats">
      <div><span>Comissão da plataforma</span><strong>{brl(paid.reduce((sum,o)=>sum+Number(o.platformFee??o.fee??0),0))}</strong></div>
      <div><span>Tarifas Mercado Pago conhecidas</span><strong>{brl(paid.reduce((sum,o)=>sum+Number(o.providerFee??0),0))}</strong></div>
      <div><span>A repassar — tarifas conhecidas</span><strong>{brl(eligible.reduce((sum,o)=>sum+payoutAmount(o),0))}</strong></div>
      <div><span>Repasse realizado — histórico</span><strong>{brl(records.filter(o=>o.payoutStatus==='paid').reduce((sum,o)=>sum+(o.payoutActual??payoutAmount(o)??0),0))}</strong></div>
    </div>
    {pending.length!==known.length && <p>Há {pending.length-known.length} pedido(s) aguardando a tarifa verificada do Mercado Pago. Esses valores ainda não entram no saldo a repassar.</p>}
    <p role="status">{message}</p>
    {orders.some(o=>o.paymentReview) && <p role="alert">Existem estornos ou contestações em revisão. Esses pedidos estão bloqueados para novos repasses. Confira o histórico e reconcilie os valores, inclusive repasses já realizados.</p>}
    {!records.length && <p>Nenhuma venda paga confirmada.</p>}
    {records.map(order => { const amount = payoutAmount(order); return <div className="order-row" key={order.id}>
      <div><strong>{order.eventTitle} • {order.id}</strong><span>{events.find(e=>e.id===order.eventId)?.organizerName}</span><span>Recebido: {brl(order.total)} • Sua comissão: {brl(order.platformFee??order.fee??0)}</span><span>Tarifa Mercado Pago: {order.providerFee==null?'Aguardando confirmação':brl(order.providerFee)} • Saldo: {amount==null?'A apurar':brl(amount)}</span><span>{order.payoutStatus==='paid'?'Realizado':'Pendente'}{order.payoutReference?' • '+order.payoutReference:''}{order.payoutAt?' • '+new Date(order.payoutAt).toLocaleString('pt-BR'):''}</span></div>
      {canRecord && order.payoutStatus!=='paid' && amount>0 && <div><label>Referência do Pix ou transferência<input value={references[order.id]||''} minLength="3" maxLength="200" disabled={Boolean(busy)} onChange={e=>setReferences({...references,[order.id]:e.target.value})}/></label><button className="ghost-btn" disabled={Boolean(busy)||!(references[order.id]?.trim().length>=3)} onClick={()=>record(order)}>{busy===order.id?'Registrando…':'Registrar repasse realizado'}</button></div>}
    </div> })}
  </section>
}
