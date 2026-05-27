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


def _safe(v: str) -> str:
    return v.replace("'", "''")


async def _count_for_date(agent: SybaseAgentClient, data: str, empresa: str | None = None) -> int:
    """data no formato yyyy-MM-dd."""
    try:
        extra = f" AND empresa = '{_safe(empresa)}'" if empresa else ""
        r = await agent.query(
            f"SELECT COUNT(*) FROM {_TABLE} "
            f"WHERE CAST(data AS DATE) = '{data}'{extra}"
        )
        return int((r.get("rows") or [[0]])[0][0] or 0)
    except Exception as e:
        logger.error("count_for_date failed: %s", e)
        return 0


async def _latest_date(agent: SybaseAgentClient, empresa: str | None = None) -> str | None:
    """Retorna a data mais recente no formato yyyy-MM-dd."""
    try:
        extra = f" WHERE empresa = '{_safe(empresa)}'" if empresa else ""
        r = await agent.query(f"SELECT MAX(data) FROM {_TABLE}{extra}")
        rows = r.get("rows") or []
        if rows and rows[0] and rows[0][0]:
            # data retorna "YYYY-MM-DD 00:00:00.0" — extrair só a data
            return str(rows[0][0]).strip()[:10]
    except Exception as e:
        logger.error("latest_date failed: %s", e)
    return None


async def get_snapshot(empresa: str | None = None) -> OperacaoSnapshot:
    agent = SybaseAgentClient()
    today = date.today().isoformat()
    is_today = True
    empresa_filter = f" AND empresa = '{_safe(empresa)}'" if empresa else ""

    # Tenta hoje primeiro. Se zero, cai pro último dia com dados.
    total_hoje = await _count_for_date(agent, today, empresa)
    data_alvo = today

    if total_hoje == 0:
        latest = await _latest_date(agent, empresa)
        if latest and latest != today:
            data_alvo = latest
            total_hoje = await _count_for_date(agent, data_alvo, empresa)
            is_today = False

    # Agentes ativos no dia alvo com métricas
    por_agente: list[AgenteAoVivo] = []
    if total_hoje > 0:
        try:
            r_agentes = await agent.query(
                f"SELECT operador, COUNT(*) AS total, AVG(duracao) AS dur_media, MAX(hora) AS ultima "
                f"FROM {_TABLE} "
                f"WHERE CAST(data AS DATE) = '{data_alvo}' AND operador IS NOT NULL{empresa_filter} "
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
