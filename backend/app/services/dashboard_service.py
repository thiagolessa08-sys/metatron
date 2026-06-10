"""
Dashboard executivo: agregações para a tela inicial.
Usa apenas TT_ACIONAMENTOS_METATRON (única tabela segura para COUNT/SUM).
Queries separadas para evitar problemas com múltiplos COUNT(DISTINCT) no Sybase IQ.
"""
import logging

from app.services.sybase_agent import SybaseAgentClient
from app.schemas.dashboard import (
    DashboardResult,
    DateRangeResult,
    VolumeDiarioPonto,
    TopItem,
)

logger = logging.getLogger(__name__)

# === Agrupamentos de status (descricao) para o funil de conversão ===
# Telefone inválido/inexistente → não localizado
_NAO_LOCALIZADO = [
    "TEL INCORRETO", "TELEFONE_ERRADO", "TELEFONE INDISPONIVEL",
    "TELEFONE_INVALIDO", "TELEFONE_INCORRETO", "NAO_ENCONTRADO",
    "cliente_inexistente", "NUMERO_ERRADO",
]
# Localizado mas sem contato humano (inclui não-tabulados) → exclui de "Contatados"
_SEM_CONTATO = [
    "LIGACAO CAIU", "LIGACAO_CAIU", "CAIU", "LIGACAO_CAIU_COM_CLIENTE",
    "AUSENTE", "CAIXA POSTAL", "caixa_postal", "MUDA", "MUDO",
    "ligacao_muda", "TELEFONE_MUDO", "OCUPADO", "Agente Nao Tabulou",
]
_NEGOCIACAO = ["Negociando", "Negociacao_no_whts_", "NEGOCIANDO_WHATSAPP"]
_FECHADOS = [
    "VENDA", "VENDA_FEITA", "VENDA_FEITA_POR_TELEFONE", "contrato_fechado",
    "cliente_fechado", "CLIENTE JA FECHADO", "TORNOU_SE_CLIENTE", "FECHADO",
    "CONTRATO_LIQUIDADO", "CLIENTE_FINALIZADO",
]


def _in_list(valores: list[str]) -> str:
    """Monta lista para cláusula IN com aspas escapadas."""
    return ", ".join("'" + v.replace("'", "''") + "'" for v in valores)


def _safe_int(value, default: int = 0) -> int:
    if value is None:
        return default
    if isinstance(value, (int, float)):
        return int(value)
    try:
        return int(float(str(value)))
    except (ValueError, TypeError):
        return default


async def _try_query(agent: SybaseAgentClient, sql: str, limit: int = 100) -> dict:
    """Executa SQL e retorna dict vazio em caso de erro (com log)."""
    try:
        return await agent.query(sql, limit=limit)
    except Exception as e:
        logger.error("Dashboard query failed: %s -- SQL: %s", e, sql[:200])
        return {"rows": [], "columns": []}


async def dashboard_date_range() -> DateRangeResult:
    """Retorna o intervalo de datas disponível em TT_ACIONAMENTOS_METATRON."""
    agent = SybaseAgentClient()
    sql = (
        "SELECT MIN(data) AS min_data, MAX(data) AS max_data, COUNT(*) AS total "
        "FROM metatron.TT_ACIONAMENTOS_METATRON"
    )
    raw = await _try_query(agent, sql, limit=1)
    rows = raw.get("rows") or []
    if not rows:
        return DateRangeResult(min_data=None, max_data=None, total=0)
    r = rows[0]
    # data retorna "YYYY-MM-DD 00:00:00.0" — extrair só a data
    return DateRangeResult(
        min_data=str(r[0]).strip()[:10] if r[0] else None,
        max_data=str(r[1]).strip()[:10] if r[1] else None,
        total=_safe_int(r[2] if len(r) > 2 else 0),
    )


