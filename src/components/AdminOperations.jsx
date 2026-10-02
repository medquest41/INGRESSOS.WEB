import { useState } from 'react'
import { useEventStore } from '../store/EventStore'
import { useAuth } from '../store/AuthStore'
import { approved, ownsEvent } from '../utils/commerce'
const brl = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
function download(name, rows) {
  const cell = v => '"' + String(v ?? '').replace(/^[=+@-]/, "'$&").replaceAll('"', '""') + '"'
  const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(row=>row.map(cell).join(';')).join('\r\n')], {type:'text/csv;charset=utf-8'}))
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000)
}
export default function AdminOperations({ tab }) {
  const { events, orders, coupons, history, saveCoupon } = useEventStore()
  const { currentUser } = useAuth()
  const scoped = events.filter(e=>ownsEvent(currentUser,e))
  const sales = orders.filter(o=>scoped.some(e=>e.id===o.eventId))
  const paid = sales.filter(approved)
  const [draft,setDraft] = useState({ eventId: scoped[0]?.id || '', code:'', type:'percent', value:10, limit:0, expiresAt:'', active:true })
  const [message,setMessage] = useState('')
  async function save(e) { e.preventDefault(); try { await saveCoupon(draft); setMessage('Cupom salvo.'); setDraft({...draft,code:''}) } catch(err) { setMessage(err.message) } }
  const customers = [...new Map(sales.map(o=>[o.buyer?.email,o.buyer])).values()]
  return <><div className="admin-title"><h1>{{customers:'Clientes',coupons:'Cupons',finance:'Financeiro',reports:'Relatórios',history:'Histórico'}[tab]}.</h1></div>
    {tab==='customers' && <section className="admin-panel">{customers.length===0 && <p>Nenhum cliente ainda.</p>}{customers.map(b=><div className="order-row" key={b.email}><div><strong>{b.name}</strong><span>{b.email}</span></div><span>{b.phone}</span></div>)}</section>}
    {['finance','reports'].includes(tab) && <><div className="admin-stats">{[['Vendas aprovadas',brl(paid.reduce((s,o)=>s+o.total,0))],['Taxas',brl(paid.reduce((s,o)=>s+o.fee,0))],['Valor dos ingressos',brl(paid.reduce((s,o)=>s+o.subtotal-(o.discount||0),0))],['Cancelados',sales.filter(o=>!approved(o)).length]].map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><section className="admin-panel"><p className="demo-warning">Valores de simulação. Não representam saldo disponível, repasses ou pagamentos reais.</p><button className="primary-small" onClick={()=>download('relatorio-vendas.csv',[['Pedido','Evento','Status','Cliente','Quantidade','Subtotal','Desconto','Taxa','Total','Origem','Data'],...sales.map(o=>[o.id,o.eventTitle,o.status||'approved',o.buyer?.name,o.quantity,o.subtotal,o.discount||0,o.fee,o.total,o.source||'direto',o.createdAt])])}>Exportar vendas CSV</button><h2>Por evento e origem</h2>{scoped.map(e=><div className="order-row" key={e.id}><strong>{e.title}</strong><span>{brl(paid.filter(o=>o.eventId===e.id).reduce((s,o)=>s+o.total,0))}</span></div>)}{[...new Set(paid.map(o=>o.source||'direto'))].map(source=><div className="order-row" key={source}><span>{source}</span><strong>{paid.filter(o=>(o.source||'direto')===source).length} pedidos</strong></div>)}</section></>}
    {tab==='coupons' && <><form className="admin-panel buyer-form" onSubmit={save}><h2>Novo cupom</h2><div className="form-grid"><label>Evento<select required value={draft.eventId} onChange={e=>setDraft({...draft,eventId:e.target.value})}><option value="">Selecione</option>{scoped.map(e=><option key={e.id} value={e.id}>{e.title}</option>)}</select></label><label>Código<input required value={draft.code} onChange={e=>setDraft({...draft,code:e.target.value.toUpperCase()})}/></label><label>Tipo<select value={draft.type} onChange={e=>setDraft({...draft,type:e.target.value})}><option value="percent">Percentual</option><option value="fixed">Valor em reais</option></select></label><label>Valor<input required type="number" min="0.01" step="0.01" value={draft.value} onChange={e=>setDraft({...draft,value:e.target.value})}/></label><label>Limite de pedidos (0 = ilimitado)<input type="number" min="0" value={draft.limit} onChange={e=>setDraft({...draft,limit:e.target.value})}/></label><label>Validade<input type="date" value={draft.expiresAt} onChange={e=>setDraft({...draft,expiresAt:e.target.value})}/></label></div><button className="primary-small">Salvar cupom</button><p role="status">{message}</p></form><section className="admin-panel">{coupons.map(c=><div className="order-row" key={c.id}><div><strong>{c.code} — {c.type==='percent'?c.value+'%':brl(c.value)}</strong><span>{scoped.find(e=>e.id===c.eventId)?.title}</span></div><button className="ghost-btn" onClick={async()=>{try {await saveCoupon({...c,active:!c.active})}catch(err){setMessage(err.message)}}}>{c.active?'Desativar':'Ativar'}</button></div>)}</section></>}
    {tab==='history' && <section className="admin-panel">{history.length===0&&<p>Nenhuma operação registrada ainda.</p>}{history.map(h=><div className="order-row" key={h.id}><div><strong>{h.action}</strong><span>{h.actor} • {scoped.find(e=>e.id===h.eventId)?.title}</span></div><time>{new Date(h.at).toLocaleString('pt-BR')}</time></div>)}</section>}
  </>
}
