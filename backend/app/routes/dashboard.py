from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_user
from app.models.user import User
from app.schemas.dashboard import DashboardQuery, DashboardResult
from app.services.dashboard_service import dashboard_executive

router = APIRouter(prefix="/api/dashboard")


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
    )
