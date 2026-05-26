from pydantic import BaseModel, Field


class CockpitQuery(BaseModel):
    data_inicio: str = Field(..., description="yyyy-MM-dd")
    data_fim: str = Field(..., description="yyyy-MM-dd")
    campanha: str | None = None
    operador: str | None = None
    empresa: str | None = None


class HeatmapCell(BaseModel):
    dia_semana: int  # 0=segunda, 6=domingo
    hora: int  # 0-23
    valor: int


class PicoItem(BaseModel):
    dia_semana: int
    hora: int
    valor: int
    label: str


class VolumeDiario(BaseModel):
    data: str  # yyyy-MM-dd
    total: int


class DiaSemanaTotal(BaseModel):
    dia_semana: int  # 0-6
    label: str
    total: int


class TurnoTotal(BaseModel):
    nome: str  # Manhã / Tarde / Noite / Madrugada
    total: int


class DiaUtilFds(BaseModel):
    dia_util: int  # total ligações em dias úteis
    fim_de_semana: int  # total em sábado/domingo
    media_dia_util: int  # média por dia útil no período
    media_fds: int  # média por dia de fim de semana


class CockpitResult(BaseModel):
    heatmap: list[HeatmapCell]
    volume_diario: list[VolumeDiario]
    por_dia_semana: list[DiaSemanaTotal]
    por_turno: list[TurnoTotal]
    dia_util_fds: DiaUtilFds
    picos: list[PicoItem]
    total_periodo: int
    melhor_dia_semana: str | None
    melhor_turno: str | None
    pct_horario_comercial: float  # 8h-18h
    dia_recorde: str | None  # yyyy-MM-dd
    hora_pico: int | None  # 0-23
