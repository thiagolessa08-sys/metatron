"""
Resumo das chamadas: histograma de duração, distribuição por hora, mix por operadora.
Lê TT_RELATORIO_METATRON (campos VARCHAR, agregação feita em Python).
"""
import logging
from collections import defaultdict

from app.services.sybase_agent import SybaseAgentClient
from app.schemas.relatorio_chamadas import (
    ChamadasQuery,
    ChamadasResumo,
    FaixaDuracao,
    HoraBucket,
    OperadoraBucket,
)

logger = logging.getLogger(__name__)

_TABLE = "metatron.TT_RELATORIO_METATRON"


def _safe(v: str) -> str:
    return v.replace("'", "''")


def _to_float(value, default: float = 0.0) -> float:
    if value is None:
        return default
    text = str(value).strip().replace(",", ".")
    if not text:
        return default
    try:
        return float(text)
    except (ValueError, TypeError):
        return default


def _faixa_duracao(seg: float) -> str:
    if seg < 30:
        return "0–30s"
    if seg < 60:
        return "30–60s"
    if seg < 120:
        return "1–2min"
    if seg < 300:
        return "2–5min"
    return "5min+"


_FAIXAS_ORDEM = ["0–30s", "30–60s", "1–2min", "2–5min", "5min+"]


async def chamadas_resumo(q: ChamadasQuery) -> ChamadasResumo:
    agent = SybaseAgentClient()

    parts = []
    if q.data_inicio:
        parts.append(f"datahora >= '{_safe(q.data_inicio)}'")
    if q.data_fim:
        parts.append(f"datahora <= '{_safe(q.data_fim)} 23:59:59'")
    if q.resultado:
        parts.append(f"resultado = '{_safe(q.resultado)}'")
    if q.operadora:
        parts.append(f"Operadora = '{_safe(q.operadora)}'")
    where = f"WHERE {' AND '.join(parts)}" if parts else ""

    # Lê todas as colunas necessárias — agregação é Python (VARCHAR não permite SUM/AVG aqui)
    sql = (
        f"SELECT datahora, Operadora, duracao, Valor "
        f"FROM {_TABLE} {where}"
    )

    try:
        raw = await agent.query(sql, limit=50000)
    except Exception as e:
        logger.error("chamadas_resumo failed: %s", e)
        return ChamadasResumo(
            total=0,
            duracao_total_s=0,
            duracao_media_s=0,
            custo_total=0.0,
            custo_medio=0.0,
            operadora_dominante=None,
            pct_longas=0.0,
            por_duracao=[],
            por_hora=[],
            por_operadora=[],
        )

    faixas: dict[str, int] = defaultdict(int)
    horas: dict[int, int] = defaultdict(int)
    operadoras: dict[str, int] = defaultdict(int)
    total_dur = 0.0
    total_valor = 0.0
    chamadas_longas = 0
    total = 0

    for row in raw.get("rows", []):
        if len(row) < 4:
            continue
        datahora = str(row[0] or "").strip()
        oper = str(row[1] or "—").strip() or "—"
        dur = _to_float(row[2])
        valor = _to_float(row[3])

        total += 1
        total_dur += dur
        total_valor += valor
        faixas[_faixa_duracao(dur)] += 1
        operadoras[oper] += 1
        if dur >= 120:
            chamadas_longas += 1

        # Extrai hora do datahora (formato esperado "yyyy-MM-dd HH:MM:SS")
        if " " in datahora:
            time_part = datahora.split(" ")[1]
            try:
                h = int(time_part.split(":")[0])
                if 0 <= h < 24:
                    horas[h] += 1
            except (ValueError, IndexError):
                pass

    operadora_dominante = (
        max(operadoras.items(), key=lambda kv: kv[1])[0] if operadoras else None
    )

    por_duracao = [
        FaixaDuracao(faixa=f, total=faixas.get(f, 0)) for f in _FAIXAS_ORDEM
    ]
    por_hora = [HoraBucket(hora=h, total=horas.get(h, 0)) for h in range(24)]
    por_operadora = sorted(
        [OperadoraBucket(nome=n, total=t) for n, t in operadoras.items()],
        key=lambda x: x.total,
        reverse=True,
    )[:10]

    return ChamadasResumo(
        total=total,
        duracao_total_s=int(total_dur),
        duracao_media_s=int(total_dur / total) if total else 0,
        custo_total=round(total_valor, 2),
        custo_medio=round(total_valor / total, 4) if total else 0.0,
        operadora_dominante=operadora_dominante,
        pct_longas=round((chamadas_longas / total * 100), 1) if total else 0.0,
        por_duracao=por_duracao,
        por_hora=por_hora,
        por_operadora=por_operadora,
    )
