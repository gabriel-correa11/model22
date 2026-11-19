<script setup lang="ts">
/**
 * Abertura narrativa do painel: dois atos em rolagem (globo e pontos que viram gráficos)
 * e uma passagem para o painel. Pode ser desligada em config/painel.json (narrativa.ativa).
 * Quem só quer consultar os dados usa o atalho "Ir direto ao painel", sempre visível no topo.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { base } from '../lib/estado'
import { config, textoNarrativa } from '../config'
import { montarNarrativa } from './dados'
import AtoGlobo from './AtoGlobo.vue'
import AtoPontos from './AtoPontos.vue'

const n = computed(() => (base.value ? montarNarrativa(base.value, config.narrativa.serie, config.narrativa.antes, config.narrativa.depois) : null))

/** O atalho some quando o painel chega ao topo da tela. */
const dentro = ref(true)
function confere() {
  const painel = document.getElementById('painel')
  dentro.value = !painel || painel.getBoundingClientRect().top > 80
}
onMounted(() => {
  addEventListener('scroll', confere, { passive: true })
  confere()
})
onBeforeUnmount(() => removeEventListener('scroll', confere))

function irAoPainel() {
  const alvo = document.getElementById('painel')
  alvo?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  alvo?.focus({ preventScroll: true })
}
</script>

<template>
  <div v-if="n && n.episodios.length" class="abertura">
    <a href="#painel" class="pular" :class="{ oculto: !dentro }" @click.prevent="irAoPainel">{{ textoNarrativa('pular') }} ↓</a>
    <AtoGlobo :n="n" />
    <AtoPontos :n="n" />
    <section class="passagem" aria-labelledby="passagem-titulo">
      <div>
        <h2 id="passagem-titulo">{{ textoNarrativa('fim_titulo') }}</h2>
        <p>{{ textoNarrativa('fim_texto') }}</p>
        <button type="button" class="controle" @click="irAoPainel">{{ textoNarrativa('fim_botao') }}</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.pular {
  position: fixed;
  top: 14px;
  right: 18px;
  z-index: 20;
  font-size: var(--t-5);
  font-weight: 500;
  text-decoration: none;
  padding: 8px 12px;
  border-radius: 2px;
  color: #e9eef2;
  background: rgba(20, 26, 33, 0.72);
  backdrop-filter: blur(6px);
  border: 1px solid rgba(233, 238, 242, 0.25);
  transition: opacity 0.3s;
}
.pular:hover {
  border-color: #e9eef2;
}
.pular.oculto {
  opacity: 0;
  pointer-events: none;
}
.passagem {
  min-height: 70vh;
  display: grid;
  align-items: center;
  padding: 10vh 6vw;
  background: var(--fundo);
}
.passagem > div {
  max-width: 40rem;
  border-top: 2px solid var(--texto);
  padding-top: var(--esp-3);
}
.passagem h2 {
  font-size: var(--t-1);
  margin-bottom: var(--esp-2);
}
.passagem p {
  color: var(--texto-2);
  font-size: var(--t-texto);
  margin-bottom: var(--esp-4);
}
.passagem .controle {
  cursor: pointer;
}
</style>
