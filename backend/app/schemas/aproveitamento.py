from pydantic import BaseModel


class AproveitamentoQuery(BaseModel):
    campanha: str | None = None
    servidor: str | None = None


class AproveitamentoItem(BaseModel):
    campanha: str
    total: int
    localizados: int
    em_contato: int
    contatados: int
    discados_total: int
    atendidas_hoje: int
    aproveitamento: float
    agendamentos_publicos: int
    agendamentos_privados: int


class AproveitamentoResult(BaseModel):
    items: list[AproveitamentoItem]
    totais: AproveitamentoItem | None = None
