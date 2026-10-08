import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { hasServerAddress } from './launcher-status.mjs'

const url = 'http://127.0.0.1:5188/'
const root = fileURLToPath(new URL('../', import.meta.url))
const vite = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url))
console.log(`\nINGRESSOS WEB — ${url}\nMantenha esta janela aberta enquanto usar o site.\n`)
const server = spawn(process.execPath, [vite, '--host', '127.0.0.1', '--port', '5188', '--strictPort'], {
  cwd: root, stdio: ['inherit', 'pipe', 'pipe'], windowsHide: true,
})
let ready = false
let stopped = false
let output = ''
const timer = setTimeout(() => {
  console.error('O servidor nao iniciou em 60 segundos. Confira os erros acima.')
  server.kill()
  process.exitCode = 1
}, 60000)
async function readOutput(chunk, stream) {
  stream.write(chunk)
  output = (output + chunk.toString()).slice(-10000)
  if (ready || !hasServerAddress(output, url)) return
  ready = true
  clearTimeout(timer)
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3000) })
    const html = await response.text()
    if (!response.ok || !html.includes('<title>Ingressos Experiences</title>') || !html.includes('/src/main.jsx')) {
      throw new Error('O endereco respondeu com outro site. O navegador nao foi aberto.')
    }
    if (stopped) return
    console.log(`\nSite de ingressos pronto: ${url}\n`)
    if (process.platform === 'win32' && !process.argv.includes('--no-browser')) {
      const browser = spawn('cmd.exe', ['/d', '/c', 'start', '', url], { windowsHide: true })
      browser.on('error', () => console.error(`Abra manualmente: ${url}`))
    }
  } catch (error) {
    console.error(error.message)
    server.kill()
    process.exitCode = 1
  }
}
server.stdout.on('data', chunk => { void readOutput(chunk, process.stdout) })
server.stderr.on('data', chunk => { void readOutput(chunk, process.stderr) })
server.on('error', error => {
  stopped = true
  clearTimeout(timer)
  console.error(`Falha ao iniciar: ${error.message}`)
  process.exitCode = 1
})
server.on('exit', code => {
  stopped = true
  clearTimeout(timer)
  if (code) console.error('\nSe a porta 5188 estiver ocupada, feche a janela anterior do Ingressos e tente novamente. Nenhum outro projeto foi encerrado.')
  process.exitCode = process.exitCode || code || 0
})
process.on('SIGINT', () => { server.kill(); clearTimeout(timer) })
