<script setup lang="ts">
import { computed } from 'vue'
import { base, seriesFiltradas, episodiosAtivos, resumoDe, serie, nomeGrupo, filtros, nomePais, corEpisodio } from '../lib/estado'
import { variacao } from '../lib/formatos'
import { defasagemCurta } from '../lib/manchetes'
import { texto } from '../config'

const grupos = computed(() => {
  const ids = [...new Set(seriesFiltradas.value.map((s) => s.grupo))]
  return ids.map((g) => ({ id: g, nome: nomeGrupo(g), series: seriesFiltradas.value.filter((s) => s.grupo === g) }))
})

const comparacoes = computed(() =>
  (base.value?.comparacoes ?? []).filter((c) => {
    const a = serie(c.id_serie_eua)
    return a && (filtros.grupo === 'todos' || a.grupo === filtros.grupo)
  }),
)
/** Na tabela a unidade (meses) está no cabeçalho, para a tabela caber em 1366 px sem rolagem. */
function voltaCurta(situacao: string, n: number | null | undefined): string {
  if (situacao === 'recuperado') return String(n ?? '—')
  if (situacao === 'nao_recuperado') return `> ${base.value?.edicao.janela_medidas_meses ?? ''}`
  if (situacao === 'nao_se_aplica') return 'n.a.'
  return '—'
}
const pares = computed(() => [...new Set(comparacoes.value.map((c) => c.id_serie_eua))])
</script>

<template>
  <section v-if="base" class="visao">
    <p class="secundario intro">{{ texto('intro_medidas') }}</p>

    <div class="painel rolagem-x">
      <table class="tabela resumo">
        <thead>
          <tr>
            <th rowspan="2">Indicador</th>
            <th rowspan="2">País</th>
            <th v-for="e in episodiosAtivos" :key="e.id" colspan="3" class="ep">
              <span class="chave" :style="{ color: corEpisodio(e.id) }" />{{ e.rotulo }}
            </th>
          </tr>
          <tr>
            <template v-for="e in episodiosAtivos" :key="`s${e.id}`">
              <th class="n inicio">Variação</th>
              <th class="n">Extremo<br />(meses)</th>
              <th class="n">Volta ao pico<br />(meses)</th>
            </template>
          </tr>
        </thead>
        <tbody v-for="g in grupos" :key="g.id">
          <tr class="grupo">
            <th :colspan="2 + episodiosAtivos.length * 3" scope="colgroup">{{ g.nome }}</th>
          </tr>
          <tr v-for="s in g.series" :key="s.id">
            <td>{{ s.nome }}</td>
            <td class="secundario">{{ nomePais(s.pais) }}</td>
            <template v-for="e in episodiosAtivos" :key="`${s.id}${e.id}`">
              <template v-for="r in [resumoDe(s.id, e.id)]" :key="`r${e.id}`">
                <td v-if="!r || r.situacao_recuperacao === 'sem_dados'" colspan="3" class="n vazio inicio">sem dados</td>
                <template v-else>
                  <td class="n inicio forte">{{ variacao(r.variacao_pico_vale, s) }}</td>
                  <td class="n">{{ r.meses_ate_vale ?? '—' }}</td>
                  <td class="n" :class="{ vazio: r.situacao_recuperacao === 'nao_se_aplica' }">{{ voltaCurta(r.situacao_recuperacao, r.meses_ate_recuperacao) }}</td>
                </template>
              </template>
            </template>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="nota">Fonte: fato_resumo_episodio, edição {{ base.edicao.id_edicao }}. “&gt; {{ base.edicao.janela_medidas_meses }}”: não voltou ao nível do pico na janela de cálculo. “n.a.” (não se aplica): juros e inflação não têm um nível “normal” a recuperar.</p>

    <div class="painel bloco-defas">
    <h2 class="sub">Defasagem entre EUA e Brasil</h2>
    <table class="tabela defas">
      <thead>
        <tr>
          <th>Par de séries</th>
          <th v-for="e in episodiosAtivos" :key="e.id"><span class="chave" :style="{ color: corEpisodio(e.id) }" />{{ e.rotulo }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="id in pares" :key="id">
          <td>{{ serie(id)?.nome }} × {{ serie(serie(id)?.id_serie_par)?.nome }}</td>
          <td
            v-for="e in episodiosAtivos"
            :key="e.id"
            :class="{ vazio: comparacoes.find((x) => x.id_serie_eua === id && x.id_episodio === e.id)?.defasagem_meses == null }"
          >
            {{ defasagemCurta(comparacoes.find((x) => x.id_serie_eua === id && x.id_episodio === e.id)?.defasagem_meses) }}
          </td>
        </tr>
      </tbody>
    </table>
    </div>
  </section>
</template>

<style scoped>
.intro {
  max-width: 52ch;
  font-size: var(--t-texto);
  line-height: 1.55;
  margin-bottom: var(--esp-3);
}
.bloco-defas {
  margin-top: var(--esp-3);
}
.rolagem-x {
  overflow-x: auto;
}
.resumo .ep {
  color: var(--texto);
  font-size: var(--t-5);
}
/* Cada episódio é um grupo de três colunas, separado por um respiro à esquerda. */
.inicio {
  padding-left: var(--esp-4) !important;
}
.resumo thead tr:first-child th {
  border-bottom: 1px solid var(--linha);
}
.resumo thead tr:first-child th.ep {
  padding-left: var(--esp-6);
}
.resumo thead tr:first-child th[rowspan] {
  border-bottom: 1px solid var(--texto);
}
tr.grupo th {
  padding-top: var(--esp-4);
  font-size: var(--t-5);
  font-weight: 600;
  color: var(--texto);
  border-bottom-color: var(--texto-3);
}
.resumo td,
.resumo th {
  white-space: nowrap;
}
.resumo td:first-child {
  white-space: normal;
  min-width: 170px;
}
.resumo thead th.n {
  white-space: normal;
}
.forte {
  font-weight: 600;
}
.rolagem-x + .nota {
  margin-top: var(--esp-2);
}
.sub {
  margin: 0 0 var(--esp-2);
}
.defas {
  max-width: 900px;
}
.defas td {
  white-space: nowrap;
}
</style>
