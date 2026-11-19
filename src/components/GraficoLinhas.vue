<script setup lang="ts">
/**
 * Gráfico de linhas em SVG com escalas do D3.
 * Usado no gráfico de episódios alinhados (RF09) e nos pequenos múltiplos EUA × Brasil (RF07).
 * Eixo x = meses em relação ao pico; um único eixo y.
 */
import { computed, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import { scaleLinear } from 'd3-scale'
import { line, curveMonotoneX } from 'd3-shape'
import { extent } from 'd3-array'
import { mesAno, mesRelativo } from '../lib/formatos'
import { texto } from '../config'

export interface PontoGrafico {
  x: number
  y: number
  data: string
  original?: string
}
export interface MarcaGrafico {
  x: number
  rotulo: string
}
export interface SerieGrafico {
  id: string
  rotulo: string
  cor: string
  tracejado?: boolean
  pontos: PontoGrafico[]
  marcas?: MarcaGrafico[]
}

const props = withDefaults(
  defineProps<{
    series: SerieGrafico[]
    xMin: number
    xMax: number
    refY: number
    formatY: (v: number) => string
    /** formato do valor na dica; se omitido usa formatY */
    formatValor?: (v: number) => string
    altura?: number
    compacto?: boolean
    descricao: string
    /**
     * Série em foco: traço mais firme e cor plena; as demais recuam (traço fino, opacidade menor).
     * null = todas com o mesmo peso.
     */
    foco?: string | null
    /** Faixa de recessão (pico ao vale do NBER), em meses relativos. */
    faixa?: { x0: number; x1: number; rotulo?: string } | null
    /** Domínio fixo do eixo y, para pequenos múltiplos que precisam da mesma escala. */
    dominioY?: [number, number] | null
  }>(),
  { altura: 380, compacto: false, foco: null, faixa: null, dominioY: null },
)
const emit = defineEmits<{ (e: 'foco', id: string | null): void }>()

/** O foco só vale se a série estiver no gráfico (ex.: o Brasil pode não ter dados no episódio). */
const focoValido = computed(() => (props.series.some((s) => s.id === props.foco) ? props.foco : null))
const emFoco = (id: string) => focoValido.value === id
const emContexto = (id: string) => focoValido.value != null && focoValido.value !== id
/** A série em foco é desenhada por último, por cima das outras. */
const seriesOrdenadas = computed(() =>
  [...props.series].sort((a, b) => Number(emFoco(a.id)) - Number(emFoco(b.id))),
)

// ---- entrada: a crise se desenrola a partir do pico ----
/*
 * Ao montar e sempre que os dados mudam (outro indicador, episódio ou janela), o trecho antes do
 * pico aparece inteiro e o resto das linhas é revelado da esquerda para a direita a partir do mês 0,
 * como a recessão acontecendo. As marcas de ponto extremo aparecem quando a revelação passa por
 * elas e os rótulos diretos entram no fim. Com movimento reduzido, tudo aparece pronto.
 */
const idCorte = `corte-${useId()}`
const revelado = ref(1)
let quadro = 0
const semMovimento = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
function animar() {
  cancelAnimationFrame(quadro)
  if (semMovimento()) {
    revelado.value = 1
    return
  }
  const dur = props.compacto ? 650 : 850
  const inicio = performance.now()
  revelado.value = 0
  const passo = (agora: number) => {
    const t = Math.min(1, Math.max(0, (agora - inicio) / dur))
    revelado.value = 1 - Math.pow(1 - t, 4)
    if (t < 1) quadro = requestAnimationFrame(passo)
  }
  quadro = requestAnimationFrame(passo)
}
const assinatura = computed(() =>
  props.series.map((s) => `${s.id}:${s.pontos.length}:${s.pontos[0]?.x}:${s.pontos[0]?.y}`).join('|') + `|${props.xMin}:${props.xMax}`,
)
watch(assinatura, animar)
onMounted(animar)
onBeforeUnmount(() => cancelAnimationFrame(quadro))

const caixa = ref<HTMLDivElement | null>(null)
const largura = ref(800)
let obs: ResizeObserver | null = null
onMounted(() => {
  obs = new ResizeObserver(([e]) => (largura.value = Math.max(240, e.contentRect.width)))
  if (caixa.value) obs.observe(caixa.value)
})
onBeforeUnmount(() => obs?.disconnect())

const m = computed(() =>
  props.compacto ? { t: 10, r: 8, b: 22, l: 38 } : { t: 22, r: 76, b: 42, l: 38 },
)
const w = computed(() => largura.value - m.value.l - m.value.r)
const h = computed(() => props.altura - m.value.t - m.value.b)

const x = computed(() => scaleLinear().domain([props.xMin, props.xMax]).range([0, w.value]))
const y = computed(() => {
  const ys = props.dominioY ? [...props.dominioY] : props.series.flatMap((s) => s.pontos.map((p) => p.y))
  const [a, b] = extent([...ys, props.refY]) as [number, number]
  const folga = (b - a || 1) * 0.08
  return scaleLinear()
    .domain([a - folga, b + folga])
    .range([h.value, 0])
    .nice(props.compacto ? 4 : 6)
})

const gerador = computed(() =>
  line<PontoGrafico>()
    .x((p) => x.value(p.x))
    .y((p) => y.value(p.y))
    .curve(curveMonotoneX),
)

/** Posição (px) até onde as linhas já foram reveladas. */
const corte = computed(() => {
  const x0 = x.value(Math.max(props.xMin, Math.min(0, props.xMax)))
  return x0 + (w.value - x0) * revelado.value
})

const faixaVisivel = computed(() => {
  const f = props.faixa
  if (!f) return null
  const x0 = Math.max(f.x0, props.xMin)
  const x1 = Math.min(f.x1, props.xMax)
  if (x1 <= x0) return null
  return { x: x.value(x0), w: x.value(x1) - x.value(x0), rotulo: f.rotulo }
})

const ticksX = computed(() => {
  const passo = props.xMax - props.xMin > 40 || props.compacto ? 12 : 6
  const t: number[] = []
  for (let v = Math.ceil(props.xMin / passo) * passo; v <= props.xMax; v += passo) t.push(v)
  return t
})
const ticksY = computed(() => y.value.ticks(props.compacto ? 4 : 6))

/** Rótulos diretos no fim de cada linha, afastados para não colidir. */
const rotulosDiretos = computed(() => {
  if (props.compacto) return []
  const itens = props.series
    .filter((s) => s.pontos.length)
    .map((s) => {
      const ult = s.pontos[s.pontos.length - 1]
      return { id: s.id, rotulo: s.rotulo, cor: s.cor, x: x.value(ult.x), y: y.value(ult.y) }
    })
    .sort((a, b) => a.y - b.y)
  // Afasta rótulos que terminam perto no eixo y: empurra para baixo, depois devolve para cima
  // o que passou da área do gráfico, mantendo o espaçamento mínimo e a ordem.
  const gap = 15
  for (let i = 1; i < itens.length; i++) if (itens[i].y - itens[i - 1].y < gap) itens[i].y = itens[i - 1].y + gap
  const limite = h.value
  for (let i = itens.length - 1; i >= 0; i--) {
    const max = i === itens.length - 1 ? limite : itens[i + 1].y - gap
    if (itens[i].y > max) itens[i].y = max
  }
  return itens
})

// ---- camada de hover / teclado ----
const xAtivo = ref<number | null>(null)
/*
 * Passar o mouse perto de uma linha põe aquele episódio em foco no painel inteiro (linha,
 * faixa de recessão e cartões), sem precisar achar a legenda.
 */
let focoEmitido: string | null = null
function emitirFoco(id: string | null) {
  if (id === focoEmitido) return
  focoEmitido = id
  emit('foco', id)
}
function aoMover(ev: PointerEvent) {
  const r = (ev.currentTarget as SVGRectElement).getBoundingClientRect()
  const v = Math.round(x.value.invert(ev.clientX - r.left))
  xAtivo.value = Math.min(props.xMax, Math.max(props.xMin, v))
  const py = ev.clientY - r.top
  let perto: string | null = null
  let menor = 26
  for (const s of props.series) {
    const p = s.pontos.find((q) => q.x === xAtivo.value)
    if (!p) continue
    const d = Math.abs(y.value(p.y) - py)
    if (d < menor) {
      menor = d
      perto = s.id
    }
  }
  emitirFoco(perto)
}
function aoSair() {
  xAtivo.value = null
  emitirFoco(null)
}
function aoTeclar(ev: KeyboardEvent) {
  if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
    ev.preventDefault()
    const d = ev.key === 'ArrowRight' ? 1 : -1
    xAtivo.value = Math.min(props.xMax, Math.max(props.xMin, (xAtivo.value ?? 0) + d))
  } else if (ev.key === 'Escape') xAtivo.value = null
}

