import { base, filtros, seriesFiltradas, serieAtual, valoresNaJanela, aba, nomePais } from './estado'

/** RF15: exporta em CSV (RFC 4180) os dados exibidos, respeitando os filtros. */
export async function exportarCsv() {
  const b = base.value
  if (!b) return
  const series = aba.value === 'episodios' && serieAtual.value ? [serieAtual.value] : seriesFiltradas.value
  const cab = [
    'serie_id', 'serie_codigo', 'serie_nome', 'pais', 'episodio', 'mes_relativo', 'data_referencia',
    'valor_original', 'unidade_original', 'valor_painel', 'unidade_painel', 'metodo', 'versao_metodo',
    'fonte', 'produtor', 'data_coleta', 'id_edicao',
  ]
  const linhas: string[][] = [cab]
  for (const s of series) {
    for (const e of b.episodios.filter((x) => filtros.episodios.includes(x.id))) {
      for (const v of valoresNaJanela(s.id, e.id)) {
        linhas.push([
          s.id, s.codigo, s.nome, nomePais(s.pais), e.rotulo, String(v.mes_relativo), v.data_referencia,
          String(v.valor_original), s.unidade_original, String(v.valor_painel), s.unidade_painel,
          s.metodo.tipo, s.metodo.versao, s.fonte.portal, s.fonte.produtor, v.data_coleta, v.id_edicao,
        ])
      }
    }
  }
  const esc = (c: string) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)
  const texto = '﻿' + linhas.map((l) => l.map(esc).join(',')).join('\r\n')
  const nome = `painel-recessoes_${aba.value}_${b.edicao.id_edicao}.csv`
  // Dentro do visualizador de páginas do Claude, o download passa pela permissão do próprio visualizador.
  const salvar = await baixadorDoVisualizador()
  if (salvar) {
    try {
      await salvar({ filename: nome, data: texto })
    } catch {
      /* o visitante recusou o download */
    }
    return
  }
  const url = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

type Salvar = (arq: { filename: string; data: string }) => Promise<unknown>
async function baixadorDoVisualizador(): Promise<Salvar | null> {
  const w = window as unknown as { claude?: { use?: (n: string) => Promise<{ save: Salvar } | null> } }
  if (!w.claude?.use) return null
  const d = await Promise.race([w.claude.use('downloads'), new Promise<null>((r) => setTimeout(() => r(null), 1500))])
  return d ? (arq) => d.save(arq) : null
}
