<script setup lang="ts">
/**
 * Ato 1 da abertura: o globo noturno.
 * O mapa é desenhado em Canvas com a projeção ortográfica do d3-geo e os contornos do Natural Earth
 * (pacote world-atlas, domínio público). EUA e Brasil pulsam conforme a série se afasta do nível do pico;
 * um arco liga os dois países quando ambos já reagiram, com a defasagem de fato_comparacao.
 * Cores: as mesmas regras do painel (Brasil em tinta clara, EUA em cinza-ardósia), no tema escuro.
 */
import { computed, ref } from 'vue'
import { geoGraticule10, geoInterpolate, geoOrthographic, geoPath } from 'd3-geo'
import { feature, mesh } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import type { Feature, Geometry } from 'geojson'
import mundoBruto from 'world-atlas/countries-110m.json'
import type { Narrativa } from './dados'
import { dataDoMes, valorEm } from './dados'
import { faixa, interpola, limita, movimentoReduzido, suave, useAto, usaCanvas } from './rolagem'
import { textoNarrativa } from '../config'
import { comSinal, meses as mesesTxt } from '../lib/formatos'

const props = defineProps<{ n: Narrativa }>()

const secao = ref<HTMLElement | null>(null)
const cv = ref<HTMLCanvasElement | null>(null)
const tela = usaCanvas(cv)

const mundo = mundoBruto as unknown as Topology<{ countries: GeometryCollection }>
const paises = (feature(mundo, mundo.objects.countries) as unknown as { features: Feature<Geometry>[] }).features
const fronteiras = mesh(mundo, mundo.objects.countries, (a, b) => a !== b)
const EUA = paises.find((f) => Number(f.id) === 840)
const BRA = paises.find((f) => Number(f.id) === 76)
const pEUA: [number, number] = [-97, 39]
const pBRA: [number, number] = [-50, -11]
const graticula = geoGraticule10()
const proj = geoOrthographic().clipAngle(90).precision(0.6)

const COR = { br: '236,235,231', us: '143,150,160' } // --pais-foco e --pais-contexto do tema escuro
const ceu = Array.from({ length: 240 }, (_, i) => [((i * 7919) % 997) / 997, ((i * 104729) % 991) / 991, 0.2 + ((i * 31) % 80) / 100])

const N = computed(() => props.n.episodios.length)
const INI = 0.09
const FIM = 0.93
/** Trecho de rolagem de cada episódio. */
const seg = computed(() => {
  const passo = (FIM - INI) / N.value
  return props.n.episodios.map((_, i) => [INI + i * passo, INI + i * passo + passo * 0.86] as const)
})
const altura = computed(() => `${120 + N.value * 230}vh`)

const estado = ref({ ativo: false, i: -1, m: 0, aberto: true })
const pIndicador = ref(0)

function calcula(p: number) {
  let i = -1
  let k = 0
  seg.value.forEach(([a, b], j) => {
    if (p >= a - 0.015) {
      i = j
      k = limita((p - a) / (b - a))
    }
  })
  const { antes, depois } = props.n
  const m = -antes + (antes + depois) * k
  const intro = suave(faixa(p, 0, INI - 0.01))
  let lon = interpola(-15, -74, intro)
  let lat = interpola(28, 12, intro)
  let zoom = interpola(0.82, 1, intro)
  if (i >= 0) {
    const f = Math.sin(Math.PI * limita(k * 1.05))
    lon = -74 + f * 4 - i * 1.5
    lat = 12 - f * 3
    zoom = 1 + f * 0.1
  }
  const sai = suave(faixa(p, FIM, 1))
  zoom *= interpola(1, 0.55, sai)
  return { i, k, m, lon, lat, zoom, sai }
}

