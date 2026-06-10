from pydantic import BaseModel, Field


class DateRangeResult(BaseModel):
    min_data: str | None
    max_data: str | None
    total: int


class DashboardQuery(BaseModel):
    data_inicio: str = Field(..., description="yyyy-MM-dd")
    data_fim: str = Field(..., description="yyyy-MM-dd")
    campanha: str | None = None
    operador: str | None = None
    empresa: str | None = None


class VolumeDiarioPonto(BaseModel):
    data: str
    total: int


class TopItem(BaseModel):
    nome: str
    total: int


class DashboardResult(BaseModel):
    # KPIs
    total_ligacoes: int
    fechados_total: int
    operadores_unicos: int
    campanhas_unicas: int
    duracao_media_s: int
    duracao_total_s: int
    qualificacoes_unicas: int
    # Funil de conversão (Total → Localizados → Contatados → Agente Não Tabulou → Negociação → Fechados)
    funil: list[TopItem]
    # Volume
    volume_diario: list[VolumeDiarioPonto]
    # Rankings
    top_qualificacoes: list[TopItem]
    top_campanhas: list[TopItem]
    top_operadores: list[TopItem]
    # Destaques
    top_campanha: TopItem | None
    top_operador: TopItem | None
    top_qualificacao: TopItem | None
