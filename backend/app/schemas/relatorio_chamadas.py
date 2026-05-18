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


class FaixaDuracao(BaseModel):
    faixa: str
    total: int


class HoraBucket(BaseModel):
    hora: int
    total: int


class OperadoraBucket(BaseModel):
    nome: str
    total: int


class ChamadasResumo(BaseModel):
    total: int
    duracao_total_s: int
    duracao_media_s: int
    custo_total: float
    custo_medio: float
    operadora_dominante: str | None
    pct_longas: float  # >2min
    por_duracao: list[FaixaDuracao]
    por_hora: list[HoraBucket]
    por_operadora: list[OperadoraBucket]
