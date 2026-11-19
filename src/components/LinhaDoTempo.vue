<script setup lang="ts">
/**
 * Linha do tempo das recessões do NBER, que também é o seletor de episódios (RF08).
 * As faixas vão do pico ao vale de cada episódio, como o FRED sombreia recessões.
 * O período mostrado vem dos dados: da década do primeiro pico até a data da edição.
 */
import { computed } from 'vue'
import { base, filtros, corEpisodio } from '../lib/estado'
import { mesAno } from '../lib/formatos'
import { texto } from '../config'

const emMeses = (ym: string) => {
  const [a, m] = ym.split('-').map(Number)
  return a * 12 + (m - 1)
}

const periodo = computed(() => {
  const b = base.value
  if (!b || !b.episodios.length) return null
  const picos = [...b.episodios, ...b.cronologia].map((e) => Number(e.pico.slice(0, 4)))
  const primeiroAno = Math.min(...picos)
  const inicio = Math.floor(primeiroAno / 10) * 10 * 12
  const fim = emMeses(b.edicao.gerado_em.slice(0, 7)) + 1
  return { inicio, fim }
})

const pos = (meses: number) => {
  const p = periodo.value!
  return ((meses - p.inicio) / (p.fim - p.inicio)) * 100
}

const anos = computed(() => {
  const p = periodo.value
  if (!p) return []
  const out: { ano: number; x: number; rotulo: boolean }[] = []
  for (let a = p.inicio / 12; a * 12 <= p.fim; a += 5) out.push({ ano: a, x: pos(a * 12), rotulo: a % 10 === 0 })
  return out
})

const faixas = computed(() =>
  (base.value?.episodios ?? []).map((e) => {
    const x = pos(emMeses(e.pico))
    const largura = pos(emMeses(e.vale) + 1) - x
    const ativo = filtros.episodios.includes(e.id)
    return { e, x, largura, ativo, aDireita: x > 80 }
  }),
)

/** Recessões do NBER que não estão entre os episódios analisados: só contexto. */
const outras = computed(() => {
  const b = base.value
  if (!b) return []
  const analisados = new Set(b.episodios.map((e) => e.pico))
  return b.cronologia
    .filter((r) => !analisados.has(r.pico))
    .map((r) => ({ r, x: pos(emMeses(r.pico)), largura: pos(emMeses(r.vale) + 1) - pos(emMeses(r.pico)) }))
})

function alternar(id: string) {
  const i = filtros.episodios.indexOf(id)
  if (i < 0) filtros.episodios.push(id)
  else if (filtros.episodios.length > 1) filtros.episodios.splice(i, 1)
}
</script>

<template>
  <section v-if="periodo" class="linha-tempo" aria-labelledby="lt-titulo">
    <p id="lt-titulo" class="explica">{{ texto('linha_tempo') }}</p>
    <div class="trilho">
      <div class="eixo" aria-hidden="true" />
      <span
        v-for="a in anos"
        :key="a.ano"
        class="ano"
        :class="{ menor: !a.rotulo }"
        :style="{ left: `${a.x}%` }"
        aria-hidden="true"
      >
        <span v-if="a.rotulo" class="num" :class="{ inicio: a.x < 1, fim: a.x > 99 }">{{ a.ano }}</span>
      </span>

      <span
        v-for="o in outras"
        :key="o.r.pico"
        class="faixa contexto"
        :style="{ left: `${o.x}%`, width: `max(6px, ${o.largura}%)` }"
        :title="`Recessão de ${mesAno(o.r.pico)} a ${mesAno(o.r.vale)}, fora da análise`"
      />

      <button
        v-for="f in faixas"
        :key="f.e.id"
        type="button"
        class="faixa"
        :class="{ ativo: f.ativo, 'a-direita': f.aDireita }"
        :style="{ left: `${f.x}%`, width: `max(12px, ${f.largura}%)`, '--cor': corEpisodio(f.e.id) }"
        :aria-pressed="f.ativo"
        :disabled="f.ativo && filtros.episodios.length === 1"
        :aria-label="`${f.e.nome}, de ${mesAno(f.e.pico)} a ${mesAno(f.e.vale)}`"
        @click="alternar(f.e.id)"
      >
        <span class="rotulo">
          <span class="nome">{{ f.e.rotulo }}</span>
          <span class="datas">{{ mesAno(f.e.pico) }} a {{ mesAno(f.e.vale) }}</span>
        </span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.explica {
  font-size: var(--t-5);
  color: var(--texto-2);
}
/* Sem recuo lateral: o eixo começa na mesma margem do título e dos filtros. */
.trilho {
  position: relative;
  height: 82px;
  margin-top: 2px;
}
.eixo {
  position: absolute;
  left: 0;
  right: 0;
  top: 60px;
  border-top: 1px solid var(--referencia);
}
.ano {
  position: absolute;
  top: 60px;
  height: 6px;
  border-left: 1px solid var(--referencia);
}
.ano.menor {
  height: 4px;
}
.ano .num.inicio {
  transform: none;
}
.ano .num.fim {
  transform: translateX(-100%);
}
.ano .num {
  position: absolute;
  top: 6px;
  transform: translateX(-50%);
  font-size: var(--t-5);
  color: var(--texto-3);
}
.faixa {
  position: absolute;
  top: 42px;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: 1px 1px 0 0;
  background: var(--faixa-fora);
  cursor: pointer;
  transition: background-color var(--transicao), outline-color var(--transicao);
}
.faixa:not(.ativo):not(.contexto) {
  border: 1px dashed var(--texto-3);
  border-bottom: 0;
}
.faixa.contexto {
  top: 51px;
  height: 9px;
  cursor: default;
  background: var(--faixa-fora);
  border-radius: 1px 1px 0 0;
}
.faixa.ativo {
  background: var(--cor);
}
.faixa:hover:not(:disabled) {
  outline: 1px solid var(--texto);
  outline-offset: 1px;
}
.faixa:disabled {
  cursor: default;
}
.rotulo {
  position: absolute;
  bottom: calc(100% + 3px);
  left: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  white-space: nowrap;
  line-height: 1.2;
  text-align: left;
}
.a-direita .rotulo {
  left: auto;
  right: 0;
  align-items: flex-end;
}
.nome {
  font-family: var(--fonte-titulo);
  font-size: var(--t-num);
  line-height: 1.1;
  color: var(--texto-2);
}
.ativo .nome {
  color: var(--texto);
}
.datas {
  font-size: var(--t-5);
  color: var(--texto-3);
}
@media (max-width: 700px) {
  .datas {
    display: none;
  }
  .trilho {
    height: 62px;
  }
  .faixa {
    top: 22px;
  }
  .faixa:not(.ativo):not(.contexto) {
  border: 1px dashed var(--texto-3);
  border-bottom: 0;
}
.faixa.contexto {
    top: 31px;
  }
  .eixo,
  .ano {
    top: 54px;
  }
}
</style>
