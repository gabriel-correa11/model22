/**
 * Rolagem narrativa sem bibliotecas de animação.
 *
 * Cada ato da abertura é uma seção alta com um palco fixo (position: sticky). O progresso do ato
 * (0 no início da seção, 1 no fim) é lido da posição da página a cada quadro e suavizado,
 * para que a roda do mouse não faça a cena pular. Como o desenho depende só desse progresso,
 * rolar para cima desfaz a cena e recarregar a página no meio já mostra o quadro certo.
 *
 * Com "reduzir movimento" ativado no sistema, a suavização é desligada e os efeitos contínuos
 * (pulsos, deriva dos pontos) param; o conteúdo e os números continuam os mesmos.
 */
import { onBeforeUnmount, onMounted, type Ref } from 'vue'

export const movimentoReduzido =
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

export const limita = (v: number) => Math.max(0, Math.min(1, v))
export const interpola = (a: number, b: number, k: number) => a + (b - a) * k
/** Posição de p dentro do intervalo [a, b], limitada a 0..1. */
export const faixa = (p: number, a: number, b: number) => limita((p - a) / (b - a))
export const suave = (k: number) => k * k * (3 - 2 * k)
export const suaveIO = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2)

/** Progresso bruto de uma seção alta: 0 quando o topo chega ao topo da tela, 1 quando o fim chega ao fim. */
export function progressoDe(el: HTMLElement): number {
  const r = el.getBoundingClientRect()
  const total = r.height - innerHeight
  return total > 0 ? limita(-r.top / total) : 0
}

export interface Quadro {
  /** Tempo em segundos, para efeitos contínuos. */
  t: number
  /** Progresso suavizado do ato, 0..1. */
  p: number
}

/**
 * Liga um ato ao laço de quadros: só desenha enquanto a seção está visível
 * e a aba está aberta (economiza bateria e processador).
 */
export function useAto(secao: Ref<HTMLElement | null>, desenhar: (q: Quadro) => void) {
  let visivel = false
  let p = 0
  let ultimo = performance.now()
  let id = 0
  let obs: IntersectionObserver | null = null

  function passo(agora: number) {
    id = requestAnimationFrame(passo)
    if (!visivel || document.hidden || !secao.value) return
    const dt = Math.min(0.1, (agora - ultimo) / 1000)
    ultimo = agora
    const alvo = progressoDe(secao.value)
    p = movimentoReduzido ? alvo : p + (alvo - p) * (1 - Math.exp(-dt * 9))
    if (Math.abs(alvo - p) < 0.0004) p = alvo
    desenhar({ t: movimentoReduzido ? 0 : agora / 1000, p })
  }

  onMounted(() => {
    if (secao.value) p = progressoDe(secao.value)
    obs = new IntersectionObserver(([e]) => (visivel = e.isIntersecting), { rootMargin: '100px 0px' })
    if (secao.value) obs.observe(secao.value)
    id = requestAnimationFrame(passo)
  })
  onBeforeUnmount(() => {
    cancelAnimationFrame(id)
    obs?.disconnect()
  })
}

/** Canvas nítido em telas de alta densidade (limite 2x) que acompanha o tamanho do elemento. */
export function usaCanvas(cv: Ref<HTMLCanvasElement | null>) {
  const estado = { ctx: null as CanvasRenderingContext2D | null, w: 0, h: 0 }
  let ro: ResizeObserver | null = null
  function ajusta() {
    const el = cv.value
    if (!el) return
    const r = el.getBoundingClientRect()
    const d = Math.min(2, devicePixelRatio || 1)
    el.width = Math.round(r.width * d)
    el.height = Math.round(r.height * d)
    estado.ctx = el.getContext('2d')
    estado.ctx?.setTransform(d, 0, 0, d, 0, 0)
    estado.w = r.width
    estado.h = r.height
  }
  onMounted(() => {
    ajusta()
    ro = new ResizeObserver(ajusta)
    if (cv.value) ro.observe(cv.value)
  })
  onBeforeUnmount(() => ro?.disconnect())
  return estado
}

/** Lê um token de cor de styles/tokens.css (acompanha o tema claro ou escuro do sistema). */
export function token(nome: string, el: Element = document.documentElement): string {
  return getComputedStyle(el).getPropertyValue(nome).trim()
}

/** Converte #rgb, #rrggbb ou rgb(r, g, b) em [r, g, b]. O build minifica #ffffff para #fff. */
export function rgb(cor: string): [number, number, number] {
  const m = cor.match(/rgba?\(([^)]+)\)/)
  if (m) return m[1].split(',').slice(0, 3).map((v) => Number(v.trim())) as [number, number, number]
  let h = cor.replace('#', '').trim()
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number]
}
export function misturaRgb(a: string, b: string, k: number): string {
  const A = rgb(a)
  const B = rgb(b)
  return A.map((v, i) => Math.round(interpola(v, B[i], k))).join(',')
}
