from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.auth.dependencies import require_role
from app.services.sybase_agent import SybaseAgentClient

router = APIRouter(prefix="/api/sql")


class SqlExecRequest(BaseModel):
    sql: str
    limit: int = 500


class SqlExecResult(BaseModel):
    columns: list[str]
    rows: list[list]
    row_count: int
    truncated: bool
    error: str | None = None


@router.post("/execute", response_model=SqlExecResult)
async def execute_sql(
    body: SqlExecRequest,
    _user=Depends(require_role("admin", "gestor")),
) -> SqlExecResult:
    agent = SybaseAgentClient()
    try:
        result = await agent.query(body.sql.strip(), limit=min(body.limit, 5000))
        return SqlExecResult(
            columns=result.get("columns", []),
            rows=result.get("rows", []),
            row_count=result.get("count", len(result.get("rows", []))),
            truncated=result.get("truncated", False),
        )
    except Exception as e:
        return SqlExecResult(
            columns=[],
            rows=[],
            row_count=0,
            truncated=False,
            error=str(e),
        )
