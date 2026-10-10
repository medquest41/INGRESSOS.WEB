import documents from '../legal/documents.json'
import company from '../legal/company.json'
import { supabase, result } from '../lib/supabase'
export const draftDocuments = documents
export const defaultCompany = company
export async function legalCatalog() {
  if (!supabase) return { company, documents: Object.entries(documents).map(([slug,d])=>({slug,version:d.content.version,content:d.canonical,content_hash:d.hash,published:false})), ready:false }
  const [config,rows] = await Promise.all([result(supabase.from('legal_config').select('*').single()),result(supabase.from('legal_documents').select('*'))])
  const current=rows.filter(d=>d.published&&config.active_versions[d.slug]===d.version)
  const ready=config.company.reviewed===true&&Boolean(config.company.legalName&&config.company.address)&&['termos','privacidade'].every(slug=>current.some(d=>d.slug===slug))
  return {company:config.company,documents:current,ready,programEnabled:config.program_enabled}
}
export const acceptanceClaims = (catalog,slugs) => slugs.map(slug=>{const d=catalog?.documents.find(d=>d.slug===slug&&d.published);if(!catalog?.ready||!d)throw Error('Documento pendente de revisão e publicação.');return {slug,version:d.version,hash:d.content_hash,accepted:true}})
export async function acceptDocuments(catalog,slugs,purpose) {return result(supabase.rpc('accept_legal_documents',{claims:acceptanceClaims(catalog,slugs),purpose}))}
