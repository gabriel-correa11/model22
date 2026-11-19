<script setup lang="ts">
/**
 * Defasagem EUA → Brasil por par de séries e episódio (fato_comparacao).
 * É a visão da hipótese H1: um ponto por episódio, na mesma régua de meses.
 * Pontos com o mesmo valor são empilhados na vertical para não se esconderem.
 */
import { computed } from 'vue'
import { base, episodiosAtivos, serie, filtros, corEpisodio } from '../lib/estado'
import { defasagemCurta } from '../lib/manchetes'
import { texto } from '../config'

const linhas = computed(() => {
  const comps = (base.value?.comparacoes ?? []).filter((c) => {
    const a = serie(c.id_serie_eua)
    return a && (filtros.grupo === 'todos' || a.grupo === filtros.grupo)
  })
  const ids = [...new Set(comps.map((c) => c.id_serie_eua))]
  return ids.map((id) => {
    const a = serie(id)!
    const b = serie(a.id_serie_par)
    const pontos = episodiosAtivos.value.map((e) => ({
      e,
      d: comps.find((c) => c.id_serie_eua === id && c.id_episodio === e.id)?.defasagem_meses ?? null,
    }))
    const semDados = pontos.filter((p) => p.d == null).map((p) => p.e.rotulo)
    return { id, nome: a.nome === b?.nome ? a.nome : `${a.nome} × ${b?.nome ?? ''}`, pontos, semDados }
  })
})

const limite = computed(() => {
  const ds = linhas.value.flatMap((l) => l.pontos.map((p) => Math.abs(p.d ?? 0)))
  return Math.max(3, ...ds) + 1
})
const ticks = computed(() => {
  const out: number[] = []
  for (let v = -limite.value; v <= limite.value; v++) out.push(v)
  return out
})
const pos = (d: number) => ((d + limite.value) / (2 * limite.value)) * 100

/** Deslocamento vertical para pontos coincidentes na mesma linha. */
function desvio(pontos: { d: number | null }[], i: number) {
  const d = pontos[i].d
  const iguais = pontos.map((p, k) => (p.d === d ? k : -1)).filter((k) => k >= 0)
  if (iguais.length < 2) return 0
  return (iguais.indexOf(i) - (iguais.length - 1) / 2) * 11
}
</script>

<template>
  <section v-if="linhas.length" class="painel graf-defasagem">
    <header>
      <h2>{{ texto('titulo_defasagem') }}</h2>
      <p class="nota">{{ texto('sub_defasagem') }}</p>
    </header>
    <ul class="legenda">
      <li v-for="e in episodiosAtivos" :key="e.id"><span class="bola" :style="{ background: corEpisodio(e.id) }" />{{ e.rotulo }}</li>
    </ul>
    <div class="grafico" role="img" :aria-label="texto('titulo_defasagem')">
      <div class="lados nota" aria-hidden="true">
        <span />
        <span class="regua"><span>← Brasil reagiu antes</span><span>Brasil reagiu depois →</span></span>
      </div>
      <div v-for="l in linhas" :key="l.id" class="linha">
        <span class="nome">
          {{ l.nome }}
          <span v-if="l.semDados.length" class="nota">sem dados no Brasil em {{ l.semDados.join(' e ') }}</span>
        </span>
        <span class="regua">
          <span class="fio" />
          <span class="zero" />
          <span
            v-for="(p, i) in l.pontos"
            v-show="p.d != null"
            :key="p.e.id"
            class="ponto"
            :style="{ left: `${pos(p.d ?? 0)}%`, marginTop: `${desvio(l.pontos, i)}px`, background: corEpisodio(p.e.id), '--i': i }"
            :title="`${p.e.rotulo}: ${defasagemCurta(p.d)}`"
          />
        </span>
      </div>
      <div class="linha eixo" aria-hidden="true">
        <span />
        <span class="regua">
          <span v-for="t in ticks" :key="t" class="tick num" :style="{ left: `${pos(t)}%` }">{{ t > 0 ? `+${t}` : t < 0 ? `−${-t}` : '0' }}</span>
        </span>
      </div>
      <p class="nota titulo-eixo">Meses (0 = reagiram no mesmo mês)</p>
    </div>
    <p class="nota">Fonte: fato_comparacao, edição {{ base?.edicao.id_edicao }}. Passe o mouse num ponto para ver o valor.</p>
  </section>
</template>

<style scoped>
header p {
  margin-top: 2px;
  max-width: 52ch;
}
.legenda {
  list-style: none;
  display: flex;
  gap: var(--esp-6);
  margin: var(--esp-3) 0 var(--esp-2);
  padding: 0;
  font-size: var(--t-5);
}
.bola,
.ponto {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}
.bola {
  display: inline-block;
  margin-right: 6px;
  vertical-align: -1px;
}
.linha,
.lados {
  display: grid;
  grid-template-columns: minmax(180px, 300px) minmax(0, 1fr);
  column-gap: var(--esp-6);
  align-items: center;
}
.linha {
  min-height: 40px;
  border-top: 1px solid var(--grade);
}
.linha.eixo {
  min-height: 22px;
  border-top: 1px solid var(--referencia);
}
.nome {
  font-size: var(--t-4);
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}
.regua {
  position: relative;
  height: 100%;
  min-height: 22px;
  margin: 0 12px;
}
.lados .regua {
  display: flex;
  justify-content: space-between;
  margin-bottom: 2px;
}
.fio {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  border-top: 1px solid var(--grade);
}
.zero {
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  border-left: 1.5px solid var(--referencia);
}
.ponto {
  animation: surge-ponto 420ms cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-delay: calc(var(--i) * 90ms + 150ms);
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  border: 2px solid var(--superficie);
  box-sizing: content-box;
}
.tick {
  position: absolute;
  top: 4px;
  transform: translateX(-50%);
  font-size: var(--t-5);
  color: var(--texto-3);
}
.titulo-eixo {
  text-align: center;
  padding-left: 300px;
  margin-top: 2px;
}
.grafico + .nota {
  margin-top: var(--esp-2);
}
@keyframes surge-ponto {
  from {
    opacity: 0;
    scale: 0.2;
  }
}
@media (prefers-reduced-motion: reduce) {
  .ponto {
    animation: none;
  }
}
</style>
