<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import GraficoLinhas, { type SerieGrafico } from './GraficoLinhas.vue'
import CartaoMedida, { type LinhaMedida } from './CartaoMedida.vue'
import { base, filtros, serieAtual, episodiosAtivos, valoresNaJanela, resumoDe, nomePais, corEpisodio } from '../lib/estado'
import { mesAno, meses, numero, comSinal, variacao, valorPainel, mesRelativo } from '../lib/formatos'
import { mancheteEpisodios, textoRecuperacao, episodioExtremo } from '../lib/manchetes'
import { config, texto } from '../config'

const s = computed(() => serieAtual.value)

const formatY = computed(() => (v: number) => (s.value?.metodo.tipo === 'indice' ? numero(v, 0) : comSinal(v, 1)))
const formatValor = (v: number) => valorPainel(v, s.value)

/*
 * Foco: o episódio destacado no gráfico, na faixa de recessão e nos cartões ao mesmo tempo.
 * Passar o mouse (na linha, na legenda ou numa linha de cartão) mostra; clicar fixa até clicar de novo.
 * Sem nada disso, vale o episódio citado no título.
 */
const focoHover = ref<string | null>(null)
const focoFixo = ref<string | null>(null)
function alternarFixo(id: string) {
  focoFixo.value = focoFixo.value === id ? null : id
}
const foco = computed(() => {
  if (focoHover.value) return focoHover.value
  if (focoFixo.value && seriesGrafico.value.some((x) => x.id === focoFixo.value)) return focoFixo.value
  if (seriesGrafico.value.length < 2) return null
  return s.value ? episodioExtremo(s.value, seriesGrafico.value.map((x) => x.id)) : null
})

const manchete = computed(() => (s.value ? mancheteEpisodios(s.value, filtros.episodios) : ''))

const seriesGrafico = computed<SerieGrafico[]>(() => {
  const si = s.value
  if (!si) return []
  return episodiosAtivos.value
    .map((e) => {
      const r = resumoDe(si.id, e.id)
      return {
        id: e.id,
        rotulo: e.rotulo,
        cor: corEpisodio(e.id),
        pontos: valoresNaJanela(si.id, e.id).map((v) => ({
          x: v.mes_relativo,
          y: v.valor_painel,
          data: v.data_referencia,
          original: `${numero(v.valor_original, 2)} ${si.unidade_original}`,
        })),
        marcas: r?.meses_ate_vale != null ? [{ x: r.meses_ate_vale, rotulo: `ponto extremo, ${mesRelativo(r.meses_ate_vale)} meses` }] : [],
      }
    })
    .filter((x) => x.pontos.length)
})

const semDados = computed(() => episodiosAtivos.value.filter((e) => s.value?.episodios_sem_dados.includes(e.id)))

const linhas = computed(() =>
  episodiosAtivos.value.map((e) => ({ e, r: s.value ? resumoDe(s.value.id, e.id) : undefined })),
)

/** Faixa de recessão do episódio em foco: do pico (mês 0) ao vale do NBER. */
const emMeses = (ym: string) => {
  const [a, m] = ym.split('-').map(Number)
  return a * 12 + (m - 1)
}
const faixa = computed(() => {
  const id = foco.value ?? seriesGrafico.value[0]?.id
  const e = episodiosAtivos.value.find((x) => x.id === id)
  if (!e) return null
  return { x0: 0, x1: emMeses(e.vale) - emMeses(e.pico), rotulo: `recessão ${e.rotulo} (NBER)` }
})

