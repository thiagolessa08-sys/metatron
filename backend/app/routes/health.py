from fastapi import APIRouter
from app.services.sybase_agent import SybaseAgentClient
from app.config import settings

router = APIRouter()
_agent = SybaseAgentClient()


@router.get("/health")
async def health():
    return {"status": "ok", "service": "api"}


@router.get("/health/full")
async def health_full():
    agent_ok = await _agent.health()
    return {
        "status": "ok" if agent_ok else "degraded",
        "service": "api",
        "agent": "ok" if agent_ok else "unavailable",
        "agent_url": settings.agent_url,
    }
