from datetime import date
from app.services.sybase_agent import SybaseAgentClient
from app.schemas.operacao import AgenteAoVivo, OperacaoSnapshot

_TABLE = "metatron.TT_ACIONAMENTOS_METATRON"


async def get_snapshot() -> OperacaoSnapshot:
    agent = SybaseAgentClient()
    today = date.today().isoformat()

    # Total de ligações hoje
    r_total = await agent.query(
        f"SELECT COUNT(*) FROM {_TABLE} WHERE data = '{today}'"
    )
    total_hoje = int((r_total.get("rows") or [[0]])[0][0] or 0)

    # Agentes ativos hoje com métricas
    r_agentes = await agent.query(
        f"SELECT operador, COUNT(*) AS total, AVG(duracao) AS dur_media, MAX(hora) AS ultima "
        f"FROM {_TABLE} "
        f"WHERE data = '{today}' AND operador IS NOT NULL "
        f"GROUP BY operador ORDER BY total DESC",
        limit=200,
    )

    por_agente = []
    for row in r_agentes.get("rows", []):
        operador = str(row[0]).strip() if row[0] else "—"
        total = int(row[1]) if row[1] else 0
        dur_media = int(float(row[2])) if row[2] else 0
        ultima = str(row[3]).strip() if row[3] else None
        por_agente.append(AgenteAoVivo(
            operador=operador,
            total=total,
            dur_media_s=dur_media,
            ultima_chamada=ultima,
        ))

    from datetime import datetime
    return OperacaoSnapshot(
        total_hoje=total_hoje,
        agentes_ativos=len(por_agente),
        por_agente=por_agente,
        atualizado_em=datetime.now().strftime("%H:%M:%S"),
    )
