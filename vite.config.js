import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolveRuntime } from './src/lib/runtime.js'
export default defineConfig(({mode,command})=>{
 const env=loadEnv(mode,process.cwd(),'VITE_')
 for(const [name,value] of Object.entries(env)){
  let role='';try{role=JSON.parse(atob(value.split('.')[1]||'')).role||''}catch{/* Not a JWT. */}
  if(/SECRET|SERVICE_ROLE|PASSWORD|ACCESS_TOKEN|PRIVATE_KEY/.test(name)||value.startsWith('sb_secret_')||role==='service_role')throw new Error('Uma variável VITE_ contém credencial privada. Remova-a antes de continuar.')
 }
 if(command==='build'&&resolveRuntime(env,false).mode!=='supabase')throw new Error('Build de produção requer URL e chave pública Supabase válidas.')
 return {plugins:[react()],build:{rollupOptions:{output:{manualChunks(id){if(id.includes('node_modules/@supabase/'))return 'supabase';if(/node_modules[\\/](react|react-dom|react-router)/.test(id))return 'react'}}}}}
})
