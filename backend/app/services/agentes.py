from app.services.sybase_agent import SybaseAgentClient
from app.services.dashboard_service import _NAO_LOCALIZADO, _SEM_CONTATO, _NEGOCIACAO, _FECHADOS, _in_list
from app.schemas.agentes import AgentesQuery, AgenteMetrica, AgentesResult

_TABLE = "metatron.TT_ACIONAMENTOS_METATRON"


def _safe(v: str) -> str:
    return v.replace("'", "''")


def _where(q: AgentesQuery) -> str:
    parts = [f"data >= '{_safe(q.data_inicio)}' AND data <= '{_safe(q.data_fim)}'"]
    if q.campanha:
        parts.append(f"campanha = '{_safe(q.campanha)}'")
    if q.operador:
        parts.append(f"operador = '{_safe(q.operador)}'")
    if q.empresa:
        parts.append(f"empresa = '{_safe(q.empresa)}'")
    return " AND ".join(parts)


async def get_agentes_metricas(q: AgentesQuery) -> AgentesResult:
    agent = SybaseAgentClient()
    where = _where(q)

    # Totais por agente com grupos de status do funil
    sql_totais = (
        f"SELECT operador, COUNT(*) AS total, "
        f"SUM(CASE WHEN descricao IN ({_in_list(_NAO_LOCALIZADO)}) THEN 1 ELSE 0 END) AS nao_localizado, "
        f"SUM(CASE WHEN descricao IN ({_in_list(_SEM_CONTATO)}) OR descricao IS NULL THEN 1 ELSE 0 END) AS sem_contato, "
        f"SUM(CASE WHEN descricao = 'Agente Nao Tabulou' THEN 1 ELSE 0 END) AS agente_nao_tabulou, "
        f"SUM(CASE WHEN descricao IN ({_in_list(_NEGOCIACAO)}) THEN 1 ELSE 0 END) AS negociacao, "
        f"SUM(CASE WHEN descricao IN ({_in_list(_FECHADOS)}) THEN 1 ELSE 0 END) AS fechados, "
        f"SUM(duracao) AS dur_total, AVG(duracao) AS dur_media "
        f"FROM {_TABLE} WHERE {where} AND operador IS NOT NULL "
        f"GROUP BY operador ORDER BY total DESC"
    )
    r_totais = await agent.query(sql_totais, limit=500)

    # Qualificações por agente
    sql_quals = (
        f"SELECT operador, descricao, COUNT(*) AS qtd "
        f"FROM {_TABLE} WHERE {where} AND operador IS NOT NULL AND descricao IS NOT NULL "
        f"GROUP BY operador, descricao"
    )
    r_quals = await agent.query(sql_quals, limit=2000)

    # Monta dict operador → {qualificacao: count}
    quals_map: dict[str, dict[str, int]] = {}
    for row in r_quals.get("rows", []):
        op = str(row[0]).strip() if row[0] else ""
        qual = str(row[1]).strip() if row[1] else "Sem qualificação"
        qtd = int(float(row[2])) if row[2] else 0
        quals_map.setdefault(op, {})[qual] = qtd

    def _si(v) -> int:
        try:
            return int(float(v)) if v is not None else 0
        except (ValueError, TypeError):
            return 0

    items = []
    for row in r_totais.get("rows", []):
        if len(row) < 9:
            continue
        op = str(row[0]).strip() if row[0] else "—"
        total      = _si(row[1])
        nao_loc    = _si(row[2])
        sem_cont   = _si(row[3])
        ag_ntab    = _si(row[4])
        neg        = _si(row[5])
        fech       = _si(row[6])
        dur_total  = _si(row[7])
        dur_media  = _si(row[8])
        localizados = max(total - nao_loc, 0)
        contatados  = max(total - nao_loc - sem_cont, 0)
        items.append(AgenteMetrica(
            operador=op,
            total_ligacoes=total,
            localizados=localizados,
            contatados=contatados,
            agente_nao_tabulou=ag_ntab,
            negociacao=neg,
            fechados=fech,
            duracao_total_s=dur_total,
            duracao_media_s=dur_media,
            qualificacoes=quals_map.get(op, {}),
        ))

    return AgentesResult(
        items=items,
        total_ligacoes=sum(i.total_ligacoes for i in items),
        total_duracao_s=sum(i.duracao_total_s for i in items),
    )
