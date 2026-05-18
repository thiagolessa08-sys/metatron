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
    operador_filter: str | None = None
    if user.role == "consultor" and user.agente_id_sybase:
        operador_filter = user.agente_id_sybase
    return await cockpit_heatmap(body.data_inicio, body.data_fim, operador_filter)