useAto(secao, ({ t, p }) => {
  const { ctx, w, h } = tela
  if (!ctx || !w) return
  const s = calcula(p)
  const ep = s.i >= 0 ? props.n.episodios[s.i] : null
  pIndicador.value = p
  ctx.clearRect(0, 0, w, h)
  for (const [x, y, a] of ceu) {
    ctx.fillStyle = `rgba(200,220,235,${a * 0.35 * (0.6 + 0.4 * Math.sin(t * a * 2 + x * 9))})`
    ctx.fillRect(x * w, y * h, 1.2, 1.2)
  }
  ctx.globalAlpha = 1 - s.sai
  const R = Math.min(w * 0.36, h * 0.43) * s.zoom
  const cx = w * 0.56
  const cy = h * 0.44
  proj.scale(R).translate([cx, cy]).rotate([-s.lon, -s.lat])
  const path = geoPath(proj, ctx)
  const g = ctx.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.22)
  g.addColorStop(0, 'rgba(110,170,210,.16)')
  g.addColorStop(1, 'rgba(110,170,210,0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(cx, cy, R * 1.22, 0, 7)
  ctx.fill()
  const esf = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R)
  esf.addColorStop(0, '#13202b')
  esf.addColorStop(1, '#090f15')
  ctx.fillStyle = esf
  ctx.beginPath()
  path({ type: 'Sphere' })
  ctx.fill()
  ctx.strokeStyle = 'rgba(140,170,195,.07)'
  ctx.lineWidth = 1
  ctx.beginPath()
  path(graticula)
  ctx.stroke()
  ctx.fillStyle = '#17222d'
  ctx.beginPath()
  paises.forEach((f) => path(f))
  ctx.fill()
  ctx.strokeStyle = '#2a3947'
  ctx.lineWidth = 0.6
  ctx.beginPath()
  path(fronteiras)
  ctx.stroke()

  const { antes } = props.n
  const vU = ep ? (valorEm(ep.us, antes, s.m) ?? 100) : 100
  const vB = ep ? (valorEm(ep.br, antes, s.m) ?? 100) : 100
  const dU = Math.abs(100 - vU)
  const dB = Math.abs(100 - vB)
  const pinta = (f: Feature<Geometry> | undefined, cor: string, d: number) => {
    if (!f) return
    ctx.fillStyle = `rgba(${cor},${0.08 + Math.min(0.3, d * 0.017)})`
    ctx.beginPath()
    path(f)
    ctx.fill()
    ctx.strokeStyle = `rgba(${cor},.55)`
    ctx.lineWidth = 0.8
    ctx.stroke()
  }
  pinta(EUA, COR.us, dU)
  pinta(BRA, COR.br, dB)
  pulso(ctx, pEUA, COR.us, dU, t, R)
  pulso(ctx, pBRA, COR.br, dB, t * 1.07 + 0.3, R)
  if (ep) arco(ctx, ep, s.m, R, cx, cy)
  ctx.globalAlpha = 1
  if (ep) faixaInferior(ctx, w, h, ep, s, s.i)
  estado.value = { ativo: !!ep && s.sai < 0.5, i: s.i, m: s.m, aberto: p < 0.05 }
})

function pulso(ctx: CanvasRenderingContext2D, ll: [number, number], cor: string, d: number, t: number, R: number) {
  const q = proj(ll)
  if (!q) return
  const r0 = R * 0.018 + d * R * 0.0045
  const halo = ctx.createRadialGradient(q[0], q[1], 0, q[0], q[1], r0 * 3)
  halo.addColorStop(0, `rgba(${cor},${0.32 + Math.min(0.5, d * 0.03)})`)
  halo.addColorStop(1, `rgba(${cor},0)`)
  ctx.fillStyle = halo
  ctx.beginPath()
  ctx.arc(q[0], q[1], r0 * 3, 0, 7)
  ctx.fill()
  if (!movimentoReduzido) {
    const vel = 0.35 + d * 0.06
    for (let i = 0; i < 4; i++) {
      const f = (t * vel + i / 4) % 1
      const rr = r0 + f * (R * 0.06 + d * R * 0.012)
      ctx.strokeStyle = `rgba(${cor},${(1 - f) * (0.18 + Math.min(0.6, d * 0.04))})`
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.arc(q[0], q[1], rr, 0, 7)
      ctx.stroke()
    }
  }
  ctx.fillStyle = `rgb(${cor})`
  ctx.beginPath()
  ctx.arc(q[0], q[1], 3.5, 0, 7)
  ctx.fill()
}

