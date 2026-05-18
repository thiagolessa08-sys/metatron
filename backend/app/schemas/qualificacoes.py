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


class TendenciaPonto(BaseModel):
    data: str
    valores: dict[str, int]  # qualificacao -> total


class TendenciaResult(BaseModel):
    datas: list[str]
    qualificacoes: list[str]  # nomes das top N
    series: list[dict]  # [{nome: str, valores: [int]}]


class HeatmapResult(BaseModel):
    operadores: list[str]
    qualificacoes: list[str]
    matriz: list[list[int]]  # [op_idx][q_idx] = total
