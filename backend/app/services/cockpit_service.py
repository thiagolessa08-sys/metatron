"""
Cockpit Temporal: heatmap, KPIs e agregações temporais.
Usa apenas TT_ACIONAMENTOS_METATRON (única tabela segura para COUNT).
Filtros: período obrigatório, campanha e operador opcionais.
"""
from datetime import datetime, timedelta
from collections import defaultdict

from app.services.sybase_agent import SybaseAgentClient
from app.schemas.cockpit import (
    CockpitResult,
    HeatmapCell,
    PicoItem,
    VolumeDiario,
    DiaSemanaTotal,
    TurnoTotal,
    DiaUtilFds,
)

DIAS_PT = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]


def _parse_hora(raw) -> int | None:
    """Extrai hora (0-23) de string 'HH:MM:SS' ou 'HH'."""
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


def _turno_label(hora: int) -> str:
    if 0 <= hora < 6:
        return "Madrugada"
    if 6 <= hora < 12:
        return "Manhã"
    if 12 <= hora < 18:
        return "Tarde"
    return "Noite"


async def cockpit_heatmap(
    data_inicio: str,
    data_fim: str,
    campanha: str | None = None,
    operador: str | None = None,
    operador_forced: str | None = None,
) -> CockpitResult:
    """
    operador_forced: filtro de role (consultor vê só os próprios dados).
                     Tem precedência sobre `operador`.
    """
    agent = SybaseAgentClient()

    where_extra = ""
    op_final = operador_forced or operador
    if op_final:
        safe = op_final.replace("'", "''")
        where_extra += f" AND operador = '{safe}'"
    if campanha:
        safe_c = campanha.replace("'", "''")
        where_extra += f" AND campanha = '{safe_c}'"

    # Query única: data + hora → COUNT
    sql = (
        "SELECT data, hora, COUNT(*) AS total "
        "FROM metatron.TT_ACIONAMENTOS_METATRON "
        f"WHERE data BETWEEN '{data_inicio}' AND '{data_fim}'{where_extra} "
        "GROUP BY data, hora"
    )
    raw = await agent.query(sql, limit=20000)

    # Estruturas de agregação
    heatmap_cells: list[HeatmapCell] = []
    heatmap_agg: dict[tuple[int, int], int] = defaultdict(int)  # (dia_semana, hora) -> total
    volume_por_data: dict[str, int] = defaultdict(int)
    por_dia_semana_agg: dict[int, int] = defaultdict(int)
    por_turno_agg: dict[str, int] = defaultdict(int)
    horas_agg: dict[int, int] = defaultdict(int)
    dias_uteis_set: set[str] = set()
    dias_fds_set: set[str] = set()
    dia_util_total = 0
    fds_total = 0
    horario_comercial_total = 0
    total_periodo = 0

    for row in raw.get("rows", []):
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
        heatmap_agg[(dia_semana, hora_int)] += total
        volume_por_data[data_str] += total
        por_dia_semana_agg[dia_semana] += total
        por_turno_agg[_turno_label(hora_int)] += total
        horas_agg[hora_int] += total
        total_periodo += total

        if dia_semana < 5:
            dia_util_total += total
            dias_uteis_set.add(data_str)
        else:
            fds_total += total
            dias_fds_set.add(data_str)

        if 8 <= hora_int < 18:
            horario_comercial_total += total

    # Heatmap final
    for (ds, h), v in heatmap_agg.items():
        heatmap_cells.append(HeatmapCell(dia_semana=ds, hora=h, valor=v))

    # Volume diário ordenado
    volume_diario = sorted(
        [VolumeDiario(data=d, total=t) for d, t in volume_por_data.items()],
        key=lambda x: x.data,
    )

    # Por dia da semana
    por_dia_semana = [
        DiaSemanaTotal(dia_semana=i, label=DIAS_PT[i], total=por_dia_semana_agg.get(i, 0))
        for i in range(7)
    ]

    # Por turno (ordem fixa)
    turnos_ordem = ["Manhã", "Tarde", "Noite", "Madrugada"]
    por_turno = [TurnoTotal(nome=t, total=por_turno_agg.get(t, 0)) for t in turnos_ordem]

    # Dia útil vs FDS
    dia_util_fds = DiaUtilFds(
        dia_util=dia_util_total,
        fim_de_semana=fds_total,
        media_dia_util=(dia_util_total // len(dias_uteis_set)) if dias_uteis_set else 0,
        media_fds=(fds_total // len(dias_fds_set)) if dias_fds_set else 0,
    )

    # Top 3 picos
    picos_sorted = sorted(heatmap_agg.items(), key=lambda kv: kv[1], reverse=True)[:3]
    picos = [
        PicoItem(
            dia_semana=ds,
            hora=h,
            valor=v,
            label=f"{DIAS_PT[ds]} às {h:02d}h",
        )
        for (ds, h), v in picos_sorted
    ]

    # KPIs derivados
    melhor_dia_semana = (
        DIAS_PT[max(por_dia_semana_agg.items(), key=lambda kv: kv[1])[0]]
        if por_dia_semana_agg
        else None
    )
    melhor_turno = (
        max(por_turno_agg.items(), key=lambda kv: kv[1])[0]
        if por_turno_agg
        else None
    )
    pct_horario_comercial = (
        (horario_comercial_total / total_periodo * 100) if total_periodo else 0.0
    )
    dia_recorde = (
        max(volume_por_data.items(), key=lambda kv: kv[1])[0]
        if volume_por_data
        else None
    )
    hora_pico = (
        max(horas_agg.items(), key=lambda kv: kv[1])[0]
        if horas_agg
        else None
    )

    return CockpitResult(
        heatmap=heatmap_cells,
        volume_diario=volume_diario,
        por_dia_semana=por_dia_semana,
        por_turno=por_turno,
        dia_util_fds=dia_util_fds,
        picos=picos,
        total_periodo=total_periodo,
        melhor_dia_semana=melhor_dia_semana,
        melhor_turno=melhor_turno,
        pct_horario_comercial=round(pct_horario_comercial, 1),
        dia_recorde=dia_recorde,
        hora_pico=hora_pico,
    )