function arco(ctx: CanvasRenderingContext2D, ep: Narrativa['episodios'][number], m: number, R: number, cx: number, cy: number) {
  const ru = ep.resumoUs?.mes_reacao
  const rb = ep.resumoBr.mes_reacao
  if (ru == null || rb == null || ep.defasagem == null) return
  const k = limita((m - Math.min(ru, rb)) / (Math.max(Math.abs(ep.defasagem), 1) + 1.5))
  if (k <= 0) return
  const [de, para] = rb >= ru ? [pEUA, pBRA] : [pBRA, pEUA]
  const ip = geoInterpolate(de, para)
  const n = 64
  ctx.strokeStyle = 'rgba(233,238,242,.85)'
  ctx.lineWidth = 1.4
  ctx.setLineDash([2, 5])
  ctx.beginPath()
  let meio: [number, number] | null = null
  for (let i = 0; i <= n * k; i++) {
    const u = i / n
    const q = proj(ip(u))
    if (!q) continue
    const ele = Math.sin(Math.PI * u) * R * 0.16
    const dx = q[0] - cx
    const dy = q[1] - cy
    const L = Math.hypot(dx, dy) || 1
    const x = q[0] + (dx / L) * ele
    const y = q[1] + (dy / L) * ele
    if (i) ctx.lineTo(x, y)
    else ctx.moveTo(x, y)
    if (Math.abs(u - 0.5) < 0.009) meio = [x, y]
  }
  ctx.stroke()
  ctx.setLineDash([])
  if (k >= 1 && meio) {
    const d = ep.defasagem
    const txt = d === 0 ? 'Reagiram no mesmo mês' : d > 0 ? `Brasil reagiu ${mesesTxt(d)} depois` : `Brasil reagiu ${mesesTxt(-d)} antes`
    ctx.font = "500 13px 'Libre Franklin'"
    const tw = ctx.measureText(txt).width
    ctx.fillStyle = 'rgba(7,11,16,.88)'
    ctx.fillRect(meio[0] + 10, meio[1] - 22, tw + 14, 23)
    ctx.fillStyle = '#e9eef2'
    ctx.fillText(txt, meio[0] + 17, meio[1] - 6)
  }
}

