<script setup lang="ts">
/**
 * Cartão de medida de impacto (RF06/RF10): uma medida, uma barra por episódio.
 * As barras partem do zero e usam a mesma escala dentro do cartão, então o comprimento
 * compara os episódios diretamente. Os valores vêm prontos da camada Gold; nada é recalculado aqui.
 */
import { computed, ref, useId } from 'vue'

export interface LinhaMedida {
  id: string
  rotulo: string
  cor: string
  /** valor numérico para o comprimento da barra; null = sem barra */
  valor: number | null
  /** texto exibido à direita (já formatado) */
  texto: string
  /** barra aberta: a série não voltou ao pico dentro da janela */
  aberta?: boolean
  apagado?: boolean
}

const props = defineProps<{
  titulo: string
  ajuda: string
  linhas: LinhaMedida[]
  foco?: string | null
  /** episódio fixado pelo clique (aparece como pressionado) */
  fixo?: string | null
  /** true quando a medida pode ser negativa (defasagem): o zero fica no meio */
  divergente?: boolean
}>()

const emit = defineEmits<{ (e: 'foco', id: string | null): void; (e: 'fixar', id: string): void }>()
const aberto = ref(false)
const idAjuda = useId()

const max = computed(() => Math.max(1, ...props.linhas.map((l) => Math.abs(l.valor ?? 0))))
function estilo(l: LinhaMedida) {
  if (l.valor == null) return { width: '0%' }
  const fracao = Math.abs(l.valor) / max.value
  if (!props.divergente) return { left: '0%', width: `${Math.max(fracao * 100, 1.5)}%` }
  const meia = fracao * 50
  return l.valor >= 0
    ? { left: '50%', width: `${Math.max(meia, 1.5)}%` }
    : { left: `${50 - meia}%`, width: `${Math.max(meia, 1.5)}%` }
}
</script>

<template>
  <section class="painel cartao">
    <div class="cab">
      <h3 class="rotulo-painel">{{ titulo }}</h3>
      <button
        type="button"
        class="ajuda"
        :aria-expanded="aberto"
        :aria-controls="idAjuda"
        :aria-label="aberto ? `Fechar explicação: ${titulo}` : `O que é: ${titulo}`"
        @click="aberto = !aberto"
        @keydown.esc="aberto = false"
      >
        <svg v-if="!aberto" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <circle cx="8" cy="8" r="6.6" fill="none" stroke="currentColor" stroke-width="1.3" />
          <path d="M6.3 6.3a1.75 1.75 0 1 1 2.55 1.55c-.55.3-.85.62-.85 1.2v.35" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
          <circle cx="8" cy="11.35" r=".8" fill="currentColor" />
        </svg>
        <svg v-else viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <path d="M4.5 4.5l7 7m0-7l-7 7" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
        </svg>
      </button>
    </div>
    <p v-show="aberto" :id="idAjuda" class="texto-ajuda">{{ ajuda }}</p>
    <ul v-show="!aberto">
      <li v-for="l in linhas" :key="l.id" :class="{ recua: foco && foco !== l.id, apagado: l.apagado, ativo: foco === l.id }">
        <!-- A linha inteira é um botão: passar o mouse destaca o episódio no gráfico; clicar fixa. -->
        <button
          type="button"
          class="linha-ep"
          :aria-pressed="fixo === l.id"
          :aria-label="`${l.rotulo}: ${l.texto}. ${fixo === l.id ? 'Destaque fixado; clique para soltar' : 'Clique para fixar o destaque'}`"
          @pointerenter="emit('foco', l.id)"
          @pointerleave="emit('foco', null)"
          @focus="emit('foco', l.id)"
          @blur="emit('foco', null)"
          @click="emit('fixar', l.id)"
        >
          <span class="ep">{{ l.rotulo }}</span>
          <span class="trilho" :class="{ divergente }" aria-hidden="true">
            <span
              v-if="l.valor != null"
              :key="`${l.valor}-${l.aberta}`"
              class="barra"
              :class="{ aberta: l.aberta, negativa: divergente && l.valor < 0 }"
              :style="{ ...estilo(l), '--cor': l.cor }"
            />
          </span>
          <span :key="l.texto" class="valor num">{{ l.texto }}</span>
        </button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.cartao {
  border-top: 0;
  padding: var(--esp-3) 0;
}
.cartao + .cartao {
  border-top: 1px solid var(--linha);
}
.cartao {
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.cab {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--esp-2);
  margin-bottom: 2px;
}
.ajuda {
  display: inline-grid;
  place-items: center;
  width: 24px;
  height: 24px;
  margin: -4px -6px -4px 0;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: none;
  color: var(--texto-2);
  cursor: pointer;
  transition: color var(--transicao), background-color var(--transicao);
}
.ajuda:hover {
  color: var(--texto);
  background: var(--fundo-2);
}
.texto-ajuda {
  font-size: var(--t-5);
  line-height: 1.45;
  color: var(--texto-2);
}
ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 2px;
}
li {
  margin: 0 -6px;
}
.linha-ep {
  width: 100%;
  padding: 0 6px;
  border: 0;
  border-radius: 2px;
  background: none;
  text-align: left;
  cursor: pointer;
  display: grid;
  grid-template-columns: 54px minmax(0, 1fr) auto;
  align-items: center;
  column-gap: var(--esp-2);
  font-size: var(--t-5);
  line-height: 1.3;
  transition: opacity var(--transicao);
}
/* Fundo só sob o ponteiro ou o foco de teclado; o destaque ligado ao gráfico vem do recuo dos outros. */
.linha-ep:hover,
.linha-ep:focus-visible {
  background: color-mix(in srgb, var(--texto) 6%, transparent);
}
.linha-ep[aria-pressed='true'] .ep {
  color: var(--texto);
  font-weight: 600;
}
/* As barras crescem a partir do zero quando o cartão aparece ou o valor muda. */
.barra {
  transform-origin: left center;
  animation: cresce 700ms cubic-bezier(0.16, 1, 0.3, 1) 120ms both;
}
.barra.negativa {
  transform-origin: right center;
}
.valor {
  animation: surge 320ms ease-out 380ms both;
}
@keyframes cresce {
  from {
    transform: scaleX(0);
  }
}
@keyframes surge {
  from {
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .barra {
    animation: none;
  }
  .valor {
    animation-duration: 120ms;
    animation-delay: 0ms;
  }
}
/* Fora de foco: recua só a barra; o texto mantém contraste de leitura (RNF09). */
li.recua .barra {
  opacity: 0.45;
}
li.recua .valor {
  color: var(--texto-2);
}
.ep {
  color: var(--texto-2);
  white-space: nowrap;
}
.trilho {
  position: relative;
  height: 10px;
}
.trilho.divergente::before {
  content: '';
  position: absolute;
  left: 50%;
  top: -3px;
  bottom: -3px;
  border-left: 1px solid var(--referencia);
}
.barra {
  position: absolute;
  top: 0;
  bottom: 0;
  background: var(--cor);
  border-radius: 1px;
}
/* Não voltou ao pico na janela: barra vazada, para não se confundir com um valor medido. */
.barra.aberta {
  background: transparent;
  border: 1.5px dashed var(--cor);
}
/* O número é o protagonista do cartão: serifa de título, no tamanho dos anos da linha do tempo. */
.valor {
  min-width: 84px;
  text-align: right;
  font-family: var(--fonte-titulo);
  font-size: var(--t-num);
  line-height: 1.15;
  color: var(--texto);
  white-space: nowrap;
}
li.apagado .valor {
  font-family: var(--fonte);
  font-size: var(--t-5);
  color: var(--texto-3);
}
</style>
