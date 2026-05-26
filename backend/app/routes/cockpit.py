from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_user
from app.models.user import User
from app.schemas.cockpit import CockpitQuery, CockpitResult
from app.services.cockpit_service import cockpit_heatmap

router = APIRouter(prefix="/api/cockpit")


@router.post("/heatmap", response_model=CockpitResult)
async def heatmap(
    body: CockpitQuery,
    user: User = Depends(get_current_user),
) -> CockpitResult:
    operador_forced: str | None = None
    if user.role == "consultor" and user.agente_id_sybase:
        operador_forced = user.agente_id_sybase
    return await cockpit_heatmap(
        data_inicio=body.data_inicio,
        data_fim=body.data_fim,
        campanha=body.campanha,
        operador=body.operador,
        operador_forced=operador_forced,
        empresa=body.empresa,
    )
