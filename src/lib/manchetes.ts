/**
 * Títulos que dizem a conclusão do gráfico, montados a partir das medidas da camada Gold.
 * Os modelos de frase ficam em config/painel.json.
 */
import { config, texto } from '../config'
import type { Serie } from './contrato'
import { base, nomePais, resumoDe, rotuloEpisodio } from './estado'
import { variacao, meses } from './formatos'

/** Episódio com o maior desvio em relação ao pico: é o que o título cita e o que o gráfico destaca. */
export function episodioExtremo(s: Serie, episodios: string[]): string | null {
  let melhor: string | null = null
  let maior = -Infinity
  for (const id of episodios) {
    const v = resumoDe(s.id, id)?.variacao_pico_vale
    if (v != null && Math.abs(v) > maior) {
      maior = Math.abs(v)
      melhor = id
    }
  }
  return melhor
}

export function mancheteEpisodios(s: Serie, episodios: string[]): string {
  const sentido = config.textos.sentido[s.sentido_crise] ?? s.sentido_crise
  const comum = { indicador: s.nome, pais: nomePais(s.pais), sentido }
  const comDados = episodios
    .map((id) => ({ id, r: resumoDe(s.id, id) }))
    .filter((x) => x.r && x.r.variacao_pico_vale != null)

  if (!comDados.length) return texto('manchete_vazia', comum)
  if (comDados.length === 1) {
    const { id, r } = comDados[0]
    return texto('manchete_um', { ...comum, ep: rotuloEpisodio(id), valor: variacao(r!.variacao_pico_vale, s) })
  }

  const extremo = comDados.reduce((a, b) =>
    Math.abs(b.r!.variacao_pico_vale!) > Math.abs(a.r!.variacao_pico_vale!) ? b : a,
  )
  let frase = texto('manchete_varios', {
    ...comum,
    ep_extremo: rotuloEpisodio(extremo.id),
    valor_extremo: variacao(extremo.r!.variacao_pico_vale, s),
  })

  const recuperados = comDados.filter((x) => x.r!.situacao_recuperacao === 'recuperado')
  if (recuperados.length >= 2) {
    const rapido = recuperados.reduce((a, b) => (b.r!.meses_ate_recuperacao! < a.r!.meses_ate_recuperacao! ? b : a))
    frase += texto('manchete_recuperacao', { ep_rec: rotuloEpisodio(rapido.id), meses_rec: meses(rapido.r!.meses_ate_recuperacao) })
  }
  return frase
}

export function manchetePar(idSerieEua: string, episodios: string[]): string {
  const comps = (base.value?.comparacoes ?? []).filter(
    (c) => c.id_serie_eua === idSerieEua && episodios.includes(c.id_episodio) && c.defasagem_meses != null,
  )
  if (!comps.length) return texto('manchete_par_vazia')
  const validos = comps.length
  return texto('manchete_par', {
    depois: comps.filter((c) => c.defasagem_meses! > 0).length,
    validos: validos === 1 ? '1 episódio com dados nos dois países' : `${validos} episódios com dados nos dois países`,
  })
}

export function textoDefasagem(d: number | null | undefined): string {
  if (d == null) return texto('defasagem_sem')
  if (d === 0) return texto('defasagem_igual')
  return texto(d > 0 ? 'defasagem_depois' : 'defasagem_antes', { n: meses(Math.abs(d)) })
}

export function textoRecuperacao(situacao: string, n: number | null | undefined, curto = false): string {
  if (situacao === 'recuperado') return texto('recuperado', { n: meses(n) })
  if (situacao === 'nao_recuperado') return texto(curto ? 'nao_recuperado_curto' : 'nao_recuperado', { n: base.value?.edicao.janela_medidas_meses ?? '' })
  if (situacao === 'nao_se_aplica') return texto('nao_se_aplica')
  return '—'
}

/** Versão curta para tabelas: sinal + meses. */
export function defasagemCurta(d: number | null | undefined): string {
  if (d == null) return texto('defasagem_curta_sem')
  if (d === 0) return texto('defasagem_curta_igual')
  return texto(d > 0 ? 'defasagem_curta_depois' : 'defasagem_curta_antes', { n: meses(Math.abs(d)) })
}
