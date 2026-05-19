from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.schemas.qualificacoes import (
    QualificacoesQuery,
    QualificacoesResult,
    TendenciaResult,
    HeatmapResult,
)
from app.schemas.aproveitamento import AproveitamentoQuery, AproveitamentoResult
from app.services.relatorio_qualificacoes import get_qualificacoes
from app.services.relatorio_aproveitamento import get_aproveitamento, list_empresas
from app.services.qualificacoes_extras import (
    tendencia_qualificacoes,
    heatmap_operador_qualificacao,
)
from app.services.export import to_csv, to_xlsx

router = APIRouter(prefix="/api/relatorios")


@router.post("/qualificacoes", response_model=QualificacoesResult)
async def relatorio_qualificacoes(
    q: QualificacoesQuery,
    fmt: str = Query(default="json", alias="format"),
    user: User = Depends(get_current_user),
):
    if user.role == "consultor" and user.agente_id_sybase:
        q.operador = user.agente_id_sybase
    result = await get_qualificacoes(q)
    if fmt == "csv":
        headers = ["Qualificação", "Quantidade", "% do Total"]
        rows = [[i.qualificacao, i.quantidade, i.percentual] for i in result.items]
        return StreamingResponse(
            iter([to_csv(rows, headers)]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=qualificacoes.csv"},
        )
    if fmt == "xlsx":
        headers = ["Qualificação", "Quantidade", "% do Total"]
        rows = [[i.qualificacao, i.quantidade, i.percentual] for i in result.items]
        return StreamingResponse(
            iter([to_xlsx(rows, headers, "Qualificações")]),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=qualificacoes.xlsx"},
        )
    return result


@router.post("/qualificacoes/tendencia", response_model=TendenciaResult)
async def relatorio_qualificacoes_tendencia(
    q: QualificacoesQuery,
    user: User = Depends(get_current_user),
):
    operador_forced = None
    if user.role == "consultor" and user.agente_id_sybase:
        operador_forced = user.agente_id_sybase
    return await tendencia_qualificacoes(q, operador_forced=operador_forced, top_n=5)


@router.post("/qualificacoes/heatmap", response_model=HeatmapResult)
async def relatorio_qualificacoes_heatmap(
    q: QualificacoesQuery,
    user: User = Depends(get_current_user),
):
    operador_forced = None
    if user.role == "consultor" and user.agente_id_sybase:
        operador_forced = user.agente_id_sybase
    return await heatmap_operador_qualificacao(
        q, operador_forced=operador_forced, top_op=10, top_q=10
    )


@router.get("/aproveitamento/empresas", response_model=list[str])
async def aproveitamento_empresas(_user: User = Depends(get_current_user)):
    return await list_empresas()


@router.post("/aproveitamento", response_model=AproveitamentoResult)
async def relatorio_aproveitamento(
    q: AproveitamentoQuery,
    fmt: str = Query(default="json", alias="format"),
    _user: User = Depends(get_current_user),
):
    result = await get_aproveitamento(q)
    if fmt == "csv":
        headers = ["Campanha", "Total", "Localizados", "Em Contato", "Contatados",
                   "Discados", "Atendidas Hoje", "Aproveitamento %", "Ag. Públicos", "Ag. Privados"]
        rows = [[i.campanha, i.total, i.localizados, i.em_contato, i.contatados,
                 i.discados_total, i.atendidas_hoje, i.aproveitamento,
                 i.agendamentos_publicos, i.agendamentos_privados] for i in result.items]
        return StreamingResponse(
            iter([to_csv(rows, headers)]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=aproveitamento.csv"},
        )
    if fmt == "xlsx":
        headers = ["Campanha", "Total", "Localizados", "Em Contato", "Contatados",
                   "Discados", "Atendidas Hoje", "Aproveitamento %", "Ag. Públicos", "Ag. Privados"]
        rows = [[i.campanha, i.total, i.localizados, i.em_contato, i.contatados,
                 i.discados_total, i.atendidas_hoje, i.aproveitamento,
                 i.agendamentos_publicos, i.agendamentos_privados] for i in result.items]
        return StreamingResponse(
            iter([to_xlsx(rows, headers, "Aproveitamento")]),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=aproveitamento.xlsx"},
        )
    return result