/** Cartões das quatro medidas do RF06, uma barra por episódio. Valores prontos da camada Gold. */
const janela = computed(() => base.value?.edicao.janela_medidas_meses ?? 48)
function linhaBase(e: { id: string; rotulo: string }): Pick<LinhaMedida, 'id' | 'rotulo' | 'cor'> {
  return { id: e.id, rotulo: e.rotulo, cor: corEpisodio(e.id) }
}
const semDadosLinha = (e: { id: string; rotulo: string }): LinhaMedida => ({
  ...linhaBase(e), valor: null, texto: 'sem dados', apagado: true,
})
const cartoes = computed(() => {
  const si = s.value
  if (!si) return []
  const validos = linhas.value.map((l) => ({ ...l, ok: !!l.r && l.r.situacao_recuperacao !== 'sem_dados' }))
  const comp = (idEp: string) =>
    base.value?.comparacoes.find(
      (c) => c.id_episodio === idEp && (c.id_serie_eua === si.id || c.id_serie_br === si.id),
    )
  const temPar = !!si.id_serie_par
  return [
    {
      titulo: `Maior ${config.textos.sentido[si.sentido_crise]} desde o pico`,
      ajuda: 'Maior desvio da série em relação ao mês de pico, dentro da janela de cálculo.',
      divergente: false,
      linhas: validos.map((l): LinhaMedida =>
        l.ok && l.r!.variacao_pico_vale != null
          ? { ...linhaBase(l.e), valor: Math.abs(l.r!.variacao_pico_vale), texto: variacao(l.r!.variacao_pico_vale, si) }
          : semDadosLinha(l.e),
      ),
    },
    {
      titulo: 'Meses até o ponto extremo',
      ajuda: 'Meses entre o pico do NBER e o ponto de maior desvio da série.',
      divergente: false,
      linhas: validos.map((l): LinhaMedida =>
        l.ok && l.r!.meses_ate_vale != null
          ? { ...linhaBase(l.e), valor: l.r!.meses_ate_vale, texto: meses(l.r!.meses_ate_vale) }
          : semDadosLinha(l.e),
      ),
    },
    {
      titulo: 'Meses até voltar ao nível do pico',
      ajuda: 'Meses entre o pico e o primeiro mês, depois do ponto extremo, em que a série volta ao nível do pico. Barra tracejada: não voltou dentro da janela de cálculo.',
      divergente: false,
      linhas: validos.map((l): LinhaMedida => {
        if (!l.ok) return semDadosLinha(l.e)
        const r = l.r!
        if (r.situacao_recuperacao === 'recuperado')
          return { ...linhaBase(l.e), valor: r.meses_ate_recuperacao, texto: meses(r.meses_ate_recuperacao) }
        if (r.situacao_recuperacao === 'nao_recuperado')
          return { ...linhaBase(l.e), valor: janela.value, texto: `> ${janela.value} meses`, aberta: true }
        return { ...linhaBase(l.e), valor: null, texto: texto('nao_se_aplica'), apagado: true }
      }),
    },
    {
      titulo: 'Defasagem EUA → Brasil',
      ajuda: 'Mês da primeira reação no Brasil menos o mês da primeira reação nos EUA. Positivo: o Brasil reagiu depois.',
      divergente: true,
      linhas: episodiosAtivos.value.map((e): LinhaMedida => {
        const d = temPar ? comp(e.id)?.defasagem_meses : undefined
        if (d == null) return { ...linhaBase(e), valor: null, texto: temPar ? 'sem dados' : 'sem série equivalente', apagado: true }
        return { ...linhaBase(e), valor: d, texto: d === 0 ? 'mesmo mês' : `${d > 0 ? '+' : '−'}${meses(Math.abs(d))}` }
      }),
    },
  ]
})

const coleta = computed(() => {
  const si = s.value
  if (!si) return ''
  const datas = new Set(episodiosAtivos.value.flatMap((e) => valoresNaJanela(si.id, e.id).map((v) => v.data_coleta)))
  return [...datas].sort().join(', ')
})

const mesesTabela = computed(() => {
  const out: number[] = []
  for (let m = -filtros.antes; m <= filtros.depois; m++) out.push(m)
  return out
})
function valorMes(idEp: string, m: number) {
  const si = s.value
  const v = si ? valoresNaJanela(si.id, idEp).find((x) => x.mes_relativo === m) : undefined
  return v ? valorPainel(v.valor_painel, si) : '—'
}

