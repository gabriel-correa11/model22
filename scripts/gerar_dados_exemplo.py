"""
Gera dados ILUSTRATIVOS no mesmo formato que o ETL vai exportar da camada Gold.

Serve para o front-end ser desenvolvido antes do ETL ficar pronto. As curvas
imitam o formato aproximado de cada episódio, mas os números NÃO são reais.
Quando o ETL estiver pronto, ele grava os mesmos arquivos em public/data/ e
este script deixa de ser usado.

Uso: python3 scripts/gerar_dados_exemplo.py
"""
from __future__ import annotations

import json
import random
from datetime import date, datetime, timedelta
from pathlib import Path

import numpy as np

SAIDA = Path(__file__).resolve().parent.parent / "public" / "data"
ID_EDICAO = "2026.11-ilustrativa"
DATA_COLETA = "2026-11-10"
JANELA = (-24, 48)  # meses antes e depois do pico exportados
JANELA_MEDIDAS = 48  # meses após o pico considerados nas medidas

EPISODIOS = [
    {"id": "1981", "nome": "Recessão de 1981–1982", "rotulo": "1981–82",
     "pico": "1981-07", "vale": "1982-11",
     "contexto": "Política monetária fortemente contracionista do Fed para conter a inflação; no Brasil, coincide com a crise da dívida externa."},
    {"id": "2008", "nome": "Grande Recessão (2007–2009)", "rotulo": "2007–09",
     "pico": "2007-12", "vale": "2009-06",
     "contexto": "Crise do crédito imobiliário e do sistema financeiro norte-americano, transmitida ao Brasil pelo crédito externo, câmbio e comércio."},
    {"id": "2020", "nome": "Recessão da Covid-19 (2020)", "rotulo": "2020",
     "pico": "2020-02", "vale": "2020-04",
     "contexto": "Choque sanitário com paralisação simultânea das atividades; a recessão mais curta da cronologia do NBER."},
]

FONTES = {
    "FRED": {"portal": "FRED", "produtor": "Federal Reserve Bank of St. Louis", "url": "https://fred.stlouisfed.org"},
    "IPEADATA": {"portal": "Ipeadata", "produtor": "Ipea", "url": "http://www.ipeadata.gov.br"},
    "SGS": {"portal": "SGS", "produtor": "Banco Central do Brasil", "url": "https://www3.bcb.gov.br/sgspub"},
    "COMEX": {"portal": "Comex Stat", "produtor": "MDIC", "url": "https://comexstat.mdic.gov.br"},
}

