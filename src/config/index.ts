/**
 * Configuração do painel: textos, opções dos filtros, cores e glossário ficam em painel.json,
 * fora dos componentes. Para mudar um texto ou acrescentar uma janela, edite o JSON.
 */
import bruto from './painel.json'

export interface ConfigPainel {
  titulo: string
  subtitulo: string
  aviso_ilustrativo: string
  padroes: { serie: string; antes: number; depois: number }
  janelas: { antes: number[]; depois: number[] }
  cores: { episodios: number[]; paises: Record<string, number>; pais_foco: string; paises_tracejados: string[] }
  abas: { id: string; nome: string }[]
  textos: Record<string, string> & { sentido: Record<string, string> }
  glossario: [string, string][]
  narrativa: ConfigNarrativa
}

export interface ConfigNarrativa {
  ativa: boolean
  serie: string
  antes: number
  depois: number
  cenas: { titulo: string; texto: string; nota?: string }[]
  [chave: string]: unknown
}

/** Texto da abertura narrativa (config.narrativa), com {chaves} preenchidas. */
export function textoNarrativa(chave: string, vars: Record<string, string | number> = {}): string {
  const modelo = config.narrativa[chave]
  return typeof modelo === 'string' ? preencher(modelo, vars) : chave
}

export const config = bruto as unknown as ConfigPainel

/** Preenche {chaves} de um modelo de texto do painel.json. */
export function texto(chave: string, vars: Record<string, string | number> = {}): string {
  const modelo = config.textos[chave]
  if (typeof modelo !== 'string') return chave
  return preencher(modelo, vars)
}

export function preencher(modelo: string, vars: Record<string, string | number>): string {
  return modelo.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`))
}
