# Painel comparativo: recessões dos EUA e o Brasil

Front-end do TCC em **Vue 3 + TypeScript + Vite**. Os gráficos do painel são desenhados em SVG, com as escalas e as formas calculadas pelos módulos do **D3** (`d3-scale`, `d3-shape`, `d3-array`). A abertura narrativa usa também o `d3-geo` (projeção do globo) e Canvas.
O painel é estático: ele só lê os JSONs exportados da camada Gold e não precisa de servidor. Todas as dependências têm licença livre (ver `CREDITOS.md`).

> **Atenção:** os arquivos em `public/data/` são **ilustrativos**. Eles foram gerados por `scripts/gerar_dados_exemplo.py` para o front poder avançar antes do ETL. Quando o ETL estiver pronto, ele grava os mesmos arquivos e o selo "Dados ilustrativos" some (`edicao.json` → `"ilustrativo": false`).

## Testar sem instalar nada

Baixe `apresentacao/painel-recessoes.html` (botão **Download raw file** na página do arquivo) e dê dois cliques. Abre no Chrome, Edge ou Firefox, sem internet. Melhor no computador.

## Rodar

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # vue-tsc (checa o contrato) + build em dist/
npm run dados:exemplo  # regera os dados ilustrativos
```

## Abertura narrativa

Antes do painel há uma abertura em rolagem, em dois atos, que apresenta a pergunta do TCC com a produção industrial:

1. **Globo:** a Terra à noite, centrada nas Américas. A cada recessão, EUA e Brasil pulsam conforme a série se afasta do nível do pico; um arco liga os dois países com a defasagem de `fato_comparacao`; embaixo, as duas séries são desenhadas mês a mês.
2. **Os pontos viram gráficos:** cada ponto é um mês de uma série. Os mesmos pontos se reorganizam em cinco gráficos: calendário com as recessões do NBER, episódios alinhados ao pico (mesma escala), maior distância do pico, meses até voltar ao nível do pico e mês da primeira reação. Cada gráfico tem título, legenda, unidade e fonte (RNF09).

Regras que a abertura segue:

- **Nada é escrito à mão:** curvas, medidas e frases vêm do contrato (`fato_valor_alinhado`, `fato_resumo_episodio`, `fato_comparacao`). Os textos ficam em `config/painel.json`, no bloco `narrativa`. Um episódio novo entra sozinho (RNF04).
- **Leitura descritiva:** os textos falam de intensidade, tempo e ordem, nunca de causa (regra 1.4); o último gráfico lembra que a ordem no tempo não prova causa.
- **Atalho "Ir direto ao painel"** sempre visível durante a abertura, e `narrativa.ativa: false` desliga a abertura inteira.
- **Movimento reduzido:** com a opção do sistema ativada, a rolagem não é suavizada e pulsos e deriva dos pontos param; os números e gráficos são os mesmos.
- **Acessibilidade:** os canvas são decorativos para o leitor de tela; o conteúdo vai em texto (títulos e frases de cada cena) e numa tabela com as medidas.
- **Sem biblioteca de animação:** a rolagem é lida pela própria página (`src/narrativa/rolagem.ts`). O GSAP foi descartado porque usa uma licença proprietária ("Standard No Charge"), o que contrariaria a seção 6.1 do TCC.
- **Por que Canvas na abertura:** são cerca de 2.300 pontos que se movem a cada quadro; em SVG seriam 2.300 elementos do DOM atualizados 60 vezes por segundo. O painel continua em SVG.

## O que cada aba atende

| Aba | Requisitos |
| --- | --- |
| Filtros (grupo, país, indicador, episódios, janela) | RF08 |
| **Episódios**: um indicador nos episódios alinhados ao pico, com título que diz a conclusão e tabela de medidas | RF07, RF09, RF10, RF12 |
| **EUA × Brasil**: pares de séries equivalentes, com a primeira reação marcada e a defasagem | RF06, RF07 |
| **Medidas**: tabela indicador × episódio e tabela de defasagens | RF10, RF12 |
| **Fontes e método**: séries, mudanças de metodologia, episódios, glossário e histórico de atualizações | RF11, RF13, RNF08, RNF14 |
| Botão **Baixar dados (CSV)** | RF15 |

## O que não fica fixo no código

- **Textos, opções e cores:** ficam em `src/config/painel.json`. Lá estão o título, os modelos das frases, as janelas de meses, o indicador inicial, as abas, o glossário e as posições de cor de episódios e países.
- **Títulos dos gráficos:** são montados a partir de `fato_resumo_episodio` e `fato_comparacao`. Exemplo: "queda mais forte em 2020, de −19,9%".
- **Episódios e países:** vêm de `dim_episodio.json` e `dim_pais.json`. Cada episódio recebe a cor pela posição na lista, então um episódio novo entra sem mudar código (RNF04).
- **Rodapé:** a lista de fontes é gerada a partir das séries carregadas.

Continuam nos componentes só os rótulos fixos da interface, como os cabeçalhos das tabelas.

## Decisões de visual (e de onde vieram)

- **Linha do tempo das recessões no topo.** É o elemento de destaque da página e também o seletor de episódios. Mostra as faixas do NBER como o FRED sombreia recessões nos gráficos dele. As recessões fora da análise aparecem em cinza, só como contexto, e vêm de `cronologia_nber.json`.
- **Três camadas de cor**: papel branco (página e superfícies dos gráficos #FFFFFF, separadas por um fio), tinta #1C1E21 e cor só nos dados (episódios em petróleo, bordô e ocre; Brasil em tinta, EUA em cinza). A tipografia está descrita abaixo.

- **Cada visual fica numa superfície mais clara que a página**, com um fio fino e sem sombra, para que o olho vá primeiro aos gráficos. Dentro dela só há linhas de grade horizontais; a referência (100 ou 0) é mais forte, o pico aparece tracejado e a recessão dos EUA (pico ao vale do NBER) é sombreada.
- **Título que diz a conclusão**, e não só o assunto, como recomendam o Datawrapper e o guia de visualização da UE.
- **Legenda acima do gráfico** e rótulos diretos no fim de cada linha.
- **Cartões de medida com barras, não com números grandes.** Cada uma das quatro medidas do RF06 tem um cartão ao lado do gráfico, com uma barra por episódio na mesma escala; as tabelas completas ficam recolhidas abaixo e na aba Medidas. Não há caixa alta nos rótulos, faixa colorida nos cartões nem selos.
- **Tipografia editorial com duas famílias de licença OFL**, instaladas pelo npm (funcionam sem internet): Libre Caslon Display (peso único 400) no título do painel, nas conclusões dos gráficos, nos títulos de seção, nos anos dos episódios e nos números das medidas, sempre a partir de 19 px; Libre Franklin (400, 500 e 600) em todo o resto. Escala fixa: 30 / 21 / 17 / 14 / 12,5 px. O tema escuro segue a configuração do sistema.
- **Vue desenha o SVG e o D3 só faz as contas** (escalas e linhas), como recomendam as respostas sobre Vue + D3 no Stack Overflow e no dev.to.

## Acabamento editorial

- **Ritmo vertical em dois registros:** 4–12px dentro de um bloco (título, subtítulo, legenda e gráfico) e 48–64px só entre seções reais (cabeçalho, linha do tempo, controles e conteúdo). Os tokens `--esp-*` ficam em `tokens.css`.
- **Uma margem esquerda para tudo:** título, eixo da linha do tempo, filtros, números do eixo y e tabelas começam no mesmo ponto.
- **Papel branco com tinta #1C1E21** e capa em papel quente (#F3F0EA). Os campos de formulário ficam num tom mais claro, para parecerem clicáveis.
- **Hierarquia nas séries:** o episódio citado no título fica em foco, com traço de 2,5px e cor plena; os outros recuam para 1,5px e 45% de opacidade. Passar o mouse na legenda ou num rótulo troca o foco. Na aba EUA × Brasil, o Brasil é a série em foco.
- **Grade quase invisível:** só a linha de referência (100 ou 0) e o pico tracejado ganham contraste.
- **Rótulos diretos:** quando duas linhas terminam perto, os rótulos são afastados sem sair da área do gráfico.
- **Tabelas:** fio de tinta sob o cabeçalho, células com mais respiro e números em Libre Franklin com algarismos de largura fixa.
- **Filtros:** todos os campos com 36px de altura e o mesmo fio. O hover e o foco usam transições secas de 120ms, sem sombras.

## Estrutura

```
src/
  config/painel.json   textos, opções, cores e glossário
  config/index.ts      tipos da configuração + preenchimento dos modelos de texto
  lib/contrato.ts      tipos dos JSONs + carregamento (o "contrato" com o ETL)
  lib/estado.ts        filtros globais, cores por posição, dados derivados
  lib/manchetes.ts     títulos gerados a partir das medidas
  lib/formatos.ts      formatação pt-BR
  lib/csv.ts           exportação CSV (RFC 4180, UTF-8 com BOM)
  components/          GraficoLinhas, BarraFiltros, VisaoEpisodios, VisaoPaises, QuadroResumo, VisaoMetodo
  narrativa/           abertura em rolagem: AberturaNarrativa, AtoGlobo, AtoPontos,
                       dados.ts (monta os dados a partir do contrato), rolagem.ts (progresso da rolagem)
  styles/tokens.css    cores (papel, tinta e dados; contraste dos dados ≥ 3:1) e tamanhos de texto
public/data/           JSONs da camada Gold (ver CONTRATO.md)
scripts/               gerador de dados ilustrativos
```

## Deploy

`npm run build` gera `dist/` com caminhos relativos. Funciona na Vercel (framework "Vite"), no GitHub Pages ou em qualquer servidor estático.
`npm run build:unico` gera `dist-unico/index.html`, um arquivo só com código, fontes, mapa e dados embutidos, que abre sem internet (bom para a apresentação à banca).