const leitura = computed(() => {
  if (xAtivo.value == null) return null
  const linhas = props.series
    .map((s) => ({ s, p: s.pontos.find((p) => p.x === xAtivo.value) }))
    .filter((l): l is { s: SerieGrafico; p: PontoGrafico } => !!l.p)
    .sort((a, b) => b.p.y - a.p.y)
  const px = x.value(xAtivo.value) + m.value.l
  const ladoDireito = px < largura.value * 0.6
  return { linhas, px, ladoDireito }
})
</script>

<template>
  <div ref="caixa" class="grafico" :class="{ compacto }" :style="{ height: `${altura}px` }">
    <svg
      :width="largura"
      :height="altura"
      role="img"
      :aria-label="descricao"
      tabindex="0"
      @keydown="aoTeclar"
      @blur="xAtivo = null"
    >
      <defs>
        <clipPath :id="idCorte">
          <rect :x="-m.l" y="-12" :width="corte + m.l + 3" :height="h + 24" />
        </clipPath>
      </defs>
      <g :transform="`translate(${m.l},${m.t})`">
        <!-- faixa de recessão (NBER): acompanha o episódio em foco -->
        <g v-if="faixaVisivel">
          <rect
            :x="faixaVisivel.x"
            :width="faixaVisivel.w"
            :height="h"
            class="faixa-nber"
            :style="{ width: `${faixaVisivel.w}px` }"
          />
          <text v-if="faixaVisivel.rotulo && !compacto" :x="faixaVisivel.x + 6" y="12" class="rotulo-faixa">
            {{ faixaVisivel.rotulo }}
          </text>
        </g>
        <!-- grade e eixo y -->
        <g class="eixo-y">
          <g v-for="t in ticksY" :key="`y${t}`" :transform="`translate(0,${y(t)})`">
            <line :x2="w" class="grade" />
            <text :x="-m.l" dy="0.32em" text-anchor="start">{{ formatY(t) }}</text>
          </g>
        </g>
        <!-- referência (pico = 100 ou 0 p.p.) -->
        <line :x1="0" :x2="w" :y1="y(refY)" :y2="y(refY)" class="referencia" />

        <!-- eixo x -->
        <g :transform="`translate(0,${h})`" class="eixo-x">
          <line :x2="w" class="base" />
          <g v-for="t in ticksX" :key="`x${t}`" :transform="`translate(${x(t)},0)`">
            <line y2="4" class="base" />
            <text y="16" text-anchor="middle">{{ t === 0 ? '0' : mesRelativo(t) }}</text>
          </g>
          <text v-if="!compacto" :x="w / 2" y="34" text-anchor="middle" class="titulo-eixo">
            {{ texto('eixo_x') }}
          </text>
        </g>

        <!-- mês do pico -->
        <g v-if="xMin <= 0 && xMax >= 0" :transform="`translate(${x(0)},0)`">
          <line :y2="h" class="pico" />
          <text v-if="!compacto" y="-8" text-anchor="middle" class="rotulo-pico">pico</text>
        </g>

        <!-- linhas -->
        <g :clip-path="`url(#${idCorte})`">
        <path
          v-for="s in seriesOrdenadas"
          :key="s.id"
          :d="gerador(s.pontos) ?? ''"
          class="linha"
          :class="{ tracejada: s.tracejado, foco: emFoco(s.id), contexto: emContexto(s.id) }"
          :style="{ stroke: s.cor }"
        />
        </g>

        <!-- marcas (vale, reação) -->
        <template v-for="s in series" :key="`m${s.id}`">
          <g v-for="mk in s.marcas ?? []" :key="`${s.id}${mk.rotulo}`">
            <circle
              v-if="s.pontos.find((p) => p.x === mk.x)"
              :cx="x(mk.x)"
              :cy="y(s.pontos.find((p) => p.x === mk.x)!.y)"
              r="4.5"
              class="marca"
              :class="{ contexto: emContexto(s.id), oculta: x(mk.x) > corte + 0.5 }"
              :style="{ fill: s.cor }"
            >
              <title>{{ s.rotulo }}: {{ mk.rotulo }}</title>
            </circle>
          </g>
        </template>

        <!-- rótulos diretos -->
        <g
          v-for="r in rotulosDiretos"
          :key="`r${r.id}`"
          :transform="`translate(${r.x + 8},${r.y})`"
          class="rotulo-grupo"
          :class="{ contexto: emContexto(r.id), oculto: revelado < 0.97 }"
          @pointerenter="emit('foco', r.id)"
          @pointerleave="emit('foco', null)"
        >
          <line x1="-6" x2="-1" class="guia" :style="{ stroke: r.cor }" />
          <text dy="0.32em" class="rotulo-direto">{{ r.rotulo }}</text>
        </g>

        <!-- crosshair -->
        <g v-if="leitura">
          <line :x1="x(xAtivo!)" :x2="x(xAtivo!)" :y2="h" class="cruz" />
          <circle
            v-for="l in leitura.linhas"
            :key="`c${l.s.id}`"
            :cx="x(l.p.x)"
            :cy="y(l.p.y)"
            r="4"
            class="ponto-ativo"
            :style="{ fill: l.s.cor }"
          />
        </g>

        <rect
          :width="w"
          :height="h"
          fill="transparent"
          @pointermove="aoMover"
          @pointerleave="aoSair"
        />
      </g>
    </svg>

    <div
      v-if="leitura && leitura.linhas.length"
      class="dica"
      :style="{
        left: leitura.ladoDireito ? `${leitura.px + 14}px` : 'auto',
        right: leitura.ladoDireito ? 'auto' : `${largura - leitura.px + 14}px`,
        top: `${m.t}px`,
      }"
      role="status"
    >
      <div class="dica-cab">{{ xAtivo === 0 ? 'Mês do pico' : `${mesRelativo(xAtivo!)} meses do pico` }}</div>
      <div v-for="l in leitura.linhas" :key="`d${l.s.id}`" class="dica-linha">
        <span class="chave" :class="{ tracejada: l.s.tracejado }" :style="{ color: l.s.cor }" />
        <strong class="num">{{ (formatValor ?? formatY)(l.p.y) }}</strong>
        <span class="dica-serie">{{ l.s.rotulo }}, {{ mesAno(l.p.data) }}</span>
        <span v-if="l.p.original" class="dica-original num">{{ l.p.original }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.grafico {
  position: relative;
  width: 100%;
}
svg {
  display: block;
  overflow: visible;
}
svg:focus-visible {
  outline-offset: 4px;
}
text {
  fill: var(--texto-3);
  font-size: var(--t-5);
  font-family: var(--fonte-num);
  font-variant-numeric: tabular-nums;
}
.titulo-eixo,
.rotulo-pico {
  font-family: var(--fonte);
}
.grade {
  stroke: var(--grade);
  stroke-width: 1;
  shape-rendering: crispEdges;
}
.base {
  stroke: var(--referencia);
  shape-rendering: crispEdges;
}
.referencia {
  stroke: var(--referencia);
  stroke-width: 1.5;
}
.pico {
  stroke: var(--texto-2);
  stroke-width: 1.25;
  stroke-dasharray: 4 3;
}
.rotulo-pico {
  fill: var(--texto-2);
}
.titulo-eixo {
  fill: var(--texto-3);
}
.faixa-nber {
  fill: var(--nber);
  transition: x 260ms cubic-bezier(0.16, 1, 0.3, 1), width 260ms cubic-bezier(0.16, 1, 0.3, 1);
}
.rotulo-faixa {
  fill: var(--texto-3);
  font-size: 11.5px;
}
/* Hierarquia: foco 2.75px; contexto 1.5px e 70% de opacidade (continua acima de 3:1 sobre o papel). */
.linha {
  fill: none;
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
  transition: opacity var(--transicao), stroke-width var(--transicao);
}
.linha.foco {
  stroke-width: 2.75;
}
.linha.contexto {
  stroke-width: 1.5;
  opacity: 0.7;
}
/* Nos pequenos múltiplos a série de contexto precisa continuar legível para a comparação. */
.compacto .linha.contexto {
  opacity: 1;
}
.marca.contexto,
.rotulo-grupo.contexto {
  opacity: 0.75;
}
.rotulo-grupo {
  cursor: default;
  transition: opacity 300ms ease-out;
}
.linha.tracejada {
  stroke-dasharray: 6 4;
}
.marca {
  stroke: var(--superficie);
  stroke-width: 2;
  transform-box: fill-box;
  transform-origin: center;
  transition: opacity 180ms ease-out, transform 260ms cubic-bezier(0.16, 1, 0.3, 1);
}
.marca.oculta {
  opacity: 0;
  transform: scale(0.2);
}
.rotulo-grupo.oculto {
  opacity: 0;
  transition: none;
}
@media (prefers-reduced-motion: reduce) {
  .faixa-nber,
  .marca {
    transition: opacity 120ms linear;
  }
}
.ponto-ativo {
  stroke: var(--superficie);
  stroke-width: 2;
  pointer-events: none;
}
.cruz {
  stroke: var(--texto-3);
  stroke-width: 1;
  pointer-events: none;
}
.guia {
  stroke-width: 2;
}
.rotulo-direto {
  fill: var(--texto);
  font-weight: 500;
  font-size: var(--t-5);
}
.dica {
  position: absolute;
  pointer-events: none;
  background: var(--superficie);
  border: 1px solid var(--texto-3);
  border-radius: 3px;
  padding: 8px 10px;
  min-width: 200px;
  font-size: var(--t-5);
  z-index: 5;
}
.dica-cab {
  color: var(--texto-2);
  margin-bottom: 4px;
}
.dica-linha {
  display: grid;
  grid-template-columns: 24px auto 1fr;
  align-items: baseline;
  column-gap: 6px;
  padding: 2px 0;
}
.dica-linha strong {
  font-family: var(--fonte-num);
  color: var(--texto);
  font-size: var(--t-5);
}
.dica-serie {
  color: var(--texto-2);
}
.dica-original {
  grid-column: 2 / 4;
  color: var(--texto-3);
  font-size: var(--t-5);
}
</style>