# Cada série: metadados + caminho (mês relativo, desvio) por episódio.
# metodo "indice": pico = 100; desvio em %.  metodo "pp": desvio em pontos percentuais.
# Episódio ausente em "caminhos" = sem dados para aquele episódio (RF12).
SERIES = [
    dict(id="us_prod_ind", codigo="INDPRO", nome="Produção industrial", pais="US", grupo="atividade",
         fonte="FRED", unidade_original="Índice 2017 = 100", frequencia="mensal", ajuste_sazonal=True,
         metodo="indice", sentido="queda", limiar=2.0, par="br_prod_ind", periodo_inicio="1919-01",
         base={"1981": 52.1, "2008": 102.7, "2020": 103.9},
         descricao="Volume da produção da indústria, mineração e serviços de utilidade pública dos EUA.",
         mudancas=[],
         caminhos={
             "1981": [(-24, -4), (-12, -1.5), (0, 0), (6, -3), (12, -7.5), (16, -8.6), (22, -4), (28, 0.5), (48, 9)],
             "2008": [(-24, -3), (-12, -1), (0, 0), (6, -2), (10, -5), (15, -14), (18, -17), (24, -11), (36, -6), (48, -3)],
             "2020": [(-24, -1), (-12, 0.8), (0, 0), (1, -4.5), (2, -16), (4, -8), (8, -4.5), (14, -2), (24, -0.8), (30, 0.6), (48, 0.2)],
         }),
    dict(id="br_prod_ind", codigo="PIM-PF (Ipeadata)", nome="Produção industrial", pais="BR", grupo="atividade",
         fonte="IPEADATA", unidade_original="Índice 2022 = 100", frequencia="mensal", ajuste_sazonal=True,
         metodo="indice", sentido="queda", limiar=2.0, par="us_prod_ind", periodo_inicio="1975-01",
         base={"1981": 61.0, "2008": 98.5, "2020": 95.2},
         descricao="Produção física da indústria geral brasileira (Pesquisa Industrial Mensal, IBGE).",
         mudancas=[{"data": "2002-01", "descricao": "Nova amostra e ponderação da PIM-PF; série anterior encadeada pelo Ipea."},
                   {"data": "2023-07", "descricao": "Reformulação com base 2022 = 100."}],
         caminhos={
             "1981": [(-24, -6), (-12, -2), (0, 0), (3, -1), (6, -6), (11, -12), (15, -15), (20, -11), (30, -6), (40, 0.5), (48, 3)],
             "2008": [(-24, -8), (-12, -3), (0, 0), (6, 2), (9, 1), (11, -10), (12, -20), (15, -14), (20, -4), (23, 0.5), (36, 2), (48, -1)],
             "2020": [(-24, 1), (-12, -0.5), (0, 0), (1, -6), (2, -27), (3, -18), (5, -4), (6, 0.8), (12, 2), (24, -1.5), (48, 0.5)],
         }),
    dict(id="us_desemprego", codigo="UNRATE", nome="Taxa de desemprego", pais="US", grupo="trabalho",
         fonte="FRED", unidade_original="% da força de trabalho", frequencia="mensal", ajuste_sazonal=True,
         metodo="pp", sentido="alta", limiar=0.5, par="br_desemprego", periodo_inicio="1948-01",
         base={"1981": 7.2, "2008": 5.0, "2020": 3.5},
         descricao="Pessoas desocupadas em relação à força de trabalho, pesquisa domiciliar (CPS).",
         mudancas=[],
         caminhos={
             "1981": [(-24, -1.2), (-12, -0.3), (0, 0), (6, 1.4), (12, 2.9), (17, 3.6), (24, 1.8), (36, 0.1), (48, -0.2)],
             "2008": [(-24, -0.6), (-12, -0.3), (0, 0), (6, 0.5), (11, 2.2), (18, 4.6), (22, 5.0), (30, 4.1), (40, 3.2), (48, 2.4)],
             "2020": [(-24, 0.6), (-12, 0.2), (0, 0), (1, 0.9), (2, 11.2), (4, 6.7), (10, 2.7), (18, 1.4), (25, 0.0), (48, 0.5)],
         }),
    dict(id="br_desemprego", codigo="PNADC – 24369 (SGS)", nome="Taxa de desocupação", pais="BR", grupo="trabalho",
         fonte="SGS", unidade_original="% da força de trabalho", frequencia="mensal (trimestre móvel)", ajuste_sazonal=False,
         metodo="pp", sentido="alta", limiar=0.5, par="us_desemprego", periodo_inicio="2012-03",
         base={"2020": 11.6},
         descricao="Taxa de desocupação da PNAD Contínua (IBGE), divulgada em trimestres móveis.",
         mudancas=[{"data": "2012-03", "descricao": "Início da PNAD Contínua. A PME (2002–2016) cobria só seis regiões metropolitanas e não é comparável; por isso não há dados para 1981–82 e 2007–09."}],
         caminhos={
             "2020": [(-24, 1.2), (-12, 0.5), (0, 0), (2, 0.6), (5, 2.2), (8, 2.9), (12, 3.3), (16, 2.6), (22, 0.4), (26, -0.6), (36, -3.4), (48, -4.0)],
         }),
    dict(id="us_juros", codigo="FEDFUNDS", nome="Taxa básica de juros (Fed Funds)", pais="US", grupo="juros",
         fonte="FRED", unidade_original="% ao ano", frequencia="mensal", ajuste_sazonal=False,
         metodo="pp", sentido="neutro", limiar=0.5, par="br_juros", periodo_inicio="1954-07",
         base={"1981": 19.1, "2008": 4.24, "2020": 1.58},
         descricao="Taxa efetiva dos fundos federais, referência da política monetária dos EUA.",
         mudancas=[],
         caminhos={
             "1981": [(-24, -9), (-12, -6), (-6, -1), (0, 0), (3, -3.5), (6, -6), (10, -4.5), (16, -9.8), (24, -9.6), (36, -7.6), (48, -11)],
             "2008": [(-24, -2.2), (-12, 1.0), (0, 0), (3, -1.8), (6, -2.2), (11, -4.0), (14, -4.1), (48, -4.1)],
             "2020": [(-24, -0.3), (-12, 0.8), (0, 0), (1, -0.9), (2, -1.53), (24, -1.5), (27, -1.25), (30, 0.7), (36, 3.0), (42, 3.75), (48, 3.75)],
         }),
    dict(id="br_juros", codigo="4189 (SGS)", nome="Taxa Selic", pais="BR", grupo="juros",
         fonte="SGS", unidade_original="% ao ano", frequencia="mensal", ajuste_sazonal=False,
         metodo="pp", sentido="neutro", limiar=0.5, par="us_juros", periodo_inicio="1986-07",
         base={"2008": 11.18, "2020": 4.15},
         descricao="Taxa Selic acumulada no mês, anualizada (base 252 dias úteis).",
         mudancas=[{"data": "1986-07", "descricao": "Início da série. Para 1981–82 não há taxa Selic comparável."}],
         caminhos={
             "2008": [(-24, 4.5), (-12, 2), (0, 0), (5, 1.0), (9, 2.4), (13, 1.5), (16, -1.2), (19, -2.5), (30, -0.4), (40, 1.0), (48, -0.2)],
             "2020": [(-24, 2.3), (-12, 2.2), (0, 0), (3, -0.8), (6, -2.1), (12, -2.1), (14, -1.4), (18, 0.6), (22, 3.0), (28, 7.6), (34, 9.5), (48, 9.5)],
         }),
    dict(id="us_inflacao", codigo="CPIAUCSL (var. 12 meses)", nome="Inflação ao consumidor (CPI)", pais="US", grupo="precos",
         fonte="FRED", unidade_original="% em 12 meses", frequencia="mensal", ajuste_sazonal=True,
         metodo="pp", sentido="neutro", limiar=0.5, par="br_inflacao", periodo_inicio="1947-01",
         base={"1981": 10.8, "2008": 4.1, "2020": 2.3},
         descricao="Variação em 12 meses do índice de preços ao consumidor urbano dos EUA.",
         mudancas=[{"data": "1983-01", "descricao": "Mudança no tratamento do custo de moradia (equivalente de aluguel)."}],
         caminhos={
             "1981": [(-24, 2.0), (-12, 3.5), (0, 0), (6, -2.4), (12, -4.0), (16, -6.2), (22, -8.2), (30, -6.5), (48, -7.0)],
             "2008": [(-24, -0.8), (-12, -1.5), (0, 0), (7, 1.5), (12, -4.0), (19, -6.1), (24, -1.4), (36, -2.5), (48, -2.4)],
             "2020": [(-24, -0.4), (-12, -0.4), (0, 0), (3, -2.1), (12, 0.3), (16, 3.1), (22, 4.5), (28, 6.8), (40, 1.0), (48, 0.6)],
         }),
    dict(id="br_inflacao", codigo="433 (SGS, acum. 12 meses)", nome="Inflação ao consumidor (IPCA)", pais="BR", grupo="precos",
         fonte="SGS", unidade_original="% em 12 meses", frequencia="mensal", ajuste_sazonal=False,
         metodo="pp", sentido="neutro", limiar=0.5, par="us_inflacao", periodo_inicio="1980-01",
         base={"1981": 110.0, "2008": 4.46, "2020": 4.01},
         descricao="Variação em 12 meses do IPCA (IBGE), índice oficial de inflação do Brasil.",
         mudancas=[{"data": "1994-07", "descricao": "Plano Real: troca de moeda. Antes disso, valores refletem regime de alta inflação; compare com cautela."}],
         caminhos={
             "1981": [(-24, -30), (-12, 15), (0, 0), (6, -6), (14, -15), (20, 20), (26, 70), (32, 105), (40, 90), (48, 120)],
             "2008": [(-24, 2.5), (-12, -1.4), (0, 0), (5, 1.5), (10, 1.9), (14, 1.3), (20, -0.2), (30, 0.8), (42, 2.0), (48, 2.0)],
             "2020": [(-24, 0.6), (-12, -0.4), (0, 0), (2, -1.7), (4, -2.1), (9, 0.4), (14, 2.0), (19, 6.7), (26, 7.9), (32, 1.6), (40, 0.7), (48, 0.5)],
         }),
    dict(id="br_cambio", codigo="3698 (SGS, deflacionado)", nome="Câmbio real R$/US$", pais="BR", grupo="externo",
         fonte="SGS", unidade_original="R$ por US$ (preços de 2026)", frequencia="mensal", ajuste_sazonal=False,
         metodo="indice", sentido="alta", limiar=2.0, par=None, periodo_inicio="1980-01",
         base={"1981": 4.10, "2008": 3.55, "2020": 5.71},
         descricao="Taxa de câmbio comercial de venda, média do mês, descontada a inflação (alta = real mais desvalorizado).",
         mudancas=[{"data": "1999-01", "descricao": "Fim da banda cambial e adoção do câmbio flutuante."}],
         caminhos={
             "1981": [(-24, -4), (-12, -2), (0, 0), (6, 2), (12, 5), (18, 8), (19, 26), (24, 24), (36, 18), (48, 12)],
             "2008": [(-24, 22), (-12, 9), (0, 0), (7, -6), (10, 12), (12, 33), (15, 25), (20, 4), (22, -1), (36, -6), (48, -3)],
             "2020": [(-24, -20), (-12, -12), (0, 0), (1, 12), (3, 30), (8, 22), (14, 20), (24, 15), (36, 8), (48, 12)],
         }),
    dict(id="br_exportacoes", codigo="Exportações FOB (Comex Stat)", nome="Exportações de bens", pais="BR", grupo="externo",
         fonte="COMEX", unidade_original="US$ milhões FOB (média móvel 3 meses)", frequencia="mensal", ajuste_sazonal=False,
         metodo="indice", sentido="queda", limiar=2.0, par=None, periodo_inicio="1997-01",
         base={"2008": 13800.0, "2020": 18100.0},
         descricao="Valor das exportações brasileiras de bens, em dólares, suavizado por média móvel de 3 meses.",
         mudancas=[{"data": "1997-01", "descricao": "Início da série no Comex Stat. Para 1981–82 seria preciso usar estatísticas históricas do Banco Central, ainda não integradas."}],
         caminhos={
             "2008": [(-24, -28), (-12, -14), (0, 0), (6, 25), (9, 22), (12, -10), (14, -32), (18, -20), (24, -4), (28, 2), (40, 40), (48, 30)],
             "2020": [(-24, 8), (-12, 4), (0, 0), (3, -12), (5, -4), (6, 1.5), (12, 8), (24, 55), (36, 70), (48, 58)],
         }),
]

