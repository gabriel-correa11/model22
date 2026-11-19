<script setup lang="ts">
/**
 * Ato 2 da abertura: os pontos viram gráficos.
 * Cada ponto é um mês de uma série (Brasil ou EUA) num episódio. Os mesmos pontos se reorganizam,
 * conforme a rolagem, em cinco gráficos: calendário, episódios alinhados ao pico, maior distância
 * do pico, meses até a recuperação e mês da primeira reação. Em cada parada, o gráfico final é
 * desenhado por cima com eixos, unidade, legenda e fonte (regra 3.6 do TCC).
 *
 * Por que Canvas e não SVG: são cerca de 2.300 pontos animados a cada quadro; em SVG seriam 2.300
 * elementos no DOM atualizados 60 vezes por segundo. Os gráficos do painel continuam em SVG com D3.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Narrativa } from './dados'
import { anoDoMes, mesesDe, valorEm } from './dados'
import { interpola, limita, misturaRgb, movimentoReduzido, suave, suaveIO, token, useAto, usaCanvas } from './rolagem'
import { config, preencher, texto, textoNarrativa } from '../config'
import { comSinal, meses as mesesTxt } from '../lib/formatos'

const props = defineProps<{ n: Narrativa }>()
const secao = ref<HTMLElement | null>(null)
const palco = ref<HTMLElement | null>(null)
const cv = ref<HTMLCanvasElement | null>(null)
const tela = usaCanvas(cv)

type Pa = 'us' | 'br'
interface Ponto {
  ie: number
  pa: Pa
  mf: number
  v: number
  g: number
  a: number
  r: number
  q: number
  sx: number
  sy: number
  dx: number
  dy: number
  vx: number
  vy: number
}

const POR = 8
const eps = computed(() => props.n.episodios)
const NE = computed(() => eps.value.length)
const total = computed(() => props.n.antes + props.n.depois)
const NG = computed(() => (total.value + 1) * POR)

/** Pseudoaleatório estável: a mesma posição de partida a cada visita. */
const alea = (i: number) => {
  const x = Math.sin(i * 12.9898) * 43758.5453
  return x - Math.floor(x)
}
const pontos = computed<Ponto[]>(() => {
  const out: Ponto[] = []
  let semente = 1
  eps.value.forEach((e, ie) =>
    (['us', 'br'] as Pa[]).forEach((pa) => {
      const curva = pa === 'br' ? e.br : e.us
      if (!curva) return
      let g = 0
      for (let im = 0; im <= total.value; im++)
        for (let j = 0; j < POR; j++) {
          const mf = Math.min(total.value, Math.max(0, im + (j + 0.5) / POR - 0.5))
          const s = semente++
          out.push({ ie, pa, mf, v: valorEm(curva, props.n.antes, mf - props.n.antes) ?? 100, g: g++, a: alea(s) * 6.283, r: Math.sqrt(alea(s + 0.3)), q: alea(s + 0.7), sx: alea(s + 1.1), sy: alea(s + 1.9), dx: 0, dy: 0, vx: 0, vy: 0 })
        }
    }),
  )
  return out
})

