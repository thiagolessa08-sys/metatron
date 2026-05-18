"""
Cliente HTTP para o Java Agent (proxy Sybase IQ via Cloudflare Tunnel).
"""
import re
import httpx
from app.config import settings

_BLOCKED_SQL = re.compile(
    r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE|GRANT|REVOKE)\b",
    re.IGNORECASE,
)

class SybaseAgentClient:
    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            base_url=settings.agent_url,
            headers={
                "X-API-Key": settings.agent_api_key,
                "Content-Type": "application/json",
            },
            timeout=settings.agent_timeout_seconds,
            verify=settings.agent_verify_ssl,
        )

    async def health(self) -> bool:
        try:
            async with self._client() as c:
                r = await c.get("/health")
                return r.status_code == 200
        except Exception:
            return False

    async def list_tables(self) -> list[dict]:
        """Retorna lista de dicts com 'name' e 'type' das tabelas do schema."""
        async with self._client() as c:
            r = await c.get("/tables")
            r.raise_for_status()
            data = r.json()
            # Agente retorna {"tables": [...]} ou lista direta
            tables = data.get("tables", data) if isinstance(data, dict) else data
            return [
                {"name": t["name"].strip(), "type": t.get("type", "").strip()}
                for t in tables
                if isinstance(t, dict)
            ]

    async def get_schema(self, table: str) -> list[dict]:
        """Retorna lista de colunas com name, type, width, nullable."""
        async with self._client() as c:
            r = await c.get(f"/schema/{table}")
            r.raise_for_status()
            data = r.json()
            # Agente retorna {"table": "...", "columns": [...]}
            cols = data.get("columns", data) if isinstance(data, dict) else data
            return [
                {
                    "name": c["name"].strip(),
                    "type": c.get("type", "").strip(),
                    "width": c.get("width"),
                    "nullable": c.get("nullable", True),
                }
                for c in cols
                if isinstance(c, dict)
            ]

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
                    if not r.is_success:
                        # Captura o corpo do erro para diagnóstico
                        try:
                            detail = r.json()
                        except Exception:
                            detail = r.text[:500]
                        raise RuntimeError(
                            f"Agent retornou {r.status_code}: {detail}"
                        )
                    return r.json()
        raise RuntimeError("Falha na requisição ao agent após retry.")