# Cronologia completa do NBER desde 1980 (pico, vale). Só os episódios de EPISODIOS entram na análise;
# os demais aparecem na linha do tempo como contexto.
CRONOLOGIA_NBER = [
    {"pico": "1980-01", "vale": "1980-07"},
    {"pico": "1981-07", "vale": "1982-11"},
    {"pico": "1990-07", "vale": "1991-03"},
    {"pico": "2001-03", "vale": "2001-11"},
    {"pico": "2007-12", "vale": "2009-06"},
    {"pico": "2020-02", "vale": "2020-04"},
]

GRUPOS = [
    {"id": "atividade", "nome": "Atividade econômica"},
    {"id": "trabalho", "nome": "Mercado de trabalho"},
    {"id": "juros", "nome": "Juros"},
    {"id": "precos", "nome": "Preços"},
    {"id": "externo", "nome": "Setor externo"},
]


def mes_mais(ym: str, n: int) -> str:
    a, m = map(int, ym.split("-"))
    t = a * 12 + (m - 1) + n
    return f"{t // 12:04d}-{t % 12 + 1:02d}"


def caminho(pontos, rng: random.Random, metodo: str, escala: float) -> dict[int, float]:
    meses = np.arange(JANELA[0], JANELA[1] + 1)
    xs, ys = zip(*pontos)
    base = np.interp(meses, xs, ys)
    # suaviza levemente para não parecer linha quebrada
    suave = np.convolve(np.pad(base, 1, mode="edge"), [0.25, 0.5, 0.25], mode="valid")
    ruido = np.array([rng.gauss(0, 1) for _ in meses]) * escala
    vals = suave + ruido
    out = {int(m): float(v) for m, v in zip(meses, vals)}
    out[0] = 0.0  # pico é a referência
    return out


