/**
 * Dados da abertura narrativa, montados a partir do contrato (camada Gold).
 * Nada é recalculado aqui: as medidas vêm de fato_resumo_episodio e fato_comparacao (regra 4.6);
 * as curvas vêm de fato_valor_alinhado. Episódios novos entram sozinhos (RNF04).
 */
import type { BaseDados, ResumoEpisodio, Serie } from '../lib/contrato'

export interface EpisodioNarrativa {
  id: string
  rotulo: string
  pico: string
  vale: string
  /** Duração da recessão americana em meses (pico ao vale do NBER). */
  duracao: number
  /** valor_painel por mês relativo, de -antes a +depois. */
  br: (number | null)[]
  us: (number | null)[] | null
  resumoBr: ResumoEpisodio
  resumoUs: ResumoEpisodio | null
  defasagem: number | null
}

export interface Narrativa {
  antes: number
  depois: number
  serieBr: Serie
  serieUs: Serie | null
  episodios: EpisodioNarrativa[]
  cronologia: { pico: string; vale: string }[]
  edicao: string
}

const mesesDe = (aaaamm: string) => {
  const [a, m] = aaaamm.split('-').map(Number)
  return a * 12 + (m - 1)
}
export { mesesDe }

export function montarNarrativa(b: BaseDados, idSerieBr: string, antes: number, depois: number): Narrativa | null {
  const serieBr = b.series.find((s) => s.id === idSerieBr)
  if (!serieBr) return null
  const serieUs = b.series.find((s) => s.id === serieBr.id_serie_par) ?? null
  const curva = (id: string, ep: string) => {
    const linhas = b.valores.filter((v) => v.id_serie === id && v.id_episodio === ep)
    if (!linhas.length) return null
    const arr: (number | null)[] = Array.from({ length: antes + depois + 1 }, () => null)
    for (const v of linhas) if (v.mes_relativo >= -antes && v.mes_relativo <= depois) arr[v.mes_relativo + antes] = v.valor_painel
    return arr
  }
  const episodios: EpisodioNarrativa[] = []
  for (const e of b.episodios) {
    const br = curva(serieBr.id, e.id)
    const resumoBr = b.resumos.find((r) => r.id_serie === serieBr.id && r.id_episodio === e.id)
    if (!br || !resumoBr || resumoBr.situacao_recuperacao === 'sem_dados') continue
    const comp = b.comparacoes.find((c) => c.id_episodio === e.id && c.id_serie_br === serieBr.id)
    episodios.push({
      id: e.id,
      rotulo: e.rotulo,
      pico: e.pico,
      vale: e.vale,
      duracao: mesesDe(e.vale) - mesesDe(e.pico),
      br,
      us: serieUs ? curva(serieUs.id, e.id) : null,
      resumoBr,
      resumoUs: serieUs ? (b.resumos.find((r) => r.id_serie === serieUs.id && r.id_episodio === e.id) ?? null) : null,
      defasagem: comp?.defasagem_meses ?? null,
    })
  }
  return { antes, depois, serieBr, serieUs, episodios, cronologia: b.cronologia, edicao: b.edicao.id_edicao }
}

/** Valor da curva num mês fracionário (interpolação linear entre meses vizinhos), só para animar. */
export function valorEm(curva: (number | null)[] | null, antes: number, m: number): number | null {
  if (!curva) return null
  const x = Math.max(0, Math.min(curva.length - 1, m + antes))
  const i = Math.floor(x)
  const k = x - i
  const a = curva[i]
  const b = curva[Math.min(curva.length - 1, i + 1)]
  if (a == null || b == null) return a ?? b ?? null
  return a + (b - a) * k
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
/** "mar 1982" para o mês m (relativo ao pico) de um episódio. */
export function dataDoMes(pico: string, m: number): string {
  const t = mesesDe(pico) + Math.round(m)
  return `${MESES[((t % 12) + 12) % 12]} ${Math.floor(t / 12)}`
}
/** Ano fracionário do mês m (relativo ao pico), para o eixo de calendário. */
export function anoDoMes(pico: string, m: number): number {
  return (mesesDe(pico) + m) / 12
}
