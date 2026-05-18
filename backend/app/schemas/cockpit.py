from pydantic import BaseModel, Field


class CockpitQuery(BaseModel):
    data_inicio: str = Field(..., description="yyyy-MM-dd")
    data_fim: str = Field(..., description="yyyy-MM-dd")


class HeatmapCell(BaseModel):
    dia_semana: int  # 0=segunda, 6=domingo
    hora: int  # 0-23
    valor: int


class PicoItem(BaseModel):
    dia_semana: int
    hora: int
    valor: int
    label: str


class ComparativoSerie(BaseModel):
    hora: int
    valor: int


class CockpitResult(BaseModel):
    heatmap: list[HeatmapCell]
    comparativo_hoje: list[ComparativoSerie]
    comparativo_media7d: list[ComparativoSerie]
    picos: list[PicoItem]
    total_periodo: int
