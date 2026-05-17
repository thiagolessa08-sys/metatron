from pydantic import BaseModel


class ChamadasQuery(BaseModel):
    data_inicio: str | None = None
    data_fim: str | None = None
    resultado: str | None = None
    operadora: str | None = None


class ChamadaItem(BaseModel):
    data_hora: str
    numero: str
    operadora: str
    resultado: str
    duracao: str
    dur_min: str
    valor: str


class ChamadasResult(BaseModel):
    items: list[ChamadaItem]
    total: int
    truncated: bool
