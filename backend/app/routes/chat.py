from fastapi import APIRouter, Depends, HTTPException, status
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.schemas.chat import ChatRequest, ChatResponse, ChartHint
from app.services.nl_to_sql import nl_to_sql_and_run

router = APIRouter(prefix="/api/chat")


@router.post("/ask", response_model=ChatResponse)
async def chat_ask(
    body: ChatRequest,
    user: User = Depends(get_current_user),
) -> ChatResponse:
    # Consultor só vê dados do próprio operador
    operador_filter: str | None = None
    if user.role == "consultor" and user.agente_id_sybase:
        operador_filter = user.agente_id_sybase

    history = [{"role": m.role, "content": m.content} for m in body.history]

    result = await nl_to_sql_and_run(
        question=body.question,
        history=history,
        operador_filter=operador_filter,
    )

    chart_hint = None
    if result.get("chart_hint"):
        raw = result["chart_hint"]
        if isinstance(raw, dict):
            chart_hint = ChartHint(**raw)

    return ChatResponse(
        sql=result["sql"],
        columns=result["columns"],
        rows=result["rows"],
        row_count=result["row_count"],
        analysis=result["analysis"],
        chart_hint=chart_hint,
        error=result.get("error"),
    )
