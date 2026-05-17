"""
Cliente HTTP para o Java Agent (proxy Sybase IQ via Cloudflare Tunnel).
Implementação completa na Tarefa 0.4.
"""
import re
import httpx
from app.config import settings

_BLOCKED_SQL = re.compile(
    r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE|GRANT|REVOKE)\b",
    re.IGNORECASE,
)

_HEADERS = {
    "X-API-Key": settings.agent_api_key,
    "Content-Type": "application/json",
}


class SybaseAgentClient:
    def __init__(self) -> None:
        self._base_url = settings.agent_url
        self._timeout = settings.agent_timeout_seconds

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            base_url=self._base_url,
            headers=_HEADERS,
            timeout=self._timeout,
        )

    async def health(self) -> bool:
        try:
            async with self._client() as c:
                r = await c.get("/health")
                return r.status_code == 200
        except Exception:
            return False

    async def list_tables(self) -> list[str]:
        async with self._client() as c:
            r = await c.get("/tables")
            r.raise_for_status()
            return r.json()

    async def get_schema(self, table: str) -> list[dict]:
        async with self._client() as c:
            r = await c.get(f"/schema/{table}")
            r.raise_for_status()
            return r.json()

    async def query(self, sql: str, limit: int | None = None) -> dict:
        if _BLOCKED_SQL.search(sql):
            raise ValueError("Apenas consultas SELECT são permitidas.")
        payload = {
            "sql": sql,
            "limit": limit or settings.agent_default_limit,
        }
        async with self._client() as c:
            for attempt in range(2):
                r = await c.post("/query", json=payload)
                if r.status_code < 500 or attempt == 1:
                    r.raise_for_status()
                    return r.json()
        raise RuntimeError("Falha na requisição ao agent após retry.")
