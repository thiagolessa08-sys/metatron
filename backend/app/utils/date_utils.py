"""
Conversão de datas para Sybase IQ.

A coluna `data` em TT_ACIONAMENTOS_METATRON é armazenada como VARCHAR no formato
dd/MM/yyyy (ex: "01/04/2026"), não yyyy-MM-dd. Todas as comparações SQL precisam
usar o formato do banco; o frontend e a API retornam sempre ISO (yyyy-MM-dd).
"""
from datetime import datetime


def to_sybase_date(iso_date: str) -> str:
    """Converte 'yyyy-MM-dd' → 'dd/MM/yyyy' para usar em WHERE clauses do Sybase."""
    try:
        dt = datetime.strptime(iso_date.strip(), "%Y-%m-%d")
        return dt.strftime("%d/%m/%Y")
    except (ValueError, AttributeError):
        return iso_date


def from_sybase_date(dmy_date: str) -> str:
    """Converte 'dd/MM/yyyy' → 'yyyy-MM-dd' para retornar ao frontend."""
    if not dmy_date:
        return dmy_date
    text = str(dmy_date).strip()
    try:
        dt = datetime.strptime(text, "%d/%m/%Y")
        return dt.strftime("%Y-%m-%d")
    except (ValueError, AttributeError):
        return text


def parse_sybase_date(dmy_date: str) -> datetime | None:
    """Converte 'dd/MM/yyyy' → objeto datetime (ou None se inválido)."""
    if not dmy_date:
        return None
    try:
        return datetime.strptime(str(dmy_date).strip(), "%d/%m/%Y")
    except (ValueError, AttributeError):
        return None