/* ---------- escalas comuns ---------- */
interface Area {
  x0: number
  x1: number
  y0: number
  y1: number
}
const area = (w: number, h: number): Area => ({ x0: w * 0.345, x1: w * 0.94, y0: h * 0.17, y1: h * 0.79 })
const dominio = computed(() => {
  const vs: number[] = [100]
  for (const e of eps.value) for (const c of [e.br, e.us]) c?.forEach((v) => v != null && vs.push(v))
  const a = Math.min(...vs)
  const b = Math.max(...vs)
  const f = (b - a) * 0.06
  return [Math.floor((a - f) / 5) * 5, Math.ceil((b + f) / 5) * 5] as const
})
const maxDist = computed(() => {
  let m = 0
  for (const e of eps.value) for (const r of [e.resumoBr, e.resumoUs]) if (r?.variacao_pico_vale != null) m = Math.max(m, Math.abs(r.variacao_pico_vale))
  return Math.ceil(m / 5) * 5 || 5
})
const maxReacao = computed(() => {
  let m = 6
  for (const e of eps.value) for (const r of [e.resumoBr, e.resumoUs]) if (r?.mes_reacao != null) m = Math.max(m, r.mes_reacao)
  return Math.ceil(m / 2) * 2 + 2
})
const anos = computed(() => {
  const a = Math.min(...eps.value.map((e) => anoDoMes(e.pico, -props.n.antes))) - 0.5
  const b = Math.max(...eps.value.map((e) => anoDoMes(e.pico, props.n.depois))) + 0.5
  return [Math.floor(a), Math.ceil(b)] as const
})
const G = {
  Yv: (A: Area, v: number) => A.y1 - ((v - dominio.value[0]) / (dominio.value[1] - dominio.value[0])) * (A.y1 - A.y0),
  Xc: (A: Area, ano: number) => A.x0 + ((ano - anos.value[0]) / (anos.value[1] - anos.value[0])) * (A.x1 - A.x0),
  painel: (A: Area, i: number) => {
    const gap = 26
    const pw = (A.x1 - A.x0 - gap * (NE.value - 1)) / NE.value
    return { x0: A.x0 + i * (pw + gap), pw }
  },
  Xm: (A: Area, i: number, m: number) => {
    const q = G.painel(A, i)
    return q.x0 + ((m + props.n.antes) / total.value) * q.pw
  },
  base: (A: Area) => A.y0 + 46,
  Yd: (A: Area, v: number) => G.base(A) + (Math.abs(v) / maxDist.value) * (A.y1 - G.base(A)),
  gx: (A: Area, i: number) => A.x0 + (i + 0.5) * ((A.x1 - A.x0) / NE.value),
  gy: (A: Area, i: number) => A.y0 + 46 + (i + 0.5) * ((A.y1 - A.y0 - 46) / NE.value),
  Xr: (A: Area, m: number) => A.x0 + (m / (props.n.depois + 6)) * (A.x1 - A.x0 - 150),
  Xl: (A: Area, m: number) => A.x0 + 40 + (m / maxReacao.value) * (A.x1 - A.x0 - 80),
}
const resumo = (pa: Pa, ie: number) => (pa === 'br' ? eps.value[ie].resumoBr : eps.value[ie].resumoUs)

/* ---------- posição de cada ponto em cada cena ---------- */
type Lay = (p: Ponto, w: number, h: number, t: number) => [number, number]
const jit = (p: Ponto, s: number): [number, number] => [Math.cos(p.a) * p.r * s, Math.sin(p.a) * p.r * s]
const LAY: Lay[] = [
  (p, w, h, t) => [p.sx * w + Math.sin(t * 0.2 + p.a) * 6, p.sy * h + Math.cos(t * 0.17 + p.a) * 6],
  (p, w, h) => {
    const A = area(w, h)
    const [jx, jy] = jit(p, 1.2)
    return [G.Xc(A, anoDoMes(eps.value[p.ie].pico, p.mf - props.n.antes)) + jx, G.Yv(A, p.v) + jy]
  },
  (p, w, h) => {
    const A = area(w, h)
    const [jx, jy] = jit(p, 1.2)
    return [G.Xm(A, p.ie, p.mf - props.n.antes) + jx, G.Yv(A, p.v) + jy]
  },
  (p, w, h) => {
    const A = area(w, h)
    const v = resumo(p.pa, p.ie)?.variacao_pico_vale ?? 0
    const x0 = G.gx(A, p.ie) + (p.pa === 'us' ? -25 : 1)
    const hh = G.Yd(A, v) - G.base(A)
    const cols = 6
    const rows = Math.ceil(NG.value / cols)
    return [x0 + ((p.g % cols) + 0.5) * 4, G.base(A) + ((Math.floor(p.g / cols) + 0.5) / rows) * hh]
  },
  (p, w, h) => {
    const A = area(w, h)
    const r = resumo(p.pa, p.ie)
    const comp = G.Xr(A, r?.meses_ate_recuperacao ?? props.n.depois) - A.x0
    const y0 = G.gy(A, p.ie) + (p.pa === 'us' ? -21 : 1)
    const rows = 5
    const cols = Math.ceil(NG.value / rows)
    return [A.x0 + ((Math.floor(p.g / rows) + 0.5) / cols) * comp, y0 + ((p.g % rows) + 0.5) * 4]
  },
  (p, w, h) => {
    const A = area(w, h)
    const ru = eps.value[p.ie].resumoUs?.mes_reacao ?? 0
    const rb = eps.value[p.ie].resumoBr.mes_reacao ?? 0
    const mesmo = ru === rb
    const x = G.Xl(A, p.pa === 'us' ? ru : rb)
    const y = G.gy(A, p.ie) + (mesmo ? (p.pa === 'us' ? -9 : 9) : 0)
    const [jx, jy] = jit(p, 6)
    return [x + jx, y + jy]
  },
]
const NC = LAY.length
const PAR = LAY.map((_, i) => i / (NC - 1))

