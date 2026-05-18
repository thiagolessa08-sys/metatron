from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=1000)
    history: list[ChatMessage] = Field(default_factory=list)


class ChartHint(BaseModel):
    type: str  # "bar" | "line" | "pie" | "none"
    x_column: str | None = None
    y_column: str | None = None


class ChatResponse(BaseModel):
    sql: str
    columns: list[str]
    rows: list[list]
    row_count: int
    analysis: str
    chart_hint: ChartHint | None = None
    error: str | None = None