def medidas(s, desv: dict[int, float]):
    depois = {m: v for m, v in desv.items() if 0 <= m <= JANELA_MEDIDAS}
    if s["sentido"] == "queda":
        m_vale = min(depois, key=lambda m: depois[m])
    elif s["sentido"] == "alta":
        m_vale = max(depois, key=lambda m: depois[m])
    else:
        m_vale = max(depois, key=lambda m: abs(depois[m]))
    var = depois[m_vale]

    if s["sentido"] == "neutro":
        rec, situ = None, "nao_se_aplica"
    else:
        rec = None
        for m in sorted(depois):
            if m <= m_vale:
                continue
            ok = depois[m] >= 0 if s["sentido"] == "queda" else depois[m] <= 0
            if ok:
                rec = m
                break
        situ = "recuperado" if rec is not None else "nao_recuperado"

    reacao = None
    for m in sorted(depois):
        if m == 0:
            continue
        v = depois[m]
        hit = (v <= -s["limiar"]) if s["sentido"] == "queda" else (v >= s["limiar"]) if s["sentido"] == "alta" else abs(v) >= s["limiar"]
        if hit:
            reacao = m
            break
    return round(var, 2), m_vale, rec, situ, reacao


def main():
    SAIDA.mkdir(parents=True, exist_ok=True)
    rng = random.Random(42)

    dim_serie, valores, resumo = [], [], []
    reacoes: dict[tuple[str, str], int | None] = {}
    variacoes: dict[tuple[str, str], float] = {}

    for s in SERIES:
        ep_com_dados = list(s["caminhos"].keys())
        dim_serie.append({
            "id": s["id"], "codigo": s["codigo"], "nome": s["nome"], "pais": s["pais"], "grupo": s["grupo"],
            "descricao": s["descricao"], "fonte": FONTES[s["fonte"]],
            "unidade_original": s["unidade_original"],
            "unidade_painel": "Índice (pico = 100)" if s["metodo"] == "indice" else "Variação em p.p. desde o pico",
            "frequencia": s["frequencia"], "ajuste_sazonal": s["ajuste_sazonal"],
            "metodo": {"tipo": s["metodo"], "versao": "1.0",
                       "descricao": "Número-índice com o mês de pico = 100" if s["metodo"] == "indice"
                       else "Diferença em pontos percentuais em relação ao mês de pico"},
            "sentido_crise": s["sentido"], "limiar_reacao": s["limiar"],
            "periodo_inicio": s["periodo_inicio"], "periodo_fim": "2026-09",
            "mudancas_metodologia": s["mudancas"], "id_serie_par": s["par"],
            "episodios_sem_dados": [e["id"] for e in EPISODIOS if e["id"] not in ep_com_dados],
        })
        for e in EPISODIOS:
            if e["id"] not in s["caminhos"]:
                resumo.append({"id_serie": s["id"], "id_episodio": e["id"], "variacao_pico_vale": None,
                               "meses_ate_vale": None, "meses_ate_recuperacao": None,
                               "situacao_recuperacao": "sem_dados", "id_edicao": ID_EDICAO})
                continue
            escala = 0.45 if s["metodo"] == "indice" else (0.06 if abs(s["base"][e["id"]]) < 30 else 1.5)
            desv = caminho(s["caminhos"][e["id"]], rng, s["metodo"], escala)
            base = s["base"][e["id"]]
            for m, d in desv.items():
                orig = base * (1 + d / 100) if s["metodo"] == "indice" else base + d
                valores.append({
                    "id_serie": s["id"], "id_episodio": e["id"], "mes_relativo": m,
                    "data_referencia": mes_mais(e["pico"], m),
                    "valor_original": round(orig, 2),
                    "valor_painel": round(100 + d if s["metodo"] == "indice" else d, 2),
                    "data_coleta": DATA_COLETA, "id_edicao": ID_EDICAO,
                })
            var, m_vale, rec, situ, reacao = medidas(s, desv)
            reacoes[(s["id"], e["id"])] = reacao
            variacoes[(s["id"], e["id"])] = var
            resumo.append({"id_serie": s["id"], "id_episodio": e["id"], "variacao_pico_vale": var,
                           "meses_ate_vale": m_vale, "meses_ate_recuperacao": rec,
                           "situacao_recuperacao": situ, "mes_reacao": reacao, "id_edicao": ID_EDICAO})

    comparacao = []
    for s in SERIES:
        if s["pais"] != "US" or not s["par"]:
            continue
        for e in EPISODIOS:
            ku, kb = (s["id"], e["id"]), (s["par"], e["id"])
            if ku not in reacoes or kb not in reacoes or reacoes[ku] is None or reacoes[kb] is None:
                comparacao.append({"id_episodio": e["id"], "id_serie_eua": s["id"], "id_serie_br": s["par"],
                                   "defasagem_meses": None, "diferenca_variacao": None, "id_edicao": ID_EDICAO})
                continue
            comparacao.append({"id_episodio": e["id"], "id_serie_eua": s["id"], "id_serie_br": s["par"],
                               "defasagem_meses": reacoes[kb] - reacoes[ku],
                               "diferenca_variacao": round(variacoes[kb] - variacoes[ku], 2),
                               "id_edicao": ID_EDICAO})

    # RF13: histórico de execuções do pipeline (ilustrativo)
    execucoes = []
    t = datetime(2026, 8, 3, 6, 0)
    for i in range(8):
        tipo = "reprocessamento" if i == 5 else "atualizacao"
        status = "falha" if i == 3 else "sucesso"
        execucoes.append({
            "id_execucao": f"exec-{i + 1:03d}",
            "inicio": t.isoformat(timespec="minutes"),
            "duracao_min": [12, 11, 14, 3, 13, 6, 12, 12][i],
            "tipo": tipo, "status": status,
            "series_processadas": 10 if status == "sucesso" else 4,
            "registros": [2198, 2203, 2205, 640, 2210, 2210, 2214, 2220][i],
            "id_edicao": ID_EDICAO if i == 7 else f"2026.{8 + i // 3:02d}-{i + 1}",
            "observacao": {3: "Ipeadata indisponível (HTTP 503); 3 tentativas automáticas sem sucesso.",
                           5: "Reprocessado após correção da regra de deflação do câmbio (v1.0)."}.get(i, ""),
        })
        t += timedelta(days=14)

    edicao = {"id_edicao": ID_EDICAO, "gerado_em": "2026-11-10T07:12", "ilustrativo": True,
              "janela_meses": list(JANELA), "janela_medidas_meses": JANELA_MEDIDAS,
              "aviso": "Dados ilustrativos gerados para desenvolvimento do painel. Não usar em análises."}

    arquivos = {
        "edicao.json": edicao,
        "dim_episodio.json": EPISODIOS,
        "dim_grupo.json": GRUPOS,
        "cronologia_nber.json": CRONOLOGIA_NBER,
        "dim_pais.json": [{"id": "US", "nome": "EUA", "nome_completo": "Estados Unidos"},
                          {"id": "BR", "nome": "Brasil", "nome_completo": "Brasil"}],
        "dim_serie.json": dim_serie,
        "fato_valor_alinhado.json": valores,
        "fato_resumo_episodio.json": resumo,
        "fato_comparacao.json": comparacao,
        "execucoes.json": execucoes,
    }
    for nome, conteudo in arquivos.items():
        (SAIDA / nome).write_text(json.dumps(conteudo, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(valores)} valores, {len(resumo)} resumos, {len(comparacao)} comparações -> {SAIDA}")


if __name__ == "__main__":
    main()
