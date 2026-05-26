from pydantic import BaseModel


class FilterItem(BaseModel):
    id: str
    label: str


class FilterOptions(BaseModel):
    campanhas: list[FilterItem]
    operadores: list[FilterItem]
    qualificacoes: list[FilterItem]
    empresas: list[FilterItem]
