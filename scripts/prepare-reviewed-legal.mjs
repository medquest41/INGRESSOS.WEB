import {readFile,writeFile} from 'node:fs/promises'
// Generates a reviewable SQL artifact. Never connects to a database or deploys anything.
const [input,output]=process.argv.slice(2)
if(!input||!output)throw Error('Uso: node scripts/prepare-reviewed-legal.mjs revisao.json publicacao-revisada.sql')
const data=JSON.parse(await readFile(input,'utf8'))
const company=data.company,documents=data.documents
if(!company||company.reviewed!==true||['legalName','tradeName','cnpj','address','supportEmail','privacyEmail','legalEmail'].some(key=>!String(company[key]||'').trim()))throw Error('Confirme a identidade empresarial completa e a revisão jurídica.')
const slugs=['termos','privacidade','organizadores','promotores','cookies','cancelamentos'],versions={}
const q=value=>"'"+String(value).replaceAll("'","''")+"'"
let sql='begin;\n'
for(const slug of slugs){const content=documents?.[slug];if(!content||content.status!=='approved'||!content.version||['2026-10-10.1','2026-10-10.2'].includes(content.version)||!Array.isArray(content.sections)||!content.sections.length)throw Error('Forneça nova versão completa e aprovada: '+slug);versions[slug]=content.version;sql+=`insert into public.legal_documents(slug,version,content,published) values(${q(slug)},${q(content.version)},${q(JSON.stringify(content))},true);\n`}
sql+=`update public.legal_config set company=${q(JSON.stringify(company))}::jsonb,active_versions=${q(JSON.stringify(versions))}::jsonb,enforce_signup=true where id;\ninsert into public.audit_log(action) values('legal.reviewed-release');\ncommit;\n`
await writeFile(output,sql,'utf8');console.log('Arquivo SQL gerado para revisão. Não aplicado.')
