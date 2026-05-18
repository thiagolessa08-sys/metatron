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
