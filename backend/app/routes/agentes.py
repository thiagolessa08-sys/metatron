from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from app.auth.dependencies import get_current_user, require_role
from app.schemas.agentes import AgentesQuery, AgentesResult
from app.schemas.relatorio_chamadas import ChamadasQuery, ChamadasResult
from app.services.agentes import get_agentes_metricas
from app.services.relatorio_chamadas import get_chamadas
from app.services.export import to_csv, to_xlsx

router = APIRouter(prefix="/api/agentes")


@router.post("/metricas", response_model=AgentesResult)
async def agentes_metricas(
    q: AgentesQuery,
    fmt: str = Query(default="json", alias="format"),
    _user=Depends(get_current_user),
):
    result = await get_agentes_metricas(q)
    if fmt in ("csv", "xlsx"):
        headers = ["Operador", "Ligações", "Duração Total (s)", "Duração Média (s)"]
        rows = [[i.operador, i.total_ligacoes, i.duracao_total_s, i.duracao_media_s] for i in result.items]
        if fmt == "csv":
            return StreamingResponse(
                iter([to_csv(rows, headers)]),
                media_type="text/csv",
                headers={"Content-Disposition": "attachment; filename=agentes.csv"},
            )
        return StreamingResponse(
            iter([to_xlsx(rows, headers, "Agentes")]),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=agentes.xlsx"},
        )
    return result


@router.post("/chamadas", response_model=ChamadasResult)
async def relatorio_chamadas(
    q: ChamadasQuery,
    fmt: str = Query(default="json", alias="format"),
    _user=Depends(require_role("gestor", "admin")),
):
    result = await get_chamadas(q)
    if fmt in ("csv", "xlsx"):
        headers = ["Data/Hora", "Número", "Operadora", "Resultado", "Duração", "Min", "Valor"]
        rows = [[i.data_hora, i.numero, i.operadora, i.resultado, i.duracao, i.dur_min, i.valor]
                for i in result.items]
        if fmt == "csv":
            return StreamingResponse(
                iter([to_csv(rows, headers)]),
                media_type="text/csv",
                headers={"Content-Disposition": "attachment; filename=chamadas.csv"},
            )
        return StreamingResponse(
            iter([to_xlsx(rows, headers, "Chamadas")]),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=chamadas.xlsx"},
        )
    return result
