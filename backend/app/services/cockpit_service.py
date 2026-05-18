"""
Cockpit Temporal: heatmap (dia da semana × hora) e comparativo hoje vs média 7d.
Usa apenas TT_ACIONAMENTOS_METATRON (única tabela segura para COUNT).
"""
from datetime import datetime, timedelta

from app.services.sybase_agent import SybaseAgentClient
from app.schemas.cockpit import (
    CockpitResult,
    HeatmapCell,
    ComparativoSerie,
    PicoItem,
)

DIAS_PT = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]


def _parse_hora(raw) -> int | None:
    """Extrai hora (0-23) de uma string 'HH:MM:SS' ou 'HH'."""
    if raw is None:
        return None
    text = str(raw).strip()
    if not text:
        return None
    try:
        if ":" in text:
            return int(text.split(":")[0])
        return int(text)
    except (ValueError, IndexError):
        return None


async def cockpit_heatmap(
    data_inicio: str,
    data_fim: str,
    operador_filter: str | None = None,
) -> CockpitResult:
    agent = SybaseAgentClient()
    hoje = datetime.now().strftime("%Y-%m-%d")
    d7_atras = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")

    where_op = ""
    if operador_filter:
        safe = operador_filter.replace("'", "''")
        where_op = f" AND operador = '{safe}'"

    # 1. Heatmap período inteiro
    sql_heatmap = (
        "SELECT data, hora, COUNT(*) AS total "
        "FROM metatron.TT_ACIONAMENTOS_METATRON "
        f"WHERE data BETWEEN '{data_inicio}' AND '{data_fim}'{where_op} "
        "GROUP BY data, hora"
    )
    heatmap_raw = await agent.query(sql_heatmap, limit=10000)

    # 2. Comparativo hoje
    sql_hoje = (
        "SELECT hora, COUNT(*) AS total "
        "FROM metatron.TT_ACIONAMENTOS_METATRON "
        f"WHERE data = '{hoje}'{where_op} "
        "GROUP BY hora"
    )
    hoje_raw = await agent.query(sql_hoje, limit=240)

    # 3. Média 7 dias (inclui hoje)
    sql_media = (
        "SELECT hora, COUNT(*) AS total "
        "FROM metatron.TT_ACIONAMENTOS_METATRON "
        f"WHERE data BETWEEN '{d7_atras}' AND '{hoje}'{where_op} "
        "GROUP BY hora"
    )
    media_raw = await agent.query(sql_media, limit=240)

    # Processa heatmap
    heatmap_cells: list[HeatmapCell] = []
    picos_dict: dict[tuple[int, int], int] = {}
    total_periodo = 0

    for row in heatmap_raw.get("rows", []):
        if len(row) < 3:
            continue
        data_str = str(row[0]).strip()
        hora_int = _parse_hora(row[1])
        try:
            total = int(row[2])
        except (TypeError, ValueError):
            continue
        if hora_int is None:
            continue
        try:
            dt = datetime.strptime(data_str, "%Y-%m-%d")
        except ValueError:
            continue
        dia_semana = dt.weekday()
        heatmap_cells.append(
            HeatmapCell(dia_semana=dia_semana, hora=hora_int, valor=total)
        )
        key = (dia_semana, hora_int)
        picos_dict[key] = picos_dict.get(key, 0) + total
        total_periodo += total

    # Top 3 picos (agregando dia_semana × hora ao longo do período)
    picos_sorted = sorted(picos_dict.items(), key=lambda kv: kv[1], reverse=True)[:3]
    picos = [
        PicoItem(
            dia_semana=ds,
            hora=h,
            valor=v,
            label=f"{DIAS_PT[ds]} às {h:02d}h",
        )
        for (ds, h), v in picos_sorted
    ]

    # Comparativo hoje (24h, zeros preenchidos)
    hoje_dict: dict[int, int] = {}
    for row in hoje_raw.get("rows", []):
        if len(row) < 2:
            continue
        h = _parse_hora(row[0])
        if h is None:
            continue
        try:
            hoje_dict[h] = hoje_dict.get(h, 0) + int(row[1])
        except (TypeError, ValueError):
            continue
    comp_hoje = [ComparativoSerie(hora=h, valor=hoje_dict.get(h, 0)) for h in range(24)]

    # Comparativo média 7d (total / 7)
    media_dict: dict[int, int] = {}
    for row in media_raw.get("rows", []):
        if len(row) < 2:
            continue
        h = _parse_hora(row[0])
        if h is None:
            continue
        try:
            media_dict[h] = media_dict.get(h, 0) + int(row[1])
        except (TypeError, ValueError):
            continue
    comp_media = [
        ComparativoSerie(hora=h, valor=round(media_dict.get(h, 0) / 7))
        for h in range(24)
    ]

    return CockpitResult(
        heatmap=heatmap_cells,
        comparativo_hoje=comp_hoje,
        comparativo_media7d=comp_media,
        picos=picos,
        total_periodo=total_periodo,
    )
