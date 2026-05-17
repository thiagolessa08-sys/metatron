from datetime import datetime, timedelta, UTC
from jose import jwt, JWTError
from app.config import settings


def _now() -> datetime:
    return datetime.now(UTC)


def create_access_token(user_id: str, role: str) -> str:
    expire = _now() + timedelta(minutes=settings.jwt_access_minutes)
    return jwt.encode(
        {"sub": user_id, "role": role, "exp": expire, "type": "access"},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )


def create_refresh_token(user_id: str) -> str:
    expire = _now() + timedelta(days=settings.jwt_refresh_days)
    return jwt.encode(
        {"sub": user_id, "exp": expire, "type": "refresh"},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as e:
        raise ValueError(f"Token inválido: {e}") from e
