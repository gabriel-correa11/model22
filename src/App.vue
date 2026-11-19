<script setup lang="ts">
import { computed, onMounted, ref, type Component } from 'vue'
import BarraFiltros from './components/BarraFiltros.vue'
import LinhaDoTempo from './components/LinhaDoTempo.vue'
import VisaoEpisodios from './components/VisaoEpisodios.vue'
import VisaoPaises from './components/VisaoPaises.vue'
import QuadroResumo from './components/QuadroResumo.vue'
import VisaoMetodo from './components/VisaoMetodo.vue'
import AberturaNarrativa from './narrativa/AberturaNarrativa.vue'
import { base, aba, iniciarFiltros } from './lib/estado'
import { carregarBase } from './lib/contrato'
import { config, preencher } from './config'
import { exportarCsv } from './lib/csv'

/** Liga o id de cada aba (config/painel.json) ao componente que a desenha. */
const visoes: Record<string, Component> = {
  episodios: VisaoEpisodios,
  paises: VisaoPaises,
  medidas: QuadroResumo,
  metodo: VisaoMetodo,
}

const erro = ref<string | null>(null)
onMounted(async () => {
  try {
    const b = await carregarBase()
    iniciarFiltros(b)
    base.value = b
  } catch (e) {
    erro.value = e instanceof Error ? e.message : String(e)
  }
})

const subtitulo = computed(() =>
  preencher(config.subtitulo, { episodios: (base.value?.episodios ?? []).map((e) => e.rotulo).join(', ') }),
)
const fontes = computed(() => [...new Set((base.value?.series ?? []).map((s) => s.fonte.portal))].join(', '))
</script>

<template>
  <div class="pagina">
    <AberturaNarrativa v-if="base && config.narrativa.ativa" />
    <div id="painel" class="capa" tabindex="-1">
      <div class="miolo">
        <header class="topo">
          <div>
            <h1>{{ config.titulo }}</h1>
            <p v-if="base" class="sub">{{ subtitulo }}</p>
          </div>
          <div v-if="base" class="acoes">
            <p v-if="base.edicao.ilustrativo" class="ilustrativo">{{ config.aviso_ilustrativo }}</p>
            <button type="button" class="controle exportar" @click="exportarCsv">Baixar dados (CSV)</button>
          </div>
        </header>

        <p v-if="erro" class="erro">Não foi possível carregar os dados: {{ erro }}</p>
        <p v-else-if="!base" class="secundario">Carregando dados…</p>

        <template v-else>
          <LinhaDoTempo class="secao-tempo" />
          <nav class="abas" aria-label="Visões">
            <button
              v-for="a in config.abas"
              :key="a.id"
              type="button"
              :aria-current="aba === a.id ? 'page' : undefined"
              @click="aba = a.id"
            >
              {{ a.nome }}
            </button>
          </nav>
        </template>
      </div>
    </div>

    <div v-if="base" class="miolo corpo">
      <BarraFiltros />

      <main>
        <component :is="visoes[aba]" />
      </main>

      <footer class="nota">
        Fontes: {{ fontes }}. Datas das recessões: NBER. Edição {{ base.edicao.id_edicao }}, gerada em {{ base.edicao.gerado_em.slice(0, 10) }}.
      </footer>
    </div>
  </div>
</template>

<style scoped>
/*
 * A página é compacta no topo para que o primeiro visual apareça inteiro em 1366 × 768 (RNF10):
 * 16–24px entre cabeçalho, linha do tempo e controles; os visuais ficam em superfícies (.painel).
 */
/*
 * Duas zonas. A capa (papel quente, de ponta a ponta) guarda o que situa o leitor: título,
 * linha do tempo e abas; a borda de baixo dela é o próprio fio das abas. Abaixo, a área branca
 * de leitura com os filtros da aba e os gráficos.
 */
.capa {
  background: var(--capa);
}
.capa:focus {
  outline: none;
}
.miolo {
  max-width: 1320px;
  margin: 0 auto;
  padding: 0 var(--esp-6);
}
.capa .miolo {
  padding-top: var(--esp-4);
}
.corpo {
  padding-bottom: var(--esp-8);
}
.topo {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--esp-6);
}
.sub {
  margin-top: 4px;
  font-size: var(--t-texto);
  color: var(--texto-2);
}
.acoes {
  flex: none;
  display: flex;
  align-items: center;
  gap: var(--esp-4);
}
.ilustrativo {
  max-width: 34ch;
  text-align: right;
  color: var(--aviso);
  font-size: var(--t-5);
  line-height: 1.35;
}
.exportar {
  flex: none;
  font-size: var(--t-5);
  cursor: pointer;
}
.secao-tempo {
  margin-top: var(--esp-3);
}
.abas {
  margin-top: var(--esp-3);
  display: flex;
  flex-wrap: wrap;
  gap: var(--esp-1) var(--esp-6);
}
.abas button {
  font-size: var(--t-4);
  font-weight: 500;
  background: none;
  border: 0;
  padding: 0 0 8px;
  cursor: pointer;
  color: var(--texto-3);
  border-bottom: 3px solid transparent;
  transition: color var(--transicao), border-color var(--transicao);
}
.abas button:hover {
  color: var(--texto);
}
.abas button[aria-current='page'] {
  color: var(--texto);
  font-weight: 600;
  border-bottom-color: var(--texto);
}
main {
  padding-top: var(--esp-3);
}
footer {
  margin-top: var(--esp-8);
  padding-top: var(--esp-3);
  border-top: 1px solid var(--linha);
}
.erro {
  color: var(--falha);
}
@media (max-width: 900px) {
  .pagina {
    padding: var(--esp-4);
  }
  .topo {
    flex-direction: column;
  }
  .ilustrativo {
    display: block;
    margin-left: 0;
  }
}
</style>
