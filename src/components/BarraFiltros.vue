<script setup lang="ts">
import { computed, watch } from 'vue'
import { base, filtros, seriesFiltradas, nomePais, nomeGrupo, aba } from '../lib/estado'
import { config } from '../config'

const gruposComSeries = computed(() => {
  const ids = [...new Set(seriesFiltradas.value.map((s) => s.grupo))]
  return ids.map((g) => ({ id: g, nome: nomeGrupo(g), series: seriesFiltradas.value.filter((s) => s.grupo === g) }))
})

// Se grupo ou país esconderem o indicador escolhido, troca para o primeiro disponível.
watch(seriesFiltradas, (lista) => {
  if (lista.length && !lista.some((s) => s.id === filtros.serieId)) filtros.serieId = lista[0].id
})

/*
 * Cada aba mostra só os filtros que mudam o que ela exibe (RF08 continua atendido na aba Episódios,
 * que usa os cinco):
 *   episodios: grupo, país, indicador e janela
 *   paises:    grupo e janela (a aba sempre mostra os dois países)
 *   medidas:   grupo e país (as medidas usam a janela fixa de cálculo, não a do gráfico)
 *   metodo:    grupo e país (filtram a lista de séries)
 */
const indicadorAtivo = computed(() => aba.value === 'episodios')
const paisAtivo = computed(() => aba.value !== 'paises')
const janelaAtiva = computed(() => aba.value === 'episodios' || aba.value === 'paises')
</script>

<template>
  <form v-if="base" class="filtros" aria-label="Filtros" @submit.prevent>
    <label>
      Grupo
      <select v-model="filtros.grupo" class="controle">
        <option value="todos">Todos</option>
        <option v-for="g in base.grupos" :key="g.id" :value="g.id">{{ g.nome }}</option>
      </select>
    </label>

    <label v-if="paisAtivo">
      País
      <select v-model="filtros.pais" class="controle">
        <option value="todos">Todos</option>
        <option v-for="p in base.paises" :key="p.id" :value="p.id">{{ p.nome }}</option>
      </select>
    </label>

    <label v-if="indicadorAtivo">
      Indicador
      <select v-model="filtros.serieId" class="controle largo">
        <optgroup v-for="g in gruposComSeries" :key="g.id" :label="g.nome">
          <option v-for="s in g.series" :key="s.id" :value="s.id">{{ s.nome }} ({{ nomePais(s.pais) }})</option>
        </optgroup>
      </select>
    </label>


    <label v-if="janelaAtiva">
      Antes do pico
      <select v-model.number="filtros.antes" class="controle">
        <option v-for="n in config.janelas.antes" :key="n" :value="n">{{ n }} meses</option>
      </select>
    </label>
    <label v-if="janelaAtiva">
      Depois do pico
      <select v-model.number="filtros.depois" class="controle">
        <option v-for="n in config.janelas.depois" :key="n" :value="n">{{ n }} meses</option>
      </select>
    </label>
  </form>
</template>

<style scoped>
.filtros {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--esp-2) var(--esp-4);
  padding: var(--esp-4) 0 0;
}
label {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: var(--t-5);
  line-height: 1.2;
  color: var(--texto-2);
}
select {
  min-width: 120px;
  padding-right: 32px;
  appearance: none;
  cursor: pointer;
  /* seta desenhada com dois gradientes, na cor do texto */
  background-image: linear-gradient(45deg, transparent 50%, var(--texto-2) 50%),
    linear-gradient(135deg, var(--texto-2) 50%, transparent 50%);
  background-position: calc(100% - 17px) 14px, calc(100% - 12px) 14px;
  background-size: 5px 5px;
  background-repeat: no-repeat;
}
select.largo {
  min-width: 260px;
}
</style>
