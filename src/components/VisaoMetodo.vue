<script setup lang="ts">
import { computed } from 'vue'
import { base, seriesFiltradas, nomePais, rotuloEpisodio, corEpisodio } from '../lib/estado'
import { mesAno, dataHora, numero } from '../lib/formatos'
import { config, texto } from '../config'

const mudancas = computed(() =>
  seriesFiltradas.value.flatMap((s) => s.mudancas_metodologia.map((m) => ({ s, m }))),
)
const execucoes = computed(() => [...(base.value?.execucoes ?? [])].reverse())
const ultima = computed(() => execucoes.value[0])
</script>

<template>
  <section v-if="base" class="visao">
    <p class="secundario intro">{{ texto('intro_metodo') }}</p>

    <h2>Séries utilizadas</h2>
    <div class="rolagem-x">
      <table class="tabela">
        <thead>
          <tr>
            <th>Indicador</th>
            <th>País</th>
            <th>Fonte</th>
            <th>Código</th>
            <th>Unidade original</th>
            <th>No painel</th>
            <th>Periodicidade</th>
            <th>Período</th>
            <th>Sem dados em</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in seriesFiltradas" :key="s.id">
            <td :title="s.descricao">{{ s.nome }}</td>
            <td>{{ nomePais(s.pais) }}</td>
            <td><a :href="s.fonte.url" target="_blank" rel="noopener">{{ s.fonte.portal }}</a> <span class="secundario">({{ s.fonte.produtor }})</span></td>
            <td class="codigo">{{ s.codigo }}</td>
            <td>{{ s.unidade_original }}</td>
            <td>{{ s.unidade_painel }}</td>
            <td>{{ s.frequencia }}{{ s.ajuste_sazonal ? ', dessazonalizada' : '' }}</td>
            <td class="nw">{{ mesAno(s.periodo_inicio) }} a {{ mesAno(s.periodo_fim) }}</td>
            <td :class="{ vazio: !s.episodios_sem_dados.length }">
              {{ s.episodios_sem_dados.length ? s.episodios_sem_dados.map(rotuloEpisodio).join(', ') : '—' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="colunas">
      <div>
        <h2>Mudanças de metodologia</h2>
        <ul class="lista">
          <li v-for="{ s, m } in mudancas" :key="s.id + m.data">
            <strong>{{ s.nome }} ({{ nomePais(s.pais) }}), {{ mesAno(m.data) }}.</strong> {{ m.descricao }}
          </li>
        </ul>

        <h2>Episódios</h2>
        <table class="tabela">
          <thead><tr><th>Episódio</th><th>Pico</th><th>Vale</th><th>Contexto</th></tr></thead>
          <tbody>
            <tr v-for="e in base.episodios" :key="e.id">
              <td class="nw"><span class="chave" :style="{ color: corEpisodio(e.id) }" />{{ e.rotulo }}</td>
              <td class="nw">{{ mesAno(e.pico) }}</td>
              <td class="nw">{{ mesAno(e.vale) }}</td>
              <td class="secundario">{{ e.contexto }}</td>
            </tr>
          </tbody>
        </table>
        <p class="nota">Datas do Business Cycle Dating Committee do NBER, cadastradas manualmente (RF05).</p>
      </div>

      <div>
        <h2>Glossário</h2>
        <dl>
          <template v-for="[termo, def] in config.glossario" :key="termo">
            <dt>{{ termo }}</dt>
            <dd>{{ def }}</dd>
          </template>
        </dl>
      </div>
    </div>

    <h2>Atualizações dos dados</h2>
    <p v-if="ultima" class="secundario">
      Última execução em {{ dataHora(ultima.inicio) }}, {{ ultima.status === 'sucesso' ? 'concluída' : 'com falha' }}.
      A edição publicada é {{ base.edicao.id_edicao }}, com {{ numero(base.valores.length, 0) }} registros.
      Atualização e reprocessamento são feitos pelo responsável no Airflow; esta lista é só para consulta.
    </p>
    <table class="tabela execucoes">
      <thead>
        <tr>
          <th>Início</th>
          <th>Tipo</th>
          <th>Situação</th>
          <th class="n">Séries</th>
          <th class="n">Registros</th>
          <th class="n">Duração</th>
          <th>Edição</th>
          <th>Observação</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="x in execucoes" :key="x.id_execucao">
          <td class="nw">{{ dataHora(x.inicio) }}</td>
          <td>{{ x.tipo === 'atualizacao' ? 'Atualização' : 'Reprocessamento' }}</td>
          <td :class="x.status">{{ x.status === 'sucesso' ? 'Concluída' : 'Falhou' }}</td>
          <td class="n">{{ x.series_processadas }}</td>
          <td class="n">{{ numero(x.registros, 0) }}</td>
          <td class="n">{{ x.duracao_min }} min</td>
          <td class="codigo">{{ x.id_edicao }}</td>
          <td class="secundario">{{ x.observacao || '—' }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped>
.intro {
  max-width: 56ch;
}
/* Cada assunto é uma seção: 48px antes do título, 12px entre título e conteúdo. */
h2 {
  margin: var(--esp-8) 0 var(--esp-2);
}
.intro + h2 {
  margin-top: var(--esp-4);
}
.rolagem-x {
  overflow-x: auto;
}
.codigo {
  font-size: var(--t-5);
  color: var(--texto-2);
}
.nw {
  white-space: nowrap;
}
.colunas {
  display: grid;
  grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
  gap: var(--esp-12);
}
.lista {
  margin: 0;
  padding-left: 18px;
  max-width: 56ch;
}
.lista li + li {
  margin-top: var(--esp-2);
}
dl {
  margin: 0;
}
dt {
  font-weight: 600;
  margin-top: var(--esp-4);
}
dt:first-child {
  margin-top: 0;
}
dd {
  margin: 2px 0 0;
  color: var(--texto-2);
}
.sucesso {
  color: var(--ok);
}
.falha {
  color: var(--falha);
  font-weight: 600;
}
.execucoes .secundario {
  max-width: 340px;
}
@media (max-width: 1000px) {
  .colunas {
    grid-template-columns: 1fr;
    gap: 0;
  }
}
</style>