/* ---------- cores (tokens do painel) ---------- */
const cores = ref({ fundo: '#ffffff', texto: '#1c1e21', texto2: '#50565f', texto3: '#666c75', grade: '#ebe8e1', linha: '#dedad1', ref: '#8a8f97', nber: '#e6e2d9', br: '#1c1e21', us: '#6f7985' })
function leCores() {
  cores.value = {
    fundo: token('--fundo'),
    texto: token('--texto'),
    texto2: token('--texto-2'),
    texto3: token('--texto-3'),
    grade: token('--grade'),
    linha: token('--linha'),
    ref: token('--referencia'),
    nber: token('--nber'),
    br: token('--pais-foco'),
    us: token('--pais-contexto'),
  }
}
const esquema = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: dark)') : null
onMounted(() => {
  leCores()
  esquema?.addEventListener('change', leCores)
})
onBeforeUnmount(() => esquema?.removeEventListener('change', leCores))

const cena = ref(0)
const ponteiro = { x: -9999, y: -9999 }
function move(e: PointerEvent) {
  const r = cv.value?.getBoundingClientRect()
  if (!r) return
  ponteiro.x = e.clientX - r.left
  ponteiro.y = e.clientY - r.top
}
function sai() {
  ponteiro.x = ponteiro.y = -9999
}

useAto(secao, ({ t, p }) => {
  const { ctx, w, h } = tela
  if (!ctx || !w) return
  ctx.clearRect(0, 0, w, h)
  const i = Math.min(NC - 2, Math.floor(p * (NC - 1)))
  const u = (p - PAR[i]) / (PAR[i + 1] - PAR[i])
  const K = limita((u - 0.22) / 0.56)
  const c = cores.value
  // da noite do globo para o papel do painel, durante a primeira passagem
  const luz = i === 0 ? suave(limita((K - 0.12) * 2.6)) : 1
  if (palco.value) {
    palco.value.style.background = `rgb(${misturaRgb('#070b10', c.fundo, luz)})`
    palco.value.style.color = luz > 0.5 ? c.texto : '#e9eef2'
  }
  const cUS = misturaRgb('#8f96a0', c.us, luz)
  const cBR = misturaRgb('#ecebe7', c.br, luz)
  const atual = K < 0.5 ? i : i + 1
  if (atual !== cena.value) cena.value = atual
  const peso = (n: number) => (n === i ? 1 - suave(limita(K * 2)) : n === i + 1 ? suave(limita(K * 2 - 1)) : 0)
  const nit = (n: number) => (n === i ? limita(1 - K * 5) : n === i + 1 ? limita(K * 5 - 4) : 0)
  const A = area(w, h)
  for (let n = 1; n < NC; n++) {
    const a = peso(n)
    if (a > 0.01) CHROME[n]?.(ctx, A, a, nit(n), cUS, cBR, w, h)
  }
  const nitida = Math.max(...[1, 2, 3, 4, 5].map(nit))
  for (const pa of ['us', 'br'] as Pa[]) {
    ctx.fillStyle = `rgba(${pa === 'us' ? cUS : cBR},${(i === 0 && K < 0.3 ? 0.55 : 0.9) * (1 - 0.75 * nitida)})`
    for (const pt of pontos.value) {
      if (pt.pa !== pa) continue
      const atraso = (pt.mf / total.value) * 0.28 + pt.q * 0.08
      const k = suaveIO(limita((K - atraso) / 0.64))
      const [ax, ay] = LAY[i](pt, w, h, t)
      const [bx, by] = LAY[i + 1](pt, w, h, t)
      const arco = movimentoReduzido ? 0 : Math.sin(Math.PI * k) * (24 + pt.q * 46)
      const x = interpola(ax, bx, k) + Math.sin(t * 0.9 + pt.a * 3) * 0.7
      const y = interpola(ay, by, k) + Math.cos(t * 0.7 + pt.a * 5) * 0.7 - arco * (pt.q - 0.4)
      if (!movimentoReduzido) {
        const ddx = x + pt.dx - ponteiro.x
        const ddy = y + pt.dy - ponteiro.y
        const d2 = ddx * ddx + ddy * ddy
        if (d2 < 4900) {
          const d = Math.sqrt(d2) + 1
          const f = (1 - d / 70) * 1.5
          pt.vx += (ddx / d) * f
          pt.vy += (ddy / d) * f
        }
        pt.vx = (pt.vx - pt.dx * 0.06) * 0.86
        pt.vy = (pt.vy - pt.dy * 0.06) * 0.86
        pt.dx += pt.vx
        pt.dy += pt.vy
      }
      ctx.fillRect(x + pt.dx - 1.1, y + pt.dy - 1.1, 2.2, 2.2)
    }
  }
})

