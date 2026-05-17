"""
Descobre e documenta o schema do Sybase IQ via Java Agent.
Gera docs/superpowers/specs/2026-05-17-sybase-schema-map.md
"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.sybase_agent import SybaseAgentClient
from app.config import settings

OUTPUT = os.path.join(
    os.path.dirname(__file__), "..", "..",
    "docs", "superpowers", "specs", "2026-05-17-sybase-schema-map.md"
)


async def main():
    agent = SybaseAgentClient()

    if not await agent.health():
        print("ERRO: Agent inacessível. Verifique AGENT_URL e AGENT_API_KEY.")
        sys.exit(1)

    print("Listando tabelas do schema:", settings.sybase_schema)
    result = await agent.query(
        f"SELECT table_name FROM sys.systable "
        f"WHERE user_name(creator) = '{settings.sybase_schema}' "
        f"AND table_type IN ('BASE', 'VIEW') "
        f"ORDER BY table_name",
        limit=500,
    )

    tables = [row[0] for row in result["rows"]]
    print(f"  {len(tables)} tabelas encontradas.")

    lines = [
        f"# Schema Map — {settings.sybase_schema} ({settings.database_url.split('/')[-1] if '/' in settings.database_url else 'IQHML'})",
        f"\n**Gerado automaticamente por `discover_schema.py`**\n",
        f"## Tabelas e Colunas\n",
    ]

    for table in tables:
        print(f"  -> {table}")
        try:
            cols = await agent.get_schema(table)
            lines.append(f"### `{settings.sybase_schema}.{table}`\n")
            lines.append("| Coluna | Tipo | Nullable |")
            lines.append("|--------|------|----------|")
            for col in cols:
                nullable = "✓" if col.get("nullable") else "✗"
                lines.append(f"| `{col['name']}` | {col['type']} | {nullable} |")
            lines.append("")
        except Exception as e:
            lines.append(f"### `{table}` — erro ao obter schema: {e}\n")

    lines += [
        "## Mapeamento Lógico\n",
        "_Preencher manualmente após revisar as tabelas acima:_\n",
        "| Entidade Lógica | Tabela Real |",
        "|-----------------|-------------|",
        "| Agentes/Consultores | ??? |",
        "| Ligações/Chamadas | ??? |",
        "| Qualificações | ??? |",
        "| Pausas/Eventos | ??? |",
        "| Logins/Sessões | ??? |",
        "| Campanhas | ??? |",
        "| Listas | ??? |",
    ]

    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    with open(OUTPUT, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(f"\nSchema salvo em: {OUTPUT}")


asyncio.run(main())
