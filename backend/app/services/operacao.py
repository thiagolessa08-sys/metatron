"""
Operação Agora: snapshot do "dia atual" da operação.
Fallback inteligente: se hoje não tem dados, usa o último dia com dados na base.
Útil em PoC e em base com lag D-1.
"""
import logging
from datetime import date, datetime

from app.services.sybase_agent import SybaseAgentClient
from app.utils.date_utils import to_sybase_date, from_sybase_date
from app.schemas.operacao import AgenteAoVivo, OperacaoSnapshot

logger = logging.getLogger(__name__)

_TABLE = "metatron.TT_ACIONAMENTOS_METATRON"


async def _count_for_date(agent: SybaseAgentClient, data_db: str) -> int:
    """data_db deve estar no formato dd/MM/yyyy."""
    try:
        r = await agent.query(f"SELECT COUNT(*) FROM {_TABLE} WHERE data = '{data_db}'")
        return int((r.get("rows") or [[0]])[0][0] or 0)
    except Exception as e:
        logger.error("count_for_date failed: %s", e)
        return 0


async def _latest_date(agent: SybaseAgentClient) -> str | None:
    """
    Retorna a data mais recente no banco no formato dd/MM/yyyy.
    Usa DISTINCT + sort Python porque MAX() sobre VARCHAR dd/MM/yyyy é ordem alfabética,
    não cronológica (ex: "31/10/2025" > "01/04/2026" alfabeticamente).
    """
    try:
        r = await agent.query(f"SELECT DISTINCT data FROM {_TABLE}", limit=2000)
        rows = r.get("rows") or []
        best: tuple[datetime, str] | None = None
        for row in rows:
            if not (row and row[0]):
                continue
            raw = str(row[0]).strip()
            try:
                dt = datetime.strptime(raw, "%d/%m/%Y")
            except ValueError:
                continue
            if best is None or dt > best[0]:
                best = (dt, raw)
        return best[1] if best else None
    except Exception as e:
        logger.error("latest_date failed: %s", e)
    return None


async def get_snapshot() -> OperacaoSnapshot:
    agent = SybaseAgentClient()
    today_iso = date.today().isoformat()       # yyyy-MM-dd para comparações Python
    today_db = to_sybase_date(today_iso)       # dd/MM/yyyy para queries Sybase
    is_today = True

    # Tenta hoje primeiro. Se zero, cai pro último dia com dados.
    total_hoje = await _count_for_date(agent, today_db)
    data_alvo_db = today_db    # dd/MM/yyyy — usado nas queries
    data_alvo_iso = today_iso  # yyyy-MM-dd — retornado ao frontend

    if total_hoje == 0:
        latest_db = await _latest_date(agent)  # retorna dd/MM/yyyy ou None
        if latest_db and from_sybase_date(latest_db) != today_iso:
            data_alvo_db = latest_db
            data_alvo_iso = from_sybase_date(latest_db)
            total_hoje = await _count_for_date(agent, data_alvo_db)
            is_today = False

    # Agentes ativos no dia alvo com métricas
    por_agente: list[AgenteAoVivo] = []
    if total_hoje > 0:
        try:
            r_agentes = await agent.query(
                f"SELECT operador, COUNT(*) AS total, AVG(duracao) AS dur_media, MAX(hora) AS ultima "
                f"FROM {_TABLE} "
                f"WHERE data = '{data_alvo_db}' AND operador IS NOT NULL "
                f"GROUP BY operador ORDER BY total DESC",
                limit=200,
            )
            for row in r_agentes.get("rows", []):
                operador = str(row[0]).strip() if row[0] else "—"
                total = int(row[1]) if row[1] else 0
                dur_media = int(float(row[2])) if row[2] else 0
                ultima = str(row[3]).strip() if row[3] else None
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
        data_referencia=data_alvo_iso,  # sempre ISO para o frontend
        is_today=is_today,
    )
