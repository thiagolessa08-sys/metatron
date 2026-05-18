from fastapi import APIRouter, Depends
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.schemas.filters import FilterItem, FilterOptions
from app.services.filter_options import get_filter_options

router = APIRouter(prefix="/api/filters")


@router.get("/options", response_model=FilterOptions)
async def filter_options(user: User = Depends(get_current_user)):
    options = await get_filter_options()
    if user.role == "consultor" and user.agente_id_sybase:
        own = FilterItem(id=user.agente_id_sybase, label=user.agente_id_sybase)
        return FilterOptions(
            campanhas=options.campanhas,
            operadores=[own],
            qualificacoes=options.qualificacoes,
        )
    return options
