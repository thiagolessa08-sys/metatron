from app.services.sybase_agent import SybaseAgentClient
from app.schemas.qualificacoes import QualificacoesQuery, QualificacaoItem, QualificacoesResult

_TABLE = "metatron.TT_ACIONAMENTOS_METATRON"


def _build_where(q: QualificacoesQuery) -> tuple[str, list]:
    clauses = ["data >= ? AND data <= ?"]
    params: list = [q.data_inicio, q.data_fim]
    if q.campanha:
        clauses.append("campanha = ?")
        params.append(q.campanha)
    if q.operador:
        clauses.append("operador = ?")
        params.append(q.operador)
    return " AND ".join(clauses), params


async def get_qualificacoes(q: QualificacoesQuery) -> QualificacoesResult:
    agent = SybaseAgentClient()
    where, params = _build_where(q)

    # Sybase IQ não suporta parâmetros posicionais via HTTP agent — interpolamos com segurança
    # (apenas datas e strings vindas de filtros validados pelo Pydantic)
    def safe(v: str) -> str:
        return v.replace("'", "''")

    sql = (
        f"SELECT descricao, COUNT(*) AS quantidade "
        f"FROM {_TABLE} "
        f"WHERE data >= '{safe(q.data_inicio)}' AND data <= '{safe(q.data_fim)}'"
    )
    if q.campanha:
        sql += f" AND campanha = '{safe(q.campanha)}'"
    if q.operador:
        sql += f" AND operador = '{safe(q.operador)}'"
    if q.empresa:
        sql += f" AND empresa = '{safe(q.empresa)}'"
    sql += " GROUP BY descricao ORDER BY quantidade DESC"

    r = await agent.query(sql, limit=500)
    rows = r.get("rows", [])
    total = sum(int(row[1]) for row in rows if row[1] is not None)

    items = [
        QualificacaoItem(
            qualificacao=str(row[0]).strip() if row[0] else "Sem qualificação",
            quantidade=int(row[1]),
            percentual=round(int(row[1]) / total * 100, 2) if total else 0.0,
        )
        for row in rows
        if row[1] is not None
    ]
    return QualificacoesResult(total=total, items=items)
