import asyncio
import json
from fastapi import APIRouter, Depends, Query, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.auth.jwt import decode_token
from app.auth.dependencies import require_role
from app.database import get_db
from app.models.user import User
from app.services.operacao import get_snapshot

router = APIRouter(prefix="/api/operacao")

_INTERVAL_S = 30


def _auth_via_token(
    token: str = Query(default=""),
    db: Session = Depends(get_db),
) -> User:
    """Autenticação por query-param para EventSource (que não suporta headers)."""
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token ausente")
    try:
        payload = decode_token(token)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")
    if payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")
    user = db.query(User).filter(User.id == payload["sub"], User.active == True).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuário não encontrado")
    if user.role not in ("gestor", "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sem permissão")
    return user


async def _event_stream(interval: int):
    while True:
        try:
            snap = await get_snapshot()
            payload = snap.model_dump()
            yield f"data: {json.dumps(payload)}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"
        await asyncio.sleep(interval)


@router.get("/stream")
async def operacao_stream(
    interval: int = Query(default=_INTERVAL_S, ge=10, le=300),
    _user: User = Depends(_auth_via_token),
):
    return StreamingResponse(
        _event_stream(interval),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/snapshot")
async def operacao_snapshot(
    _user=Depends(require_role("gestor", "admin")),
):
    return await get_snapshot()
