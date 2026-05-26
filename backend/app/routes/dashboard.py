from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_user
from app.models.user import User
from app.schemas.dashboard import DashboardQuery, DashboardResult, DateRangeResult
from app.services.dashboard_service import dashboard_executive, dashboard_date_range

router = APIRouter(prefix="/api/dashboard")


@router.get("/date-range", response_model=DateRangeResult)
async def date_range(user: User = Depends(get_current_user)) -> DateRangeResult:
    """Retorna MIN/MAX de data em TT_ACIONAMENTOS_METATRON.
    Útil para descobrir qual período tem dados na base."""
    return await dashboard_date_range()


@router.post("/executive", response_model=DashboardResult)
async def executive(
    body: DashboardQuery,
    user: User = Depends(get_current_user),
) -> DashboardResult:
    operador_forced: str | None = None
    if user.role == "consultor" and user.agente_id_sybase:
        operador_forced = user.agente_id_sybase
    return await dashboard_executive(
        data_inicio=body.data_inicio,
        data_fim=body.data_fim,
        campanha=body.campanha,
        operador=body.operador,
        operador_forced=operador_forced,
        empresa=body.empresa,
    )
