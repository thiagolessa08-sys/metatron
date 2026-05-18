from app.services.sybase_agent import SybaseAgentClient
from app.schemas.aproveitamento import AproveitamentoQuery, AproveitamentoItem, AproveitamentoResult

_TABLE = "metatron.TT_METRICAS_METATRON"


def _safe(v: str) -> str:
    return v.replace("'", "''")


def _to_int(v) -> int:
    try:
        return int(v) if v is not None else 0
    except (ValueError, TypeError):
        return 0


def _to_float(v) -> float:
    try:
        return float(v) if v is not None else 0.0
    except (ValueError, TypeError):
        return 0.0


async def get_aproveitamento(q: AproveitamentoQuery) -> AproveitamentoResult:
    agent = SybaseAgentClient()

    sql = (
        "SELECT campanha, SUM(CAST(total AS INTEGER)), SUM(CAST(localizados AS INTEGER)), "
        "SUM(CAST(em_contato AS INTEGER)), SUM(CAST(contatados AS INTEGER)), "
        "SUM(CAST(discados_total AS INTEGER)), SUM(CAST(atendidas_hoje AS INTEGER)), "
        "AVG(CAST(aproveitamento AS DOUBLE)), "
        "SUM(CAST(agendamentos_publicos AS INTEGER)), SUM(CAST(agendamentos_privados AS INTEGER)) "
        f"FROM {_TABLE}"
    )
    clauses = []
    if q.campanha:
        clauses.append(f"campanha = '{_safe(q.campanha)}'")
    if q.servidor:
        clauses.append(f"servidor = '{_safe(q.servidor)}'")
    if clauses:
        sql += " WHERE " + " AND ".join(clauses)
    sql += " GROUP BY campanha ORDER BY campanha"

    r = await agent.query(sql, limit=500)
    rows = r.get("rows", [])

    def _aproveitamento(localizados: int, total: int) -> float:
        return round(localizados / total * 100, 2) if total > 0 else 0.0

    items = [
        AproveitamentoItem(
            campanha=str(row[0]).strip() if row[0] else "—",
            total=_to_int(row[1]),
            localizados=_to_int(row[2]),
            em_contato=_to_int(row[3]),
            contatados=_to_int(row[4]),
            discados_total=_to_int(row[5]),
            atendidas_hoje=_to_int(row[6]),
            aproveitamento=_aproveitamento(_to_int(row[2]), _to_int(row[1])),
            agendamentos_publicos=_to_int(row[8]),
            agendamentos_privados=_to_int(row[9]),
        )
        for row in rows
    ]

    total_geral = sum(i.total for i in items)
    localizados_geral = sum(i.localizados for i in items)
    totais = AproveitamentoItem(
        campanha="TOTAL",
        total=total_geral,
        localizados=localizados_geral,
        em_contato=sum(i.em_contato for i in items),
        contatados=sum(i.contatados for i in items),
        discados_total=sum(i.discados_total for i in items),
        atendidas_hoje=sum(i.atendidas_hoje for i in items),
        aproveitamento=_aproveitamento(localizados_geral, total_geral),
        agendamentos_publicos=sum(i.agendamentos_publicos for i in items),
        agendamentos_privados=sum(i.agendamentos_privados for i in items),
    ) if items else None

    return AproveitamentoResult(items=items, totais=totais)