/* ---------- eixos, rótulos e marcas finais de cada gráfico ---------- */
type Chrome = (ctx: CanvasRenderingContext2D, A: Area, a: number, n: number, cUS: string, cBR: string, w: number, h: number) => void
function txt(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, cor: string, peso = 500, tam = 12, al: CanvasTextAlign = 'left') {
  ctx.font = `${peso} ${tam}px 'Libre Franklin'`
  ctx.fillStyle = cor
  ctx.textAlign = al
  ctx.fillText(s, x, y)
  ctx.textAlign = 'left'
}
const hl = (ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number, cor: string) => {
  ctx.fillStyle = cor
  ctx.fillRect(x0, Math.round(y), x1 - x0, 1)
}
const vl = (ctx: CanvasRenderingContext2D, x: number, y0: number, y1: number, cor: string) => {
  ctx.fillStyle = cor
  ctx.fillRect(Math.round(x), y0, 1, y1 - y0)
}
function cabecalho(ctx: CanvasRenderingContext2D, A: Area, eixo: string, cUS: string, cBR: string) {
  const c = cores.value
  txt(ctx, eixo, A.x0, A.y0 - 34, c.texto2, 500, 12.5)
  let x = A.x1
  const y = A.y0 - 38
  for (const [nome, cor] of [
    ['Brasil', cBR],
    ['EUA', cUS],
  ]) {
    ctx.font = "500 12.5px 'Libre Franklin'"
    x -= ctx.measureText(nome).width
    txt(ctx, nome, x, y + 4, c.texto2, 500, 12.5)
    x -= 24
    ctx.fillStyle = `rgb(${cor})`
    ctx.fillRect(x, y - 1, 18, 3)
    x -= 22
  }
}
const fonteTxt = computed(() => {
  const s = [props.n.serieUs, props.n.serieBr].filter(Boolean).map((x) => `${x!.fonte.portal} (${x!.codigo.replace(/\s*\(.*\)$/, '')})`)
  return textoNarrativa('fonte', { fontes: s.join(' e '), edicao: props.n.edicao })
})
/** Nota e fonte embaixo de cada gráfico, em duas linhas para não cortar em 1366 px. */
function rodape(ctx: CanvasRenderingContext2D, A: Area, extra = '') {
  if (extra) txt(ctx, extra, A.x0, A.y1 + 48, cores.value.texto3, 400, 12)
  txt(ctx, fonteTxt.value, A.x0, A.y1 + (extra ? 65 : 48), cores.value.texto3, 400, 12)
}
function linha(ctx: CanvasRenderingContext2D, pts: [number, number][], cor: string) {
  ctx.strokeStyle = `rgb(${cor})`
  ctx.lineWidth = 2
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.beginPath()
  pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
  ctx.stroke()
}
function ponto(ctx: CanvasRenderingContext2D, x: number, y: number, cor: string, r = 4) {
  ctx.fillStyle = cores.value.fundo
  ctx.beginPath()
  ctx.arc(x, y, r + 2, 0, 7)
  ctx.fill()
  ctx.fillStyle = `rgb(${cor})`
  ctx.beginPath()
  ctx.arc(x, y, r, 0, 7)
  ctx.fill()
}
/** Coluna que cresce para baixo: base reta na linha do zero, ponta arredondada (4 px). */
function coluna(ctx: CanvasRenderingContext2D, x: number, y0: number, larg: number, alt: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x, y0)
  ctx.lineTo(x + larg, y0)
  ctx.lineTo(x + larg, y0 + alt - r)
  ctx.quadraticCurveTo(x + larg, y0 + alt, x + larg - r, y0 + alt)
  ctx.lineTo(x + r, y0 + alt)
  ctx.quadraticCurveTo(x, y0 + alt, x, y0 + alt - r)
  ctx.closePath()
  ctx.fill()
}
function barra(ctx: CanvasRenderingContext2D, x0: number, y: number, comp: number, alt: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x0, y)
  ctx.lineTo(x0 + comp - r, y)
  ctx.quadraticCurveTo(x0 + comp, y, x0 + comp, y + r)
  ctx.lineTo(x0 + comp, y + alt - r)
  ctx.quadraticCurveTo(x0 + comp, y + alt, x0 + comp - r, y + alt)
  ctx.lineTo(x0, y + alt)
  ctx.closePath()
  ctx.fill()
}
const ticksV = computed(() => {
  const [a, b] = dominio.value
  const passo = b - a > 30 ? 10 : 5
  const out: number[] = []
  for (let v = Math.ceil(a / passo) * passo; v <= b; v += passo) out.push(v)
  return out
})
const unidade = computed(() => props.n.serieBr.unidade_painel)
const ehIndice = computed(() => props.n.serieBr.metodo.tipo === 'indice')
const fmtDist = (v: number) => (ehIndice.value ? `${comSinal(v)}%` : `${comSinal(v)} p.p.`)

