from pydantic import BaseModel


class QualificacoesQuery(BaseModel):
    data_inicio: str
    data_fim: str
    campanha: str | None = None
    operador: str | None = None


class QualificacaoItem(BaseModel):
    qualificacao: str
    quantidade: int
    percentual: float


class QualificacoesResult(BaseModel):
    total: int
    items: list[QualificacaoItem]
