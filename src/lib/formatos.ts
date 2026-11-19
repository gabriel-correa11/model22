import type { Serie } from './contrato'

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export function mesAno(ym: string): string {
  const [a, m] = ym.split('-').map(Number)
  return `${MESES[m - 1]}/${a}`
}

export function numero(v: number, casas = 1): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
}

export function comSinal(v: number, casas = 1): string {
  const s = numero(Math.abs(v), casas)
  return v > 0 ? `+${s}` : v < 0 ? `−${s}` : s
}

/** Variação pico-vale já com a unidade certa para o método da série. */
export function variacao(v: number | null | undefined, s: Serie | undefined): string {
  if (v == null || !s) return '—'
  return s.metodo.tipo === 'indice' ? `${comSinal(v)}%` : `${comSinal(v)} p.p.`
}

/** Valor no eixo do painel: índice (100 = pico) ou p.p. desde o pico. */
export function valorPainel(v: number, s: Serie | undefined): string {
  if (!s) return numero(v)
  return s.metodo.tipo === 'indice' ? numero(v) : `${comSinal(v, 2)} p.p.`
}

export function meses(n: number | null | undefined): string {
  if (n == null) return '—'
  return n === 1 ? '1 mês' : `${n} meses`
}

export function mesRelativo(m: number): string {
  if (m === 0) return 'pico'
  return m > 0 ? `+${m}` : `−${Math.abs(m)}`
}

export function dataHora(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
