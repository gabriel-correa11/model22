/**
 * Contrato de dados entre o ETL (camada Gold) e o painel.
 * Cada tipo corresponde a um arquivo JSON em public/data/.
 * Se o ETL mudar um campo, o vue-tsc acusa o erro aqui (ver CONTRATO.md).
 */

/** Código do país (dim_pais). String livre para aceitar novos países sem mudar o código (RNF04). */
export type Pais = string
export type TipoMetodo = 'indice' | 'pp'
export type SentidoCrise = 'queda' | 'alta' | 'neutro'
export type SituacaoRecuperacao = 'recuperado' | 'nao_recuperado' | 'nao_se_aplica' | 'sem_dados'

export interface Edicao {
  id_edicao: string
  gerado_em: string
  ilustrativo: boolean
  janela_meses: [number, number]
  janela_medidas_meses: number
  aviso?: string
}

export interface Episodio {
  id: string
  nome: string
  rotulo: string
  pico: string // AAAA-MM
  vale: string // AAAA-MM
  contexto: string
}

/** Cronologia completa do NBER: dá contexto na linha do tempo (inclui recessões fora da análise). */
export interface RecessaoNber {
  pico: string
  vale: string
}

export interface PaisDim {
  id: Pais
  nome: string
  nome_completo: string
}

export interface Grupo {
  id: string
  nome: string
}

export interface Fonte {
  portal: string
  produtor: string
  url: string
}

export interface Serie {
  id: string
  codigo: string
  nome: string
  pais: Pais
  grupo: string
  descricao: string
  fonte: Fonte
  unidade_original: string
  unidade_painel: string
  frequencia: string
  ajuste_sazonal: boolean
  metodo: { tipo: TipoMetodo; versao: string; descricao: string }
  sentido_crise: SentidoCrise
  limiar_reacao: number
  periodo_inicio: string
  periodo_fim: string
  mudancas_metodologia: { data: string; descricao: string }[]
  id_serie_par: string | null
  episodios_sem_dados: string[]
}

/** Uma linha por série × episódio × mês relativo ao pico (derivada de fato_valor_mensal). */
export interface ValorAlinhado {
  id_serie: string
  id_episodio: string
  mes_relativo: number
  data_referencia: string
  valor_original: number
  valor_painel: number
  data_coleta: string
  id_edicao: string
}

export interface ResumoEpisodio {
  id_serie: string
  id_episodio: string
  variacao_pico_vale: number | null
  meses_ate_vale: number | null
  meses_ate_recuperacao: number | null
  situacao_recuperacao: SituacaoRecuperacao
  mes_reacao?: number | null
  id_edicao: string
}

export interface Comparacao {
  id_episodio: string
  id_serie_eua: string
  id_serie_br: string
  defasagem_meses: number | null
  diferenca_variacao: number | null
  id_edicao: string
}

export interface Execucao {
  id_execucao: string
  inicio: string
  duracao_min: number
  tipo: 'atualizacao' | 'reprocessamento'
  status: 'sucesso' | 'falha'
  series_processadas: number
  registros: number
  id_edicao: string
  observacao: string
}

export interface BaseDados {
  edicao: Edicao
  episodios: Episodio[]
  grupos: Grupo[]
  paises: PaisDim[]
  cronologia: RecessaoNber[]
  series: Serie[]
  valores: ValorAlinhado[]
  resumos: ResumoEpisodio[]
  comparacoes: Comparacao[]
  execucoes: Execucao[]
}

declare global {
  interface Window {
    /** Preenchido só na versão em arquivo único (npm run build:unico), que embute os JSONs na página. */
    __DADOS__?: Record<string, unknown>
  }
}

async function ler<T>(arquivo: string): Promise<T> {
  const embutido = window.__DADOS__?.[arquivo]
  if (embutido !== undefined) return embutido as T
  const r = await fetch(`${import.meta.env.BASE_URL}data/${arquivo}`)
  if (!r.ok) throw new Error(`Não foi possível ler ${arquivo} (HTTP ${r.status})`)
  return r.json() as Promise<T>
}

export async function carregarBase(): Promise<BaseDados> {
  const [edicao, episodios, grupos, paises, cronologia, series, valores, resumos, comparacoes, execucoes] = await Promise.all([
    ler<Edicao>('edicao.json'),
    ler<Episodio[]>('dim_episodio.json'),
    ler<Grupo[]>('dim_grupo.json'),
    ler<PaisDim[]>('dim_pais.json'),
    ler<RecessaoNber[]>('cronologia_nber.json').catch(() => []),
    ler<Serie[]>('dim_serie.json'),
    ler<ValorAlinhado[]>('fato_valor_alinhado.json'),
    ler<ResumoEpisodio[]>('fato_resumo_episodio.json'),
    ler<Comparacao[]>('fato_comparacao.json'),
    ler<Execucao[]>('execucoes.json'),
  ])
  return { edicao, episodios, grupos, paises, cronologia, series, valores, resumos, comparacoes, execucoes }
}