const CHROME: (Chrome | null)[] = [
  null,
  // 1 · calendário
  (ctx, A, a, n, cUS, cBR) => {
    const c = cores.value
    ctx.globalAlpha = a
    for (const r of props.n.cronologia) {
      const x0 = G.Xc(A, mesesDe(r.pico) / 12)
      const x1 = G.Xc(A, mesesDe(r.vale) / 12)
      if (x1 < A.x0 || x0 > A.x1) continue
      ctx.fillStyle = c.nber
      ctx.fillRect(Math.max(A.x0, x0), A.y0, Math.max(2, Math.min(A.x1, x1) - Math.max(A.x0, x0)), A.y1 - A.y0)
    }
    ticksV.value.forEach((v) => {
      hl(ctx, A.x0, A.x1, G.Yv(A, v), v === 100 ? c.ref : c.grade)
      txt(ctx, String(v), A.x0 - 10, G.Yv(A, v) + 4, c.texto3, 500, 12, 'right')
    })
    const [y0, y1] = anos.value
    const passo = y1 - y0 > 30 ? 5 : 2
    for (let y = Math.ceil(y0 / passo) * passo; y <= y1; y += passo) txt(ctx, String(y), G.Xc(A, y), A.y1 + 24, c.texto3, 500, 12, 'center')
    hl(ctx, A.x0, A.x1, A.y1, c.ref)
    cabecalho(ctx, A, unidade.value, cUS, cBR)
    eps.value.forEach((e) => txt(ctx, e.rotulo, G.Xc(A, anoDoMes(e.pico, 12)), A.y0 + 16, c.texto, 600, 13, 'center'))
    rodape(ctx, A, textoNarrativa('faixa_nber'))
    if (n > 0) {
      ctx.globalAlpha = a * n
      eps.value.forEach((e) =>
        ([['us', e.us, cUS], ['br', e.br, cBR]] as const).forEach(([, curva, cor]) => {
          if (!curva) return
          const pts: [number, number][] = []
          for (let m = -props.n.antes; m <= props.n.depois; m += 0.5) pts.push([G.Xc(A, anoDoMes(e.pico, m)), G.Yv(A, valorEm(curva, props.n.antes, m) ?? 100)])
          linha(ctx, pts, cor)
        }),
      )
    }
    ctx.globalAlpha = 1
  },
  // 2 · episódios alinhados ao pico, um quadro por episódio, mesma escala
  (ctx, A, a, n, cUS, cBR) => {
    const c = cores.value
    ctx.globalAlpha = a
    cabecalho(ctx, A, unidade.value, cUS, cBR)
    const { antes, depois } = props.n
    eps.value.forEach((e, ie) => {
      const q = G.painel(A, ie)
      ctx.fillStyle = c.nber
      ctx.fillRect(G.Xm(A, ie, 0), A.y0 + 14, G.Xm(A, ie, e.duracao) - G.Xm(A, ie, 0), A.y1 - A.y0 - 14)
      txt(ctx, e.rotulo, q.x0, A.y0 - 8, c.texto, 600, 15)
      ticksV.value.forEach((v) => {
        hl(ctx, q.x0, q.x0 + q.pw, G.Yv(A, v), v === 100 ? c.ref : c.grade)
        if (ie === 0) txt(ctx, String(v), q.x0 - 10, G.Yv(A, v) + 4, c.texto3, 500, 12, 'right')
      })
      hl(ctx, q.x0, q.x0 + q.pw, A.y1, c.ref)
      for (const m of [-antes, 0, 12, 24, depois]) txt(ctx, m === 0 ? 'pico' : `${m > 0 ? '+' : '−'}${Math.abs(m)}`, G.Xm(A, ie, m), A.y1 + 24, c.texto3, 500, 12, m === -antes ? 'left' : m === depois ? 'right' : 'center')
      if (n > 0) {
        ctx.globalAlpha = a * n
        ;([[e.us, cUS], [e.br, cBR]] as const).forEach(([curva, cor]) => {
          if (!curva) return
          const pts: [number, number][] = []
          for (let m = -antes; m <= depois; m += 0.5) pts.push([G.Xm(A, ie, m), G.Yv(A, valorEm(curva, antes, m) ?? 100)])
          linha(ctx, pts, cor)
        })
        const r = e.resumoBr
        if (r.meses_ate_vale != null && r.variacao_pico_vale != null) {
          const x = G.Xm(A, ie, r.meses_ate_vale)
          const y = G.Yv(A, valorEm(e.br, antes, r.meses_ate_vale) ?? 100)
          ponto(ctx, x, y, cBR)
          const dir = r.meses_ate_vale > depois * 0.6
          txt(ctx, `Brasil ${fmtDist(r.variacao_pico_vale)}`, x + (dir ? -10 : 10), y + 18, c.texto, 600, 12.5, dir ? 'right' : 'left')
        }
        ctx.globalAlpha = a
      }
    })
    rodape(ctx, A, `${textoNarrativa('eixo_alinhado')}. Faixa: recessão nos EUA (NBER)`)
    ctx.globalAlpha = 1
  },
  // 3 · maior distância do pico (colunas)
  (ctx, A, a, n, cUS, cBR) => {
    const c = cores.value
    ctx.globalAlpha = a
    const b = G.base(A)
    const passo = maxDist.value > 20 ? 10 : 5
    for (let v = 0; v <= maxDist.value; v += passo) {
      hl(ctx, A.x0, A.x1, G.Yd(A, v), v === 0 ? c.ref : c.grade)
      txt(ctx, v === 0 ? '0' : `${ehIndice.value ? '−' : ''}${v}${ehIndice.value ? '%' : ''}`, A.x0 - 10, G.Yd(A, v) + 4, c.texto3, 500, 12, 'right')
    }
    cabecalho(ctx, A, textoNarrativa('eixo_queda') + (ehIndice.value ? ' (%)' : ' (p.p.)'), cUS, cBR)
    eps.value.forEach((e, ie) => {
      txt(ctx, e.rotulo, G.gx(A, ie), b - 14, c.texto, 600, 15, 'center')
      if (n > 0) {
        ctx.globalAlpha = a * n
        ;(['us', 'br'] as Pa[]).forEach((pa) => {
          const r = resumo(pa, ie)
          if (r?.variacao_pico_vale == null) return
          const x = G.gx(A, ie) + (pa === 'us' ? -25 : 1)
          const alt = G.Yd(A, r.variacao_pico_vale) - b
          ctx.fillStyle = `rgb(${pa === 'us' ? cUS : cBR})`
          coluna(ctx, x, b, 24, alt, 4)
          if (pa === 'us') txt(ctx, fmtDist(r.variacao_pico_vale), x - 6, b + alt - 2, c.texto, 600, 12.5, 'right')
          else txt(ctx, fmtDist(r.variacao_pico_vale), x + 30, b + alt - 2, c.texto, 600, 12.5, 'left')
        })
        ctx.globalAlpha = a
      }
    })
    rodape(ctx, A, 'Medida: variação entre o pico e o ponto extremo (fato_resumo_episodio)')
    ctx.globalAlpha = 1
  },
  // 4 · meses até voltar ao nível do pico (barras)
  (ctx, A, a, n, cUS, cBR) => {
    const c = cores.value
    ctx.globalAlpha = a
    const { depois } = props.n
    for (let m = 0; m <= depois; m += 12) {
      vl(ctx, G.Xr(A, m), A.y0 + 30, A.y1, m === 0 ? c.ref : c.grade)
      txt(ctx, m === 0 ? '0' : `${m} meses`, G.Xr(A, m), A.y1 + 24, c.texto3, 500, 12, m === 0 ? 'left' : 'center')
    }
    cabecalho(ctx, A, textoNarrativa('eixo_volta'), cUS, cBR)
    eps.value.forEach((e, ie) => {
      txt(ctx, e.rotulo, A.x0 - 14, G.gy(A, ie) + 5, c.texto, 600, 15, 'right')
      if (n > 0) {
        ctx.globalAlpha = a * n
        ;(['us', 'br'] as Pa[]).forEach((pa) => {
          const r = resumo(pa, ie)
          if (!r) return
          const y = G.gy(A, ie) + (pa === 'us' ? -21 : 1)
          const voltou = r.meses_ate_recuperacao != null
          const comp = G.Xr(A, r.meses_ate_recuperacao ?? depois) - A.x0
          ctx.fillStyle = `rgba(${pa === 'us' ? cUS : cBR},${voltou ? 1 : 0.22})`
          barra(ctx, A.x0, y, comp, 20, 4)
          const rot = voltou ? mesesTxt(r.meses_ate_recuperacao) : preencher(texto('nao_recuperado', { n: depois }), {})
          txt(ctx, `${pa === 'us' ? 'EUA' : 'Brasil'}: ${rot}`, A.x0 + comp + 8, y + 15, voltou ? c.texto : c.texto2, voltou ? 600 : 500, 12.5)
        })
        ctx.globalAlpha = a
      }
    })
    rodape(ctx, A, 'Medida: meses até a recuperação (fato_resumo_episodio)')
    ctx.globalAlpha = 1
  },
  // 5 · mês da primeira reação (halteres)
  (ctx, A, a, n, cUS, cBR) => {
    const c = cores.value
    ctx.globalAlpha = a
    for (let m = 0; m <= maxReacao.value; m += 2) {
      vl(ctx, G.Xl(A, m), A.y0 + 30, A.y1, m === 0 ? c.ref : c.grade)
      txt(ctx, m === 0 ? 'pico' : `+${m}`, G.Xl(A, m), A.y1 + 24, c.texto3, 500, 12, 'center')
    }
    cabecalho(ctx, A, textoNarrativa('eixo_reacao'), cUS, cBR)
    eps.value.forEach((e, ie) => {
      txt(ctx, e.rotulo, A.x0 + 26, G.gy(A, ie) + 5, c.texto, 600, 15, 'right')
      const ru = e.resumoUs?.mes_reacao
      const rb = e.resumoBr.mes_reacao
      if (n > 0 && ru != null && rb != null) {
        ctx.globalAlpha = a * n
        const y = G.gy(A, ie)
        const mesmo = ru === rb
        ctx.fillStyle = c.ref
        ctx.fillRect(Math.min(G.Xl(A, ru), G.Xl(A, rb)), y - 1, Math.abs(G.Xl(A, rb) - G.Xl(A, ru)), 2)
        ponto(ctx, G.Xl(A, ru), y + (mesmo ? -9 : 0), cUS, 6)
        ponto(ctx, G.Xl(A, rb), y + (mesmo ? 9 : 0), cBR, 6)
        const d = e.defasagem
        const rot = d == null ? texto('defasagem_sem') : d === 0 ? texto('defasagem_igual') : d > 0 ? texto('defasagem_depois', { n: mesesTxt(d) }) : texto('defasagem_antes', { n: mesesTxt(-d) })
        txt(ctx, rot, G.Xl(A, Math.max(ru, rb)) + 16, y + 5, c.texto, 600, 13)
        ctx.globalAlpha = a
      }
    })
    rodape(ctx, A, 'Medida: defasagem (fato_comparacao)')
    ctx.globalAlpha = 1
  },
]

