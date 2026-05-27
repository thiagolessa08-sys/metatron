from fastapi import APIRouter, Depends, Query
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.schemas.filters import FilterItem, FilterOptions
from app.services.filter_options import get_filter_options, get_campanhas_by_empresa

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


@router.get("/campanhas", response_model=list[FilterItem])
async def campanhas_por_empresa(
    empresa: str = Query(...),
    _user: User = Depends(get_current_user),
):
    """Retorna campanhas pertencentes à empresa informada."""
    return await get_campanhas_by_empresa(empresa)