function faixaInferior(ctx: CanvasRenderingContext2D, w: number, h: number, ep: Narrativa['episodios'][number], s: ReturnType<typeof calcula>, i: number) {
  const { antes, depois } = props.n
  const x0 = w * 0.07
  const x1 = w * 0.9
  const y0 = h * 0.77
  const y1 = h * 0.92
  const vals = [...ep.br, ...(ep.us ?? [])].filter((v): v is number => v != null)
  const vmin = Math.min(...vals, 100) - 1
  const vmax = Math.max(...vals, 100) + 1
  const X = (m: number) => x0 + ((m + antes) / (antes + depois)) * (x1 - x0)
  const Y = (v: number) => y1 - ((v - vmin) / (vmax - vmin)) * (y1 - y0)
  ctx.globalAlpha = limita((pIndicador.value - seg.value[i][0] + 0.015) / 0.03) * (1 - s.sai)
  ctx.fillStyle = 'rgba(147,163,177,.1)'
  ctx.fillRect(X(0), y0 - 8, X(ep.duracao) - X(0), y1 - y0 + 16)
  ctx.fillStyle = 'rgba(147,163,177,.4)'
  ctx.fillRect(x0, Math.round(Y(100)), x1 - x0, 1)
  ctx.font = "500 12px 'Libre Franklin'"
  ctx.fillStyle = '#9aa6b2'
  for (const m of [-antes, 0, 12, 24, depois]) {
    const tx = m === 0 ? 'pico' : `${m > 0 ? '+' : '−'}${Math.abs(m)} meses`
    ctx.fillText(tx, X(m) - (m === -antes ? 0 : m === depois ? ctx.measureText(tx).width : ctx.measureText(tx).width / 2), y1 + 22)
  }
  ctx.fillText('recessão nos EUA (NBER)', X(0) + 6, y0 - 14)
  ctx.fillText('nível do pico = 100', x0, Y(100) - 6)
  for (const [curva, cor] of [
    [ep.us, COR.us],
    [ep.br, COR.br],
  ] as const) {
    if (!curva) continue
    ctx.strokeStyle = `rgb(${cor})`
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    ctx.beginPath()
    for (let m = -antes; m <= s.m; m += 0.25) {
      const v = valorEm(curva, antes, m) ?? 100
      if (m === -antes) ctx.moveTo(X(m), Y(v))
      else ctx.lineTo(X(m), Y(v))
    }
    ctx.stroke()
    const v = valorEm(curva, antes, s.m) ?? 100
    ctx.fillStyle = '#070b10'
    ctx.beginPath()
    ctx.arc(X(s.m), Y(v), 6, 0, 7)
    ctx.fill()
    ctx.fillStyle = `rgb(${cor})`
    ctx.beginPath()
    ctx.arc(X(s.m), Y(v), 4, 0, 7)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

const ep = computed(() => (estado.value.i >= 0 ? props.n.episodios[estado.value.i] : null))
const pct = (v: number | null) => (v == null ? '—' : `${comSinal(v - 100)}%`)
const leituraUs = computed(() => (ep.value ? pct(valorEm(ep.value.us, props.n.antes, estado.value.m)) : ''))
const leituraBr = computed(() => (ep.value ? pct(valorEm(ep.value.br, props.n.antes, estado.value.m)) : ''))
const data = computed(() => (ep.value ? dataDoMes(ep.value.pico, estado.value.m) : ''))
const mesTxt = computed(() => {
  const mm = Math.round(estado.value.m)
  return mm === 0 ? 'mês do pico do NBER' : mm < 0 ? `${mesesTxt(-mm)} antes do pico` : `${mesesTxt(mm)} depois do pico`
})
const nota = computed(() => {
  const e = ep.value
  if (!e || !estado.value.ativo) return null
  const m = estado.value.m
  const rb = e.resumoBr
  if (m < -1) return { chave: `${e.id}a`, titulo: e.rotulo, texto: textoNarrativa('globo_antes', { pico: dataDoMes(e.pico, 0) }), extra: '' }
  if (rb.meses_ate_vale == null || m < rb.meses_ate_vale)
    return { chave: `${e.id}b`, titulo: textoNarrativa('globo_recessao_titulo'), texto: textoNarrativa('globo_recessao', { duracao: mesesTxt(e.duracao) }), extra: '' }
  const volta =
    rb.meses_ate_recuperacao != null
      ? textoNarrativa('globo_volta', { meses: mesesTxt(rb.meses_ate_recuperacao) })
      : textoNarrativa('globo_nao_volta', { n: props.n.depois })
  return {
    chave: `${e.id}c`,
    titulo: `${comSinal(rb.variacao_pico_vale ?? 0)}%`,
    texto: textoNarrativa('globo_extremo', { meses: mesesTxt(rb.meses_ate_vale), valor_us: e.resumoUs?.variacao_pico_vale != null ? `${comSinal(e.resumoUs.variacao_pico_vale)}%` : 'sem dados' }),
    extra: volta,
  }
})
</script>

<template>
  <section ref="secao" class="ato" :style="{ height: altura }" aria-labelledby="ato-globo-titulo">
    <div class="palco">
      <canvas ref="cv" aria-hidden="true" />
      <div class="abre" :class="{ fora: !estado.aberto }">
        <h2 id="ato-globo-titulo">{{ textoNarrativa('titulo') }}</h2>
        <p>{{ textoNarrativa('abertura', { indicador: n.serieBr.nome.toLowerCase(), episodios: n.episodios.map((e) => e.rotulo).join(', ').replace(/, ([^,]*)$/, ' e $1') }) }}</p>
        <p class="rola" aria-hidden="true">{{ textoNarrativa('rolar') }}</p>
      </div>
      <div class="relogio" :class="{ on: estado.ativo }" aria-hidden="true">
        <p class="data">{{ data }}</p>
        <p class="ep">{{ ep?.rotulo }} · {{ mesTxt }}</p>
      </div>
      <dl class="leit" :class="{ on: estado.ativo }" aria-hidden="true">
        <div>
          <dt><i class="us" />EUA · {{ n.serieUs?.nome.toLowerCase() }}</dt>
          <dd>{{ leituraUs }}</dd>
        </div>
        <div>
          <dt><i class="br" />Brasil · {{ n.serieBr.nome.toLowerCase() }}</dt>
          <dd>{{ leituraBr }}</dd>
        </div>
      </dl>
      <Transition name="nota" mode="out-in">
        <div v-if="nota" :key="nota.chave" class="nota-globo" aria-live="polite">
          <p class="t">{{ nota.titulo }}</p>
          <p>{{ nota.texto }}</p>
          <p v-if="nota.extra" class="x">{{ nota.extra }}</p>
        </div>
      </Transition>
    </div>
  </section>
</template>

<style scoped>
.ato {
  position: relative;
  background: #070b10;
  color: #e9eef2;
}
.palco {
  position: sticky;
  top: 0;
  height: 100vh;
  overflow: hidden;
}
canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
.abre {
  position: absolute;
  left: 7vw;
  top: 15vh;
  max-width: 32rem;
  transition: opacity 0.6s, transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
}
.abre h2 {
  font-size: clamp(44px, 5.2vw, 76px);
  line-height: 0.98;
  letter-spacing: -0.02em;
  color: #e9eef2;
  margin-bottom: 18px;
}
.abre p {
  color: #a3afba;
  font-size: 17px;
  max-width: 36ch;
}
.abre .rola {
  margin-top: 26px;
  font-size: 12.5px;
  letter-spacing: 0.04em;
  display: flex;
  gap: 10px;
  align-items: center;
}
.abre .rola::before {
  content: '';
  width: 1px;
  height: 28px;
  background: linear-gradient(#a3afba, transparent);
  animation: desce 1.8s ease-in-out infinite;
}
@keyframes desce {
  0% {
    transform: scaleY(0);
    transform-origin: top;
  }
  50% {
    transform: scaleY(1);
    transform-origin: top;
  }
  51% {
    transform-origin: bottom;
  }
  100% {
    transform: scaleY(0);
    transform-origin: bottom;
  }
}
.fora {
  opacity: 0;
  transform: translateY(-24px);
  pointer-events: none;
}
.relogio,
.leit {
  position: absolute;
  left: 7vw;
  opacity: 0;
  transition: opacity 0.5s;
}
.relogio {
  top: 9vh;
}
.leit {
  top: 31vh;
  display: grid;
  gap: 16px;
  margin: 0;
}
.on {
  opacity: 1;
}
.relogio .data {
  font: 400 clamp(40px, 4.6vw, 66px) / 1 var(--fonte-titulo);
  letter-spacing: -0.01em;
}
.relogio .ep {
  font-size: 13px;
  color: #a3afba;
  margin-top: 10px;
}
.leit dt {
  font-size: 13px;
  color: #a3afba;
  display: flex;
  gap: 10px;
  align-items: center;
}
.leit dd {
  margin: 2px 0 0 26px;
  font: 500 30px/1.1 var(--fonte);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}
.leit i {
  width: 16px;
  height: 2px;
  display: block;
}
.leit i.us {
  background: rgb(143, 150, 160);
}
.leit i.br {
  background: rgb(236, 235, 231);
}
.nota-globo {
  position: absolute;
  right: 8vw;
  top: 13vh;
  width: min(21rem, 27vw);
  font-size: 15px;
  line-height: 1.55;
}
.nota-globo .t {
  font: 400 30px/1.1 var(--fonte-titulo);
  margin-bottom: 8px;
}
.nota-globo .x {
  margin-top: 10px;
  color: #a3afba;
  font-size: 13px;
}
.nota-enter-active,
.nota-leave-active {
  transition: opacity 0.35s, transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}
.nota-enter-from,
.nota-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
@media (prefers-reduced-motion: reduce) {
  .abre .rola::before {
    animation: none;
  }
}
</style>
