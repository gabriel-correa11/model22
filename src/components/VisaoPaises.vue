<script setup lang="ts">
import { computed } from 'vue'
import GraficoLinhas, { type SerieGrafico } from './GraficoLinhas.vue'
import GraficoDefasagem from './GraficoDefasagem.vue'
import {
  base, filtros, episodiosAtivos, valoresNaJanela, resumoDe, serie, nomePais, corPais, paisTracejado, corEpisodio,
} from '../lib/estado'
import { numero, comSinal, variacao, mesRelativo, valorPainel } from '../lib/formatos'
import { manchetePar, textoDefasagem } from '../lib/manchetes'
import { texto } from '../config'
import type { Serie } from '../lib/contrato'

/** Pares de séries equivalentes (fato_comparacao) dentro do grupo filtrado. */
const pares = computed(() => {
  const vistos = new Map<string, { a: Serie; b: Serie }>()
  for (const c of base.value?.comparacoes ?? []) {
    const a = serie(c.id_serie_eua)
    const b = serie(c.id_serie_br)
    if (!a || !b) continue
    if (filtros.grupo !== 'todos' && a.grupo !== filtros.grupo) continue
    vistos.set(a.id, { a, b })
  }
  return [...vistos.values()]
})

const paisesLegenda = computed(() => {
  const p = pares.value[0]
  return p ? [p.a.pais, p.b.pais] : []
})

function celula(a: Serie, b: Serie, idEp: string) {
  const series: SerieGrafico[] = []
  for (const s of [a, b]) {
    const vals = valoresNaJanela(s.id, idEp)
    if (!vals.length) continue
    const r = resumoDe(s.id, idEp)
    series.push({
      id: s.id,
      rotulo: nomePais(s.pais),
      cor: corPais(s.pais),
      tracejado: paisTracejado(s.pais),
      pontos: vals.map((v) => ({ x: v.mes_relativo, y: v.valor_painel, data: v.data_referencia })),
      marcas: r?.mes_reacao != null ? [{ x: r.mes_reacao, rotulo: `primeira reação, ${mesRelativo(r.mes_reacao)} meses` }] : [],
    })
  }
  const comp = base.value?.comparacoes.find((c) => c.id_episodio === idEp && c.id_serie_eua === a.id)
  return { series, comp, ra: resumoDe(a.id, idEp), rb: resumoDe(b.id, idEp) }
}

/** Mesma escala vertical nos episódios de um mesmo par: é o que permite comparar a intensidade. */
function dominio(a: Serie, b: Serie): [number, number] | null {
  const ys = episodiosAtivos.value.flatMap((e) =>
    [a, b].flatMap((s) => valoresNaJanela(s.id, e.id).map((v) => v.valor_painel)),
  )
  return ys.length ? [Math.min(...ys), Math.max(...ys)] : null
}
const emMeses = (ym: string) => {
  const [a, m] = ym.split('-').map(Number)
  return a * 12 + (m - 1)
}
const titulo = (a: Serie, b: Serie) => (a.nome === b.nome ? a.nome : `${a.nome} × ${b.nome}`)

const fmt = (s: Serie) => (v: number) => (s.metodo.tipo === 'indice' ? numero(v, 0) : comSinal(v, 1))
</script>

<template>
  <section v-if="base" class="visao">
    <p class="secundario intro">{{ texto('intro_paises') }}</p>
    <ul class="legenda">
      <li v-for="p in paisesLegenda" :key="p">
        <span class="chave" :class="{ tracejada: paisTracejado(p) }" :style="{ color: corPais(p) }" />{{ nomePais(p) }}
      </li>
      <li class="secundario"><span class="ponto" /> primeira reação</li>
      <li class="secundario"><span class="amostra-faixa" /> recessão nos EUA (pico ao vale)</li>
    </ul>
    <p v-if="!pares.length" class="secundario vazio">{{ texto('paises_vazio') }}</p>

    <GraficoDefasagem class="bloco" />

    <article v-for="p in pares" :key="p.a.id" class="painel par">
      <h2>{{ titulo(p.a, p.b) }}</h2>
      <p class="nota">{{ manchetePar(p.a.id, filtros.episodios) }}. {{ p.a.unidade_painel }}.</p>

      <div class="grade" :style="{ gridTemplateColumns: `repeat(${episodiosAtivos.length}, minmax(0, 1fr))` }">
        <div v-for="e in episodiosAtivos" :key="e.id">
          <template v-for="c in [celula(p.a, p.b, e.id)]" :key="e.id">
            <h3 class="ep"><span class="chave" :style="{ color: corEpisodio(e.id) }" />{{ e.rotulo }}</h3>
            <GraficoLinhas
              v-if="c.series.length"
              :series="c.series"
              :x-min="-filtros.antes"
              :x-max="filtros.depois"
              :ref-y="p.a.metodo.tipo === 'indice' ? 100 : 0"
              :format-y="fmt(p.a)"
              :format-valor="(v: number) => valorPainel(v, p.a)"
              :altura="170"
              compacto
              :foco="p.b.id"
              :dominio-y="dominio(p.a, p.b)"
              :faixa="{ x0: 0, x1: emMeses(e.vale) - emMeses(e.pico) }"
              :descricao="`${p.a.nome} e ${p.b.nome}, ${e.rotulo}`"
            />
            <p class="defasagem" :class="{ vazio: c.comp?.defasagem_meses == null }">{{ textoDefasagem(c.comp?.defasagem_meses) }}</p>
            <p class="nota num">
              Variação: {{ nomePais(p.a.pais) }} {{ variacao(c.ra?.variacao_pico_vale, p.a) }};
              {{ nomePais(p.b.pais) }} {{ c.rb?.situacao_recuperacao === 'sem_dados' ? 'sem dados' : variacao(c.rb?.variacao_pico_vale, p.b) }}
            </p>
          </template>
        </div>
      </div>
    </article>
    <p class="nota">
      Defasagem = mês da primeira reação no Brasil menos o mês da primeira reação nos EUA (fato_comparacao).
      Edição {{ base.edicao.id_edicao }}.
    </p>
  </section>
</template>

<style scoped>
.intro {
  max-width: 52ch;
  font-size: var(--t-texto);
  line-height: 1.55;
}
.legenda {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: var(--esp-1) var(--esp-6);
  margin: var(--esp-2) 0 0;
  padding: 0;
  font-size: var(--t-5);
}
.ponto {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--texto-2);
  margin-right: 6px;
  vertical-align: 1px;
}
.amostra-faixa {
  display: inline-block;
  width: 14px;
  height: 10px;
  background: var(--nber);
  border: 1px solid var(--linha);
  margin-right: 6px;
  vertical-align: -1px;
}
.bloco,
.par {
  margin-top: var(--esp-3);
}
.par > p {
  margin-top: 2px;
}
.grade {
  display: grid;
  gap: var(--esp-6);
  margin-top: var(--esp-3);
}
.ep {
  font-size: var(--t-5);
  font-weight: 600;
  margin-bottom: var(--esp-1);
}
.defasagem {
  margin-top: var(--esp-1);
  font-weight: 600;
  font-size: var(--t-5);
}
.defasagem + .nota {
  margin-top: 2px;
}
.defasagem.vazio,
.vazio {
  font-weight: 400;
  color: var(--texto-3);
}
.visao > .nota:last-child {
  margin-top: var(--esp-4);
}
@media (max-width: 800px) {
  .grade {
    grid-template-columns: 1fr !important;
  }
}
</style>
