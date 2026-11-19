import { computed, reactive, ref } from 'vue'
import type { BaseDados, Serie, ValorAlinhado } from './contrato'
import { config } from '../config'

export const base = ref<BaseDados | null>(null)

/** Filtros globais (RF08). Valem para todas as abas. Valores iniciais vêm de config/painel.json. */
export const filtros = reactive({
  grupo: 'todos' as string,
  pais: 'todos' as string,
  serieId: config.padroes.serie,
  episodios: [] as string[],
  antes: config.padroes.antes,
  depois: config.padroes.depois,
})

export const aba = ref<string>(config.abas[0].id)

/** Chamado depois de carregar os dados: seleciona todos os episódios cadastrados. */
export function iniciarFiltros(b: BaseDados) {
  filtros.episodios = b.episodios.map((e) => e.id)
  if (!b.series.some((s) => s.id === filtros.serieId)) filtros.serieId = b.series[0]?.id ?? ''
}

export function nomePais(id: string) {
  return base.value?.paises.find((p) => p.id === id)?.nome ?? id
}

/** Cor do episódio pela posição em dim_episodio, nunca pelo id: um episódio novo ganha a próxima cor. */
export function corEpisodio(id: string) {
  const i = base.value?.episodios.findIndex((e) => e.id === id) ?? -1
  const slot = config.cores.episodios[i]
  return slot ? `var(--cat-${slot})` : 'var(--texto-3)'
}

/** Países não usam matiz: o país em foco vai em tinta, os demais em cinza de contexto. */
export function corPais(id: string) {
  return id === config.cores.pais_foco ? 'var(--pais-foco)' : 'var(--pais-contexto)'
}

export function paisTracejado(id: string) {
  return config.cores.paises_tracejados.includes(id)
}

export const seriesFiltradas = computed<Serie[]>(() => {
  if (!base.value) return []
  return base.value.series.filter(
    (s) => (filtros.grupo === 'todos' || s.grupo === filtros.grupo) && (filtros.pais === 'todos' || s.pais === filtros.pais),
  )
})

export const serieAtual = computed<Serie | undefined>(() => base.value?.series.find((s) => s.id === filtros.serieId))

export const episodiosAtivos = computed(() =>
  (base.value?.episodios ?? []).filter((e) => filtros.episodios.includes(e.id)),
)

const indiceValores = computed(() => {
  const m = new Map<string, ValorAlinhado[]>()
  for (const v of base.value?.valores ?? []) {
    const k = `${v.id_serie}|${v.id_episodio}`
    let l = m.get(k)
    if (!l) m.set(k, (l = []))
    l.push(v)
  }
  for (const l of m.values()) l.sort((a, b) => a.mes_relativo - b.mes_relativo)
  return m
})

export function valoresNaJanela(idSerie: string, idEpisodio: string): ValorAlinhado[] {
  return (indiceValores.value.get(`${idSerie}|${idEpisodio}`) ?? []).filter(
    (v) => v.mes_relativo >= -filtros.antes && v.mes_relativo <= filtros.depois,
  )
}

export function resumoDe(idSerie: string, idEpisodio: string) {
  return base.value?.resumos.find((r) => r.id_serie === idSerie && r.id_episodio === idEpisodio)
}

export function serie(id: string | null | undefined) {
  return base.value?.series.find((s) => s.id === id)
}

export function nomeGrupo(id: string) {
  return base.value?.grupos.find((g) => g.id === id)?.nome ?? id
}

export function rotuloEpisodio(id: string) {
  return base.value?.episodios.find((e) => e.id === id)?.rotulo ?? id
}
