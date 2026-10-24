export function duplicateUnit(tickets=[]){const names=new Set();for(let i=0;i<tickets.length;i++){const t=tickets[i];if(t.type!=='camarote')continue;const name=String(t.name||'').trim().toLowerCase();if(names.has(name))return i;names.add(name)}return -1}
export function eventSaveError(error,tickets=[]){
 const raw=String(error?.message||error||'')
 if(/camarote_event_name_unique/.test(raw)){const index=duplicateUnit(tickets);return {message:'Já existe uma unidade com este nome no evento. Cada camarote, mesa ou grupo precisa de um nome diferente. Altere o nome repetido e salve novamente.',selector:index>=0?`.ticket-batch-editor[data-ticket-index="${index}"] [data-field="name"]`:'.ticket-batch-editor [data-field="name"]'}}
 if(/duplicate key|unique constraint|23505/i.test(raw))return {message:'Já existe um cadastro com estes dados. Confira os nomes e identificadores antes de salvar novamente.'}
 if(/failed to fetch|network|timeout|fetch failed/i.test(raw))return {message:'Não foi possível conectar para salvar. Confira sua internet e tente novamente. Seu preenchimento continua nesta tela.'}
 if(/permission denied|row.level security|not authorized|jwt expired/i.test(raw))return {message:'Sua sessão expirou ou não tem permissão para salvar. Entre novamente com uma conta autorizada.'}
 if(/constraint|sql|postgres|relation .*does not exist|column .*does not exist|invalid input syntax/i.test(raw))return {message:'Não foi possível salvar porque um dado foi recusado pelo sistema. Revise o cadastro. Se continuar, informe o suporte; seu preenchimento permanece nesta tela.'}
 return {message:raw||'Não foi possível salvar. Confira os campos e tente novamente.'}
}
export function focusEditorError(message,selector,root=document){
 root.querySelectorAll('.event-editor [aria-invalid="true"]').forEach(el=>{el.removeAttribute('aria-invalid');el.removeAttribute('aria-describedby')})
 root.querySelectorAll('.event-field-error').forEach(el=>el.remove())
 root.querySelectorAll('.event-editor label[data-error]').forEach(el=>{delete el.dataset.error})
 const field=root.querySelector(selector||'.event-save-error')||root.querySelector('.event-save-error')
 if(!field)return
 for(let parent=field.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true
 field.setAttribute('aria-invalid','true')
 const label=field.closest('label')
 if(label){const hint=root.createElement('span');hint.className='event-field-error';hint.id='event-field-error';hint.textContent=message;hint.setAttribute('role','alert');label.append(hint);field.setAttribute('aria-describedby',hint.id)}
 field.scrollIntoView({behavior:'smooth',block:'center'});field.focus({preventScroll:true})
}
