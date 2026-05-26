from pydantic import BaseModel


class AgentesQuery(BaseModel):
    data_inicio: str
    data_fim: str
    campanha: str | None = None
    operador: str | None = None
    empresa: str | None = None


class AgenteMetrica(BaseModel):
    operador: str
    total_ligacoes: int
    duracao_total_s: int
    duracao_media_s: int
    qualificacoes: dict[str, int]


class AgentesResult(BaseModel):
    items: list[AgenteMetrica]
    total_ligacoes: int
    total_duracao_s: int
