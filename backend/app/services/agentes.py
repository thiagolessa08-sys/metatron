from app.services.sybase_agent import SybaseAgentClient
from app.schemas.agentes import AgentesQuery, AgenteMetrica, AgentesResult

_TABLE = "metatron.TT_ACIONAMENTOS_METATRON"


def _safe(v: str) -> str:
    return v.replace("'", "''")


def _where(q: AgentesQuery) -> str:
    parts = [f"data >= '{_safe(q.data_inicio)}' AND data <= '{_safe(q.data_fim)}'"]
    if q.campanha:
        parts.append(f"campanha = '{_safe(q.campanha)}'")
    if q.operador:
        parts.append(f"operador = '{_safe(q.operador)}'")
    return " AND ".join(parts)


async def get_agentes_metricas(q: AgentesQuery) -> AgentesResult:
    agent = SybaseAgentClient()
    where = _where(q)

    # Totais por agente
    sql_totais = (
        f"SELECT operador, COUNT(*) AS total, SUM(duracao) AS dur_total, AVG(duracao) AS dur_media "
        f"FROM {_TABLE} WHERE {where} AND operador IS NOT NULL "
        f"GROUP BY operador ORDER BY total DESC"
    )
    r_totais = await agent.query(sql_totais, limit=500)

    # Qualificações por agente
    sql_quals = (
        f"SELECT operador, descricao, COUNT(*) AS qtd "
        f"FROM {_TABLE} WHERE {where} AND operador IS NOT NULL AND descricao IS NOT NULL "
        f"GROUP BY operador, descricao"
    )
    r_quals = await agent.query(sql_quals, limit=2000)

    # Monta dict operador → {qualificacao: count}
    quals_map: dict[str, dict[str, int]] = {}
    for row in r_quals.get("rows", []):
        op = str(row[0]).strip() if row[0] else ""
        qual = str(row[1]).strip() if row[1] else "Sem qualificação"
        qtd = int(float(row[2])) if row[2] else 0
        quals_map.setdefault(op, {})[qual] = qtd

    items = []
    for row in r_totais.get("rows", []):
        op = str(row[0]).strip() if row[0] else "—"
        total = int(float(row[1])) if row[1] else 0
        dur_total = int(float(row[2])) if row[2] else 0
        dur_media = int(float(row[3])) if row[3] else 0
        items.append(AgenteMetrica(
            operador=op,
            total_ligacoes=total,
            duracao_total_s=dur_total,
            duracao_media_s=dur_media,
            qualificacoes=quals_map.get(op, {}),
        ))

    return AgentesResult(
        items=items,
        total_ligacoes=sum(i.total_ligacoes for i in items),
        total_duracao_s=sum(i.duracao_total_s for i in items),
    )
