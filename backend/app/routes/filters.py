from fastapi import APIRouter, Depends
from app.auth.dependencies import get_current_user
from app.schemas.filters import FilterOptions
from app.services.filter_options import get_filter_options

router = APIRouter(prefix="/api/filters")


@router.get("/options", response_model=FilterOptions)
async def filter_options(_user=Depends(get_current_user)):
    return await get_filter_options()
