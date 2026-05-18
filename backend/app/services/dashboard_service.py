"""
Dashboard executivo: agregações para a tela inicial.
Usa apenas TT_ACIONAMENTOS_METATRON (única tabela segura para COUNT/SUM).
"""
from app.services.sybase_agent import SybaseAgentClient
from app.schemas.dashboard import (
    DashboardResult,
    VolumeDiarioPonto,
    TopItem,
)


async def dashboard_executive(
    data_inicio: str,
    data_fim: str,
    campanha: str | None = None,
    operador: str | None = None,
    operador_forced: str | None = None,
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

    period_where = (
        f"WHERE data BETWEEN '{data_inicio}' AND '{data_fim}'{where_extra}"
    )

    # 1) Totais e métricas únicas
    sql_totais = (
        "SELECT COUNT(*) AS total, "
        "COUNT(DISTINCT operador) AS operadores, "
        "COUNT(DISTINCT campanha) AS campanhas, "
        "COUNT(DISTINCT descricao) AS qualificacoes, "
        "SUM(duracao) AS dur_total, "
        "AVG(duracao) AS dur_media "
        f"FROM metatron.TT_ACIONAMENTOS_METATRON {period_where}"
    )
    totais_raw = await agent.query(sql_totais, limit=1)
    total_ligacoes = 0
    operadores_unicos = 0
    campanhas_unicas = 0
    qualificacoes_unicas = 0
    duracao_total_s = 0
    duracao_media_s = 0
    rows = totais_raw.get("rows") or []
    if rows:
        r = rows[0]
        total_ligacoes = int(r[0] or 0)
        operadores_unicos = int(r[1] or 0)
        campanhas_unicas = int(r[2] or 0)
        qualificacoes_unicas = int(r[3] or 0)
        duracao_total_s = int(r[4] or 0)
        duracao_media_s = int(r[5] or 0) if r[5] is not None else 0

    # 2) Volume diário
    sql_volume = (
        "SELECT data, COUNT(*) AS total "
        f"FROM metatron.TT_ACIONAMENTOS_METATRON {period_where} "
        "GROUP BY data ORDER BY data"
    )
    volume_raw = await agent.query(sql_volume, limit=400)
    volume_diario = [
        VolumeDiarioPonto(data=str(r[0]).strip(), total=int(r[1] or 0))
        for r in volume_raw.get("rows", [])
        if len(r) >= 2 and r[0] is not None
    ]

    # 3) Top qualificações
    sql_quals = (
        "SELECT descricao, COUNT(*) AS total "
        f"FROM metatron.TT_ACIONAMENTOS_METATRON {period_where} "
        "GROUP BY descricao ORDER BY total DESC"
    )
    quals_raw = await agent.query(sql_quals, limit=100)
    top_qualificacoes = [
        TopItem(nome=str(r[0] or "—").strip() or "—", total=int(r[1] or 0))
        for r in quals_raw.get("rows", [])
        if len(r) >= 2
    ][:8]

    # 4) Top campanhas
    sql_campanhas = (
        "SELECT campanha, COUNT(*) AS total "
        f"FROM metatron.TT_ACIONAMENTOS_METATRON {period_where} "
        "GROUP BY campanha ORDER BY total DESC"
    )
    campanhas_raw = await agent.query(sql_campanhas, limit=50)
    top_campanhas = [
        TopItem(nome=str(r[0] or "—").strip() or "—", total=int(r[1] or 0))
        for r in campanhas_raw.get("rows", [])
        if len(r) >= 2
    ][:8]

    # 5) Top operadores
    sql_operadores = (
        "SELECT operador, COUNT(*) AS total "
        f"FROM metatron.TT_ACIONAMENTOS_METATRON {period_where} "
        "GROUP BY operador ORDER BY total DESC"
    )
    operadores_raw = await agent.query(sql_operadores, limit=200)
    top_operadores = [
        TopItem(nome=str(r[0] or "—").strip() or "—", total=int(r[1] or 0))
        for r in operadores_raw.get("rows", [])
        if len(r) >= 2
    ][:10]

    return DashboardResult(
        total_ligacoes=total_ligacoes,
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
