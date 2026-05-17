import time
from app.services.sybase_agent import SybaseAgentClient
from app.schemas.filters import FilterItem, FilterOptions

_cache: dict = {}
_TTL = 300  # 5 minutos

_TABLE = "metatron.TT_ACIONAMENTOS_METATRON"


async def get_filter_options() -> FilterOptions:
    now = time.time()
    if "options" in _cache and now - _cache["ts"] < _TTL:
        return _cache["options"]

    agent = SybaseAgentClient()

    async def distinct(col: str) -> list[FilterItem]:
        try:
            r = await agent.query(
                f"SELECT DISTINCT {col} FROM {_TABLE} WHERE {col} IS NOT NULL ORDER BY {col}",
                limit=500,
            )
            return [FilterItem(id=str(row[0]).strip(), label=str(row[0]).strip()) for row in r["rows"] if row[0]]
        except Exception:
            return []

    campanhas = await distinct("campanha")
    operadores = await distinct("operador")
    qualificacoes = await distinct("descricao")

    options = FilterOptions(campanhas=campanhas, operadores=operadores, qualificacoes=qualificacoes)
    _cache["options"] = options
    _cache["ts"] = now
    return options
