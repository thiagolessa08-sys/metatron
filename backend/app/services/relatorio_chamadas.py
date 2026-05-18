from app.services.sybase_agent import SybaseAgentClient
from app.utils.date_utils import to_sybase_date
from app.schemas.relatorio_chamadas import ChamadasQuery, ChamadaItem, ChamadasResult

_TABLE = "metatron.TT_RELATORIO_METATRON"


def _safe(v: str) -> str:
    return v.replace("'", "''")


async def get_chamadas(q: ChamadasQuery) -> ChamadasResult:
    agent = SybaseAgentClient()

    parts = []
    if q.data_inicio:
        parts.append(f"data_hora >= '{to_sybase_date(_safe(q.data_inicio))}'")
    if q.data_fim:
        parts.append(f"data_hora <= '{to_sybase_date(_safe(q.data_fim))} 23:59:59'")
    if q.resultado:
        parts.append(f"resultado = '{_safe(q.resultado)}'")
    if q.operadora:
        parts.append(f"Operadora = '{_safe(q.operadora)}'")

    where = f"WHERE {' AND '.join(parts)}" if parts else ""

    sql = (
        f"SELECT TOP 1000 data_hora, numero, Operadora, resultado, duracao, Dur_Min, Valor "
        f"FROM {_TABLE} {where} ORDER BY data_hora DESC"
    )

    r = await agent.query(sql, limit=1000)
    rows = r.get("rows", [])

    items = [
        ChamadaItem(
            data_hora=str(row[0]).strip() if row[0] else "",
            numero=str(row[1]).strip() if row[1] else "",
            operadora=str(row[2]).strip() if row[2] else "",
            resultado=str(row[3]).strip() if row[3] else "",
            duracao=str(row[4]).strip() if row[4] else "",
            dur_min=str(row[5]).strip() if row[5] else "",
            valor=str(row[6]).strip() if row[6] else "",
        )
        for row in rows
    ]

    return ChamadasResult(items=items, total=len(items), truncated=r.get("truncated", False))
