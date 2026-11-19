# Contrato de dados: ETL (camada Gold) → painel

O ETL deve gravar estes arquivos em `public/data/`. Os tipos ficam em `src/lib/contrato.ts`: se um campo mudar, `npm run build` acusa o erro. Datas usam `AAAA-MM` para meses e ISO 8601 para data e hora. Valores ausentes são `null` e nunca são omitidos.

| Arquivo | Origem na Gold | Grão |
| --- | --- | --- |
| `edicao.json` | edição analítica publicada | 1 objeto |
| `dim_episodio.json` | dim_episodio | 1 por episódio |
| `dim_grupo.json` | grupos de indicadores | 1 por grupo |
| `dim_pais.json` | dim_pais | 1 por país |
| `cronologia_nber.json` | cronologia completa do NBER (opcional, só para a linha do tempo) | 1 por recessão |
| `dim_serie.json` | dim_serie + dim_fonte + dim_metodo + dim_pais | 1 por série |
| `fato_valor_alinhado.json` | fato_valor_mensal alinhada ao pico de cada episódio | série × episódio × mês relativo |
| `fato_resumo_episodio.json` | fato_resumo_episodio | série × episódio |
| `fato_comparacao.json` | fato_comparacao | episódio × par EUA/Brasil |
| `execucoes.json` | log de execuções do Airflow | 1 por execução |

## Campos principais

**dim_serie**
- `metodo.tipo`: `"indice"` (pico = 100) ou `"pp"` (diferença em pontos percentuais desde o pico).
- `sentido_crise`: `"queda"` (ex.: produção), `"alta"` (ex.: desemprego, câmbio) ou `"neutro"` (juros, inflação). Define o que conta como ponto extremo e como recuperação.
- `limiar_reacao`: desvio mínimo, em % ou p.p., que define a "primeira reação".
- `id_serie_par`: id da série equivalente no outro país, ou `null`.
- `episodios_sem_dados`: ids dos episódios sem cobertura. É o que aciona os avisos do RF12.
- `mudancas_metodologia`: `[{ data, descricao }]`.

**fato_valor_alinhado**
- `mes_relativo`: inteiro, 0 = mês de pico do NBER.
- `valor_original`: valor na unidade da fonte, já deflacionado quando for o caso.
- `valor_painel`: valor normalizado conforme `metodo.tipo`.
- `data_coleta`, `id_edicao`: rastreabilidade (RNF01).

**fato_resumo_episodio**
- `variacao_pico_vale`: % (índice) ou p.p.
- `meses_ate_vale`: mês relativo do ponto extremo.
- `meses_ate_recuperacao`: mês relativo em que a série volta ao nível do pico, ou `null`.
- `situacao_recuperacao`: `recuperado` | `nao_recuperado` | `nao_se_aplica` | `sem_dados`.
- `mes_reacao`: primeiro mês com |desvio| ≥ limiar, na direção de `sentido_crise`.

**fato_comparacao**
- `defasagem_meses` = `mes_reacao` (Brasil) − `mes_reacao` (EUA). Valor positivo: o Brasil reagiu depois.
- `diferenca_variacao` = variação do Brasil − variação dos EUA.

As medidas são calculadas nos `janela_medidas_meses` meses após o pico (48 nos dados de exemplo). O painel só as exibe e não recalcula nada, para que todos os painéis usem os mesmos números.

## Regras usadas no gerador de exemplo

O gerador calcula as medidas a partir das próprias curvas com as regras acima. Ele pode servir de referência para as funções do ETL e para os testes com pytest. Os **códigos de série** são indicativos e precisam ser conferidos no inventário das séries.