/* ---------- textos das cenas (vindos de config/painel.json) ---------- */
const frases = computed(() => {
  const vars = { indicador: props.n.serieBr.nome.toLowerCase(), unidade: unidade.value, antes: props.n.antes, depois: props.n.depois }
  const cenas = config.narrativa.cenas.map((c) => ({ titulo: c.titulo, texto: preencher(c.texto, vars), nota: c.nota ?? '' }))
  // frases calculadas a partir das medidas publicadas, nunca escritas à mão
  const comp = eps.value.filter((e) => e.resumoUs?.variacao_pico_vale != null && e.resumoBr.variacao_pico_vale != null)
  const maisLonge = comp.filter((e) => Math.abs(e.resumoBr.variacao_pico_vale!) > Math.abs(e.resumoUs!.variacao_pico_vale!)).length
  if (cenas[3] && comp.length) cenas[3].nota = `Em ${maisLonge} de ${comp.length} recessões, o Brasil se afastou mais do pico que os EUA.`
  const comD = eps.value.filter((e) => e.defasagem != null)
  if (cenas[5] && comD.length) cenas[5].texto += ` ${texto('manchete_par', { depois: comD.filter((e) => e.defasagem! > 0).length, validos: comD.length })}.`
  return cenas
})
</script>

<template>
  <section ref="secao" class="ato" :style="{ height: `${NC * 190 + 100}vh` }" aria-label="Os meses da série organizados em gráficos">
    <div ref="palco" class="palco" @pointermove="move" @pointerleave="sai">
      <canvas ref="cv" aria-hidden="true" />
      <div v-for="(f, k) in frases" :key="k" class="cap" :class="{ on: cena === k }" :aria-hidden="cena !== k">
        <h2>{{ f.titulo }}</h2>
        <p>{{ f.texto }}</p>
        <p v-if="f.nota" class="nota-cena">{{ f.nota }}</p>
      </div>
      <table class="so-leitor">
        <caption>
          {{ n.serieBr.nome }}: medidas por recessão, Brasil e EUA
        </caption>
        <thead>
          <tr>
            <th>Recessão</th>
            <th>Maior distância do pico, Brasil</th>
            <th>Maior distância do pico, EUA</th>
            <th>Meses até voltar, Brasil</th>
            <th>Meses até voltar, EUA</th>
            <th>Defasagem (meses)</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="e in eps" :key="e.id">
            <td>{{ e.rotulo }}</td>
            <td>{{ e.resumoBr.variacao_pico_vale != null ? fmtDist(e.resumoBr.variacao_pico_vale) : 'sem dados' }}</td>
            <td>{{ e.resumoUs?.variacao_pico_vale != null ? fmtDist(e.resumoUs.variacao_pico_vale) : 'sem dados' }}</td>
            <td>{{ e.resumoBr.meses_ate_recuperacao ?? 'não voltou' }}</td>
            <td>{{ e.resumoUs?.meses_ate_recuperacao ?? 'não voltou' }}</td>
            <td>{{ e.defasagem ?? 'sem dados' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.ato {
  position: relative;
}
.palco {
  position: sticky;
  top: 0;
  height: 100vh;
  overflow: hidden;
  background: #070b10;
  color: #e9eef2;
}
canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
.cap {
  position: absolute;
  left: 6vw;
  top: 17vh;
  width: min(23vw, 22rem);
  opacity: 0;
  transform: translateY(12px);
  transition: opacity 0.5s, transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
  pointer-events: none;
}
.cap.on {
  opacity: 1;
  transform: none;
}
.cap h2 {
  font-size: clamp(28px, 2.6vw, 40px);
  line-height: 1.06;
  color: inherit;
  margin-bottom: 14px;
}
.cap p {
  font-size: 15.5px;
  line-height: 1.55;
  opacity: 0.85;
  max-width: 34ch;
}
.cap .nota-cena {
  margin-top: 12px;
  font-size: 13px;
  font-weight: 600;
  opacity: 1;
}
.so-leitor {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
