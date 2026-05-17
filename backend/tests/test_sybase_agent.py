import pytest
import respx
import httpx
from app.services.sybase_agent import SybaseAgentClient

BASE = "http://test-agent"


@pytest.fixture
def agent(monkeypatch):
    monkeypatch.setenv("AGENT_URL", BASE)
    monkeypatch.setenv("AGENT_API_KEY", "test-key")
    from app import config as cfg
    cfg.settings.agent_url = BASE
    cfg.settings.agent_api_key = "test-key"
    return SybaseAgentClient()


@respx.mock
@pytest.mark.asyncio
async def test_health_returns_true_on_200(agent):
    respx.get(f"{BASE}/health").mock(return_value=httpx.Response(200, json={"status": "ok"}))
    assert await agent.health() is True


@respx.mock
@pytest.mark.asyncio
async def test_health_returns_false_on_error(agent):
    respx.get(f"{BASE}/health").mock(side_effect=httpx.ConnectError("offline"))
    assert await agent.health() is False


@respx.mock
@pytest.mark.asyncio
async def test_list_tables_returns_list(agent):
    respx.get(f"{BASE}/tables").mock(
        return_value=httpx.Response(
            200, json={"tables": [{"name": "tabela_a", "type": "BASE"}, {"name": "tabela_b", "type": "VIEW"}]}
        )
    )
    tables = await agent.list_tables()
    assert len(tables) == 2
    assert tables[0]["name"] == "tabela_a"
    assert tables[1]["name"] == "tabela_b"


@respx.mock
@pytest.mark.asyncio
async def test_get_schema_returns_columns(agent):
    raw_cols = [{"name": "id", "type": "INTEGER", "width": 4, "nullable": False}]
    respx.get(f"{BASE}/schema/usuarios").mock(
        return_value=httpx.Response(200, json={"table": "usuarios", "columns": raw_cols})
    )
    result = await agent.get_schema("usuarios")
    assert len(result) == 1
    assert result[0]["name"] == "id"
    assert result[0]["type"] == "INTEGER"


@respx.mock
@pytest.mark.asyncio
async def test_query_sends_api_key_header(agent):
    route = respx.post(f"{BASE}/query").mock(
        return_value=httpx.Response(
            200, json={"columns": ["id"], "rows": [[1]], "count": 1, "truncated": False}
        )
    )
    await agent.query("SELECT 1")
    assert route.called
    assert route.calls.last.request.headers.get("x-api-key") == "test-key"


@respx.mock
@pytest.mark.asyncio
async def test_query_returns_typed_structure(agent):
    payload = {"columns": ["nome"], "rows": [["João"]], "count": 1, "truncated": False}
    respx.post(f"{BASE}/query").mock(return_value=httpx.Response(200, json=payload))
    result = await agent.query("SELECT nome FROM agentes")
    assert result["columns"] == ["nome"]
    assert result["rows"] == [["João"]]
    assert result["count"] == 1
    assert result["truncated"] is False


@pytest.mark.asyncio
async def test_query_blocks_insert(agent):
    with pytest.raises(ValueError, match="SELECT"):
        await agent.query("INSERT INTO tabela VALUES (1)")


@pytest.mark.asyncio
async def test_query_blocks_drop(agent):
    with pytest.raises(ValueError):
        await agent.query("DROP TABLE usuarios")


@pytest.mark.asyncio
async def test_query_blocks_update(agent):
    with pytest.raises(ValueError):
        await agent.query("UPDATE agentes SET nome = 'x'")
