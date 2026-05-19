"""
Endpoints adicionais para Qualificações: tendência diária e heatmap operador×qualificação.
Tudo em TT_ACIONAMENTOS_METATRON com COUNT.
"""
import logging
from collections import defaultdict

from app.services.sybase_agent import SybaseAgentClient
from app.schemas.qualificacoes import (
    QualificacoesQuery,
    TendenciaResult,
    HeatmapResult,
)

logger = logging.getLogger(__name__)


def _build_where(q: QualificacoesQuery, operador_forced: str | None) -> str:
    extra = ""
    op_final = operador_forced or q.operador
    if op_final:
        safe = op_final.replace("'", "''")
        extra += f" AND operador = '{safe}'"
    if q.campanha:
        safe_c = q.campanha.replace("'", "''")
        extra += f" AND campanha = '{safe_c}'"
    return f"WHERE data BETWEEN '{q.data_inicio}' AND '{q.data_fim}'{extra}"


async def _safe_query(agent: SybaseAgentClient, sql: str, limit: int) -> dict:
    try:
        return await agent.query(sql, limit=limit)
    except Exception as e:
        logger.error("Query failed: %s -- %s", e, sql[:200])
        return {"rows": [], "columns": []}


async def tendencia_qualificacoes(
    q: QualificacoesQuery, operador_forced: str | None = None, top_n: int = 5
) -> TendenciaResult:
    agent = SybaseAgentClient()
    where = _build_where(q, operador_forced)

    # 1) Top N qualificações no período
    sql_top = (
        "SELECT descricao, COUNT(*) AS total "
        f"FROM metatron.TT_ACIONAMENTOS_METATRON {where} "
        "GROUP BY descricao ORDER BY total DESC"
    )
    top_raw = await _safe_query(agent, sql_top, limit=100)
    top_quals = [
        (str(r[0] or "—").strip() or "—")
        for r in top_raw.get("rows", [])
        if len(r) >= 2
    ][:top_n]

    if not top_quals:
        return TendenciaResult(datas=[], qualificacoes=[], series=[])

    # 2) Volume diário das top N
    in_list = ", ".join(f"'{q_.replace(chr(39), chr(39) + chr(39))}'" for q_ in top_quals)
    sql_serie = (
        "SELECT data, descricao, COUNT(*) AS total "
        f"FROM metatron.TT_ACIONAMENTOS_METATRON {where} "
        f"AND descricao IN ({in_list}) "
        "GROUP BY data, descricao ORDER BY data"
    )
    serie_raw = await _safe_query(agent, sql_serie, limit=5000)

    # Reorganiza: dict[data][qual] = total
    por_data: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    datas_set: set[str] = set()
    for row in serie_raw.get("rows", []):
        if len(row) < 3:
            continue
        data_str = str(row[0]).strip()[:10]
        qual = str(row[1] or "—").strip() or "—"
        try:
            total = int(row[2])
        except (TypeError, ValueError):
            continue
        if qual not in top_quals:
            continue
        por_data[data_str][qual] += total
        datas_set.add(data_str)

    datas_sorted = sorted(datas_set)
    series = [
        {
            "nome": qual,
            "valores": [por_data[d].get(qual, 0) for d in datas_sorted],
        }
        for qual in top_quals
    ]

    return TendenciaResult(
        datas=datas_sorted,
        qualificacoes=top_quals,
        series=series,
    )


async def heatmap_operador_qualificacao(
    q: QualificacoesQuery,
    operador_forced: str | None = None,
    top_op: int = 10,
    top_q: int = 10,
) -> HeatmapResult:
    agent = SybaseAgentClient()
    where = _build_where(q, operador_forced)

    # 1) Top operadores
    sql_top_op = (
        "SELECT operador, COUNT(*) AS total "
        f"FROM metatron.TT_ACIONAMENTOS_METATRON {where} "
        "GROUP BY operador ORDER BY total DESC"
    )
    top_op_raw = await _safe_query(agent, sql_top_op, limit=top_op * 3)
    operadores = [
        str(r[0] or "—").strip() or "—"
        for r in top_op_raw.get("rows", [])
        if len(r) >= 2
    ][:top_op]

    # 2) Top qualificações
    sql_top_q = (
        "SELECT descricao, COUNT(*) AS total "
        f"FROM metatron.TT_ACIONAMENTOS_METATRON {where} "
        "GROUP BY descricao ORDER BY total DESC"
    )
    top_q_raw = await _safe_query(agent, sql_top_q, limit=top_q * 3)
    qualificacoes = [
        str(r[0] or "—").strip() or "—"
        for r in top_q_raw.get("rows", [])
        if len(r) >= 2
    ][:top_q]

    if not operadores or not qualificacoes:
        return HeatmapResult(operadores=[], qualificacoes=[], matriz=[])

    # 3) Cruzamento operador × qualificação (todos pares relevantes)
    in_ops = ", ".join(f"'{o.replace(chr(39), chr(39) + chr(39))}'" for o in operadores)
    in_quals = ", ".join(f"'{q_.replace(chr(39), chr(39) + chr(39))}'" for q_ in qualificacoes)
    sql_cross = (
        "SELECT operador, descricao, COUNT(*) AS total "
        f"FROM metatron.TT_ACIONAMENTOS_METATRON {where} "
        f"AND operador IN ({in_ops}) "
        f"AND descricao IN ({in_quals}) "
        "GROUP BY operador, descricao"
    )
    cross_raw = await _safe_query(agent, sql_cross, limit=top_op * top_q + 50)

    pair_total: dict[tuple[str, str], int] = {}
    for row in cross_raw.get("rows", []):
        if len(row) < 3:
            continue
        op = str(row[0] or "—").strip() or "—"
        qual = str(row[1] or "—").strip() or "—"
        try:
            total = int(row[2])
        except (TypeError, ValueError):
            continue
        pair_total[(op, qual)] = total

    matriz = [
        [pair_total.get((op, qual), 0) for qual in qualificacoes]
        for op in operadores
    ]

    return HeatmapResult(
        operadores=operadores,
        qualificacoes=qualificacoes,
        matriz=matriz,
    )
