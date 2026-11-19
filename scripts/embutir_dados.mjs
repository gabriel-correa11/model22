// Embute os JSONs de public/data no index.html gerado por `vite build --mode unico`.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const pasta = 'public/data'
const dados = {}
for (const f of readdirSync(pasta).filter((n) => n.endsWith('.json'))) {
  dados[f] = JSON.parse(readFileSync(join(pasta, f), 'utf8'))
}
const alvo = 'dist-unico/index.html'
const html = readFileSync(alvo, 'utf8')
const bloco = `<script>window.__DADOS__=${JSON.stringify(dados).replace(/</g, '\\u003c')}</script>`
writeFileSync(alvo, html.replace('<head>', `<head>${bloco}`))
console.log(`${Object.keys(dados).length} arquivos embutidos em ${alvo}`)
