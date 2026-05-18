from pydantic import BaseModel


class AgenteAoVivo(BaseModel):
    operador: str
    total: int
    dur_media_s: int
    ultima_chamada: str | None = None


class OperacaoSnapshot(BaseModel):
    total_hoje: int
    agentes_ativos: int
    por_agente: list[AgenteAoVivo]
    atualizado_em: str
    data_referencia: str | None = None  # data efetiva usada (último dia com dados)
    is_today: bool = True  # False se caímos no fallback do último dia da base