async def dashboard_executive(
    data_inicio: str,
    data_fim: str,
    campanha: str | None = None,
    operador: str | None = None,
    operador_forced: str | None = None,
    empresa: str | None = None,
) -> DashboardResult:
    agent = SybaseAgentClient()

    where_extra = ""
    op_final = operador_forced or operador
    if op_final:
        safe = op_final.replace("'", "''")
        where_extra += f" AND operador = '{safe}'"
    if campanha:
        safe_c = campanha.replace("'", "''")
        where_extra += f" AND campanha = '{safe_c}'"
    if empresa:
        safe_e = empresa.replace("'", "''")
        where_extra += f" AND empresa = '{safe_e}'"

    period_where = (
        f"WHERE data BETWEEN '{data_inicio}' AND '{data_fim}'{where_extra}"
    )

    # === 1) Total de ligações (query simples) ===
    sql_total = (
        f"SELECT COUNT(*) AS total FROM metatron.TT_ACIONAMENTOS_METATRON {period_where}"
    )
    total_raw = await _try_query(agent, sql_total, limit=1)
    total_ligacoes = (
        _safe_int(total_raw["rows"][0][0]) if total_raw.get("rows") else 0
    )

    # === 1b) Funil de conversão (agregação condicional por status) ===
    sql_funil = (
        "SELECT "
        f"SUM(CASE WHEN descricao IN ({_in_list(_NAO_LOCALIZADO)}) THEN 1 ELSE 0 END) AS nao_localizado, "
        f"SUM(CASE WHEN descricao IN ({_in_list(_SEM_CONTATO)}) OR descricao IS NULL THEN 1 ELSE 0 END) AS sem_contato, "
        "SUM(CASE WHEN descricao = 'Agente Nao Tabulou' THEN 1 ELSE 0 END) AS agente_nao_tabulou, "
        f"SUM(CASE WHEN descricao IN ({_in_list(_NEGOCIACAO)}) THEN 1 ELSE 0 END) AS negociacao, "
        f"SUM(CASE WHEN descricao IN ({_in_list(_FECHADOS)}) THEN 1 ELSE 0 END) AS fechados "
        f"FROM metatron.TT_ACIONAMENTOS_METATRON {period_where}"
    )
    funil_raw = await _try_query(agent, sql_funil, limit=1)
    nao_localizado = sem_contato = agente_nao_tabulou = negociacao_n = fechados_n = 0
    if funil_raw.get("rows"):
        fr = funil_raw["rows"][0]
        nao_localizado = _safe_int(fr[0])
        sem_contato = _safe_int(fr[1])
        agente_nao_tabulou = _safe_int(fr[2])
        negociacao_n = _safe_int(fr[3])
        fechados_n = _safe_int(fr[4])

    localizados = max(total_ligacoes - nao_localizado, 0)
    contatados = max(total_ligacoes - nao_localizado - sem_contato, 0)
    funil = [
        TopItem(nome="Total de ligações", total=total_ligacoes),
        TopItem(nome="Localizados", total=localizados),
        TopItem(nome="Contatados", total=contatados),
        TopItem(nome="Agente Não Tabulou", total=agente_nao_tabulou),
        TopItem(nome="Negociação", total=negociacao_n),
        TopItem(nome="Fechados", total=fechados_n),
    ]

    # === 2) Operadores únicos ===
    sql_ops = (
        f"SELECT COUNT(DISTINCT operador) FROM metatron.TT_ACIONAMENTOS_METATRON {period_where}"
    )
    ops_raw = await _try_query(agent, sql_ops, limit=1)
    operadores_unicos = (
        _safe_int(ops_raw["rows"][0][0]) if ops_raw.get("rows") else 0
    )

    # === 3) Campanhas únicas ===
    sql_camps = (
        f"SELECT COUNT(DISTINCT campanha) FROM metatron.TT_ACIONAMENTOS_METATRON {period_where}"
    )
    camps_raw = await _try_query(agent, sql_camps, limit=1)
    campanhas_unicas = (
        _safe_int(camps_raw["rows"][0][0]) if camps_raw.get("rows") else 0
    )

    # === 4) Qualificações únicas ===
    sql_quals_count = (
        f"SELECT COUNT(DISTINCT descricao) FROM metatron.TT_ACIONAMENTOS_METATRON {period_where}"
    )
    quals_count_raw = await _try_query(agent, sql_quals_count, limit=1)
    qualificacoes_unicas = (
        _safe_int(quals_count_raw["rows"][0][0])
        if quals_count_raw.get("rows")
        else 0
    )

    # === 5) Duração (SUM e AVG separados) ===
    duracao_total_s = 0
    duracao_media_s = 0
    if total_ligacoes > 0:
        sql_dur = (
            "SELECT SUM(duracao) AS dur_total, AVG(duracao) AS dur_media "
            f"FROM metatron.TT_ACIONAMENTOS_METATRON {period_where}"
        )
        dur_raw = await _try_query(agent, sql_dur, limit=1)
        if dur_raw.get("rows"):
            r = dur_raw["rows"][0]
            duracao_total_s = _safe_int(r[0])
            duracao_media_s = _safe_int(r[1])

    # === 6) Volume diário ===
    sql_volume = (
        "SELECT data, COUNT(*) AS total, "
        f"SUM(CASE WHEN descricao IN ({_in_list(_NEGOCIACAO)}) THEN 1 ELSE 0 END) AS negociacao, "
        f"SUM(CASE WHEN descricao IN ({_in_list(_FECHADOS)}) THEN 1 ELSE 0 END) AS fechados "
        f"FROM metatron.TT_ACIONAMENTOS_METATRON {period_where} "
        "GROUP BY data ORDER BY data"
    )
    volume_raw = await _try_query(agent, sql_volume, limit=400)
    volume_diario = [
        VolumeDiarioPonto(
            data=str(r[0]).strip()[:10],
            total=_safe_int(r[1]),
            negociacao=_safe_int(r[2]),
            fechados=_safe_int(r[3]),
        )
        for r in volume_raw.get("rows", [])
        if len(r) >= 4 and r[0] is not None
    ]

    # === 7) Top qualificações ===
    sql_quals = (
        "SELECT descricao, COUNT(*) AS total "
        f"FROM metatron.TT_ACIONAMENTOS_METATRON {period_where} "
        "GROUP BY descricao ORDER BY total DESC"
    )
    quals_raw = await _try_query(agent, sql_quals, limit=100)
    top_qualificacoes = [
        TopItem(nome=str(r[0] or "—").strip() or "—", total=_safe_int(r[1]))
        for r in quals_raw.get("rows", [])
        if len(r) >= 2
    ][:8]

    # === 8) Top campanhas ===
    sql_campanhas = (
        "SELECT campanha, COUNT(*) AS total "
        f"FROM metatron.TT_ACIONAMENTOS_METATRON {period_where} "
        "GROUP BY campanha ORDER BY total DESC"
    )
    campanhas_raw = await _try_query(agent, sql_campanhas, limit=50)
    top_campanhas = [
        TopItem(nome=str(r[0] or "—").strip() or "—", total=_safe_int(r[1]))
        for r in campanhas_raw.get("rows", [])
        if len(r) >= 2
    ][:8]

    # === 9) Top operadores ===
    sql_operadores = (
        "SELECT operador, COUNT(*) AS total "
        f"FROM metatron.TT_ACIONAMENTOS_METATRON {period_where} "
        "GROUP BY operador ORDER BY total DESC"
    )
    operadores_raw = await _try_query(agent, sql_operadores, limit=200)
    top_operadores = [
        TopItem(nome=str(r[0] or "—").strip() or "—", total=_safe_int(r[1]))
        for r in operadores_raw.get("rows", [])
        if len(r) >= 2
    ][:10]

    return DashboardResult(
        total_ligacoes=total_ligacoes,
        fechados_total=fechados_n,
        funil=funil,
        operadores_unicos=operadores_unicos,
        campanhas_unicas=campanhas_unicas,
        qualificacoes_unicas=qualificacoes_unicas,
        duracao_media_s=duracao_media_s,
        duracao_total_s=duracao_total_s,
        volume_diario=volume_diario,
        top_qualificacoes=top_qualificacoes,
        top_campanhas=top_campanhas,
        top_operadores=top_operadores,
        top_campanha=top_campanhas[0] if top_campanhas else None,
        top_operador=top_operadores[0] if top_operadores else None,
        top_qualificacao=top_qualificacoes[0] if top_qualificacoes else None,
    )