/*
 * Ênfase no gráfico: em 1366 × 768 ele mantém 280 px, o que deixa o primeiro visual inteiro na tela
 * (RNF10); em telas mais altas (projetor da banca, monitores 1080p) cresce até 520 px.
 */
const alturaTela = ref(typeof window !== 'undefined' ? window.innerHeight : 768)
const aoRedimensionar = () => (alturaTela.value = window.innerHeight)
onMounted(() => window.addEventListener('resize', aoRedimensionar))
onBeforeUnmount(() => window.removeEventListener('resize', aoRedimensionar))
const alturaGrafico = computed(() => Math.round(Math.max(280, Math.min(520, alturaTela.value - 488))))
</script>

<template>
  <section v-if="s && base" class="visao">
    <div class="quadro">
      <div class="painel bloco-grafico">
        <header>
          <h2>{{ manchete }}</h2>
          <p class="nota">{{ s.unidade_painel }}. {{ s.descricao }}</p>
        </header>

        <ul class="legenda" aria-label="Legenda">
          <li
            v-for="sg in seriesGrafico"
            :key="sg.id"
            :class="{ recua: foco && foco !== sg.id, fixo: focoFixo === sg.id }"
            tabindex="0"
            role="button"
            :aria-pressed="focoFixo === sg.id"
            @click="alternarFixo(sg.id)"
            @keydown.enter.prevent="alternarFixo(sg.id)"
            @keydown.space.prevent="alternarFixo(sg.id)"
            @pointerenter="focoHover = sg.id"
            @pointerleave="focoHover = null"
            @focus="focoHover = sg.id"
            @blur="focoHover = null"
          >
            <span class="chave" :style="{ color: sg.cor }" />{{ sg.rotulo }}
          </li>
          <li class="marca-legenda"><span class="ponto" /> ponto extremo</li>
          <li class="marca-legenda"><span class="amostra-faixa" /> recessão nos EUA (pico ao vale)</li>
          <li class="dica-fixar" role="presentation">Clique num episódio para fixar o destaque</li>
        </ul>

        <p v-if="semDados.length" class="sem-dados">
          {{ texto('sem_dados_ep', { indicador: s.nome, pais: nomePais(s.pais), episodios: semDados.map((e) => e.rotulo).join(' e '), inicio: mesAno(s.periodo_inicio) }) }}
          <template v-if="s.mudancas_metodologia.length">{{ s.mudancas_metodologia[0].descricao }}</template>
        </p>

        <GraficoLinhas
          v-if="seriesGrafico.length"
          :series="seriesGrafico"
          :x-min="-filtros.antes"
          :x-max="filtros.depois"
          :ref-y="s.metodo.tipo === 'indice' ? 100 : 0"
          :format-y="formatY"
          :format-valor="formatValor"
          :altura="semDados.length ? alturaGrafico - 28 : alturaGrafico"
          :descricao="manchete"
          :foco="foco"
          :faixa="faixa"
          @foco="focoHover = $event"
        />

        <p class="nota fonte">
          Fonte: {{ s.fonte.portal }} ({{ s.fonte.produtor }}), série {{ s.codigo }}. {{ s.metodo.descricao }}.
          Coleta: {{ coleta }}. Edição {{ base.edicao.id_edicao }}.
        </p>
      </div>

      <div class="cartoes" aria-label="Medidas de impacto">
        <CartaoMedida
          v-for="c in cartoes"
          :key="c.titulo"
          v-bind="c"
          :foco="foco"
          :fixo="focoFixo"
          @foco="focoHover = $event"
          @fixar="alternarFixo"
        />
      </div>
    </div>
    <p class="nota apos-quadro">
      Medidas calculadas nos {{ base.edicao.janela_medidas_meses }} meses após o pico, qualquer que seja a janela exibida no gráfico.
      Unidade original da série: {{ s.unidade_original }}.
    </p>

    <details class="valores">
      <summary>Tabela das medidas</summary>
      <div class="rolagem-x">
        <table class="tabela medidas">
          <thead>
            <tr>
              <th>Episódio</th>
              <th>Pico e vale (NBER)</th>
              <th class="n">Maior {{ config.textos.sentido[s.sentido_crise] }}</th>
              <th class="n">Meses até o extremo</th>
              <th class="n">Volta ao nível do pico</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="l in linhas" :key="l.e.id">
              <td><span class="chave" :style="{ color: corEpisodio(l.e.id) }" />{{ l.e.nome }}</td>
              <td class="secundario">{{ mesAno(l.e.pico) }} a {{ mesAno(l.e.vale) }}</td>
              <template v-if="l.r && l.r.situacao_recuperacao !== 'sem_dados'">
                <td class="n forte">{{ variacao(l.r.variacao_pico_vale, s) }}</td>
                <td class="n">{{ meses(l.r.meses_ate_vale) }}</td>
                <td class="n">{{ textoRecuperacao(l.r.situacao_recuperacao, l.r.meses_ate_recuperacao) }}</td>
              </template>
              <td v-else colspan="3" class="n vazio">sem dados</td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>

    <details class="valores">
      <summary>Valores mês a mês</summary>
      <div class="rolagem">
        <table class="tabela">
          <thead>
            <tr>
              <th>Mês</th>
              <th v-for="e in episodiosAtivos" :key="e.id" class="n">{{ e.rotulo }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in mesesTabela" :key="m">
              <td>{{ mesRelativo(m) }}</td>
              <td v-for="e in episodiosAtivos" :key="e.id" class="n">{{ valorMes(e.id, m) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>
  </section>
</template>

<style scoped>
/*
 * Primeira dobra em formato de painel: o gráfico ocupa a coluna larga e as quatro medidas
 * do RF06 ficam ao lado, uma por cartão. As tabelas ficam recolhidas logo abaixo.
 */
.quadro {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 348px;
  gap: var(--esp-3);
  align-items: stretch;
}
.cartoes {
  display: grid;
  grid-auto-rows: 1fr;
  background: var(--lateral);
  border-top: 2px solid var(--texto);
  padding: 0 var(--esp-4);
}
header p {
  margin-top: 2px;
}
.legenda {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: var(--esp-1) var(--esp-4);
  margin: var(--esp-2) 0 0;
  padding: 0;
  font-size: var(--t-5);
}
.legenda li {
  cursor: pointer;
  transition: opacity var(--transicao);
}
.legenda li.fixo {
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 4px;
  text-decoration-thickness: 1px;
}
.legenda li.dica-fixar {
  color: var(--texto-3);
  cursor: default;
}
.legenda li.recua {
  color: var(--texto-2);
}
.legenda li.recua .chave {
  opacity: 0.5;
}
.marca-legenda {
  color: var(--texto-2);
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
.sem-dados {
  font-size: var(--t-5);
  color: var(--texto-2);
  margin: var(--esp-2) 0 0;
}
.fonte {
  margin-top: 2px;
}
.apos-quadro {
  margin-top: var(--esp-2);
}
.rolagem-x {
  overflow-x: auto;
  margin-top: var(--esp-2);
  max-width: 1000px;
}
.medidas td,
.medidas th {
  white-space: nowrap;
}
.medidas .forte {
  font-weight: 600;
}
.valores {
  margin-top: var(--esp-3);
}
summary {
  cursor: pointer;
  font-size: var(--t-4);
  color: var(--texto-2);
  transition: color var(--transicao);
}
summary:hover {
  color: var(--texto);
}
.rolagem {
  max-height: 320px;
  overflow: auto;
  margin-top: var(--esp-2);
  max-width: 520px;
}
@media (max-width: 1100px) {
  .quadro {
    grid-template-columns: 1fr;
  }
  .cartoes {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 640px) {
  .cartoes {
    grid-template-columns: 1fr;
  }
}
</style>
