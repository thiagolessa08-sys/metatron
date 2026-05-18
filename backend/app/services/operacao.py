"""
Operação Agora: snapshot do "dia atual" da operação.
Fallback inteligente: se hoje não tem dados, usa o último dia com dados na base.
Útil em PoC e em base com lag D-1.
"""
import logging
from datetime import date, datetime

from app.services.sybase_agent import SybaseAgentClient
from app.schemas.operacao import AgenteAoVivo, OperacaoSnapshot

logger = logging.getLogger(__name__)

_TABLE = "metatron.TT_ACIONAMENTOS_METATRON"


async def _count_for_date(agent: SybaseAgentClient, data: str) -> int:
    """data no formato yyyy-MM-dd."""
    try:
        r = await agent.query(
            f"SELECT COUNT(*) FROM {_TABLE} "
            f"WHERE data_correta >= '{data}' AND data_correta < '{data} 23:59:59'"
        )
        return int((r.get("rows") or [[0]])[0][0] or 0)
    except Exception as e:
        logger.error("count_for_date failed: %s", e)
        return 0


async def _latest_date(agent: SybaseAgentClient) -> str | None:
    """Retorna a data mais recente no formato yyyy-MM-dd."""
    try:
        r = await agent.query(f"SELECT MAX(data_correta) FROM {_TABLE}")
        rows = r.get("rows") or []
        if rows and rows[0] and rows[0][0]:
            # data_correta retorna "YYYY-MM-DD 00:00:00.0" — extrair só a data
            return str(rows[0][0]).strip()[:10]
    except Exception as e:
        logger.error("latest_date failed: %s", e)
    return None


async def get_snapshot() -> OperacaoSnapshot:
    agent = SybaseAgentClient()
    today = date.today().isoformat()
    is_today = True

    # Tenta hoje primeiro. Se zero, cai pro último dia com dados.
    total_hoje = await _count_for_date(agent, today)
    data_alvo = today

    if total_hoje == 0:
        latest = await _latest_date(agent)
        if latest and latest != today:
            data_alvo = latest
            total_hoje = await _count_for_date(agent, data_alvo)
            is_today = False

    # Agentes ativos no dia alvo com métricas
    por_agente: list[AgenteAoVivo] = []
    if total_hoje > 0:
        try:
            r_agentes = await agent.query(
                f"SELECT operador, COUNT(*) AS total, AVG(duracao) AS dur_media, MAX(hora) AS ultima "
                f"FROM {_TABLE} "
                f"WHERE data_correta >= '{data_alvo}' AND data_correta < '{data_alvo} 23:59:59' AND operador IS NOT NULL "
                f"GROUP BY operador ORDER BY total DESC",
                limit=200,
            )
            for row in r_agentes.get("rows", []):
                operador = str(row[0]).strip() if row[0] else "—"
                total = int(row[1]) if row[1] else 0
                dur_media = int(float(row[2])) if row[2] else 0
                # hora retorna "0001-01-01 HH:MM:SS.0" — extrair só HH:MM
                raw_ultima = str(row[3]).strip() if row[3] else None
                if raw_ultima and " " in raw_ultima:
                    raw_ultima = raw_ultima.split(" ")[1][:5]
                ultima = raw_ultima
                por_agente.append(
                    AgenteAoVivo(
                        operador=operador,
                        total=total,
                        dur_media_s=dur_media,
                        ultima_chamada=ultima,
                    )
                )
        except Exception as e:
            logger.error("agentes query failed: %s", e)

    return OperacaoSnapshot(
        total_hoje=total_hoje,
        agentes_ativos=len(por_agente),
        por_agente=por_agente,
        atualizado_em=datetime.now().strftime("%H:%M:%S"),
        data_referencia=data_alvo,
        is_today=is_today,
    )
