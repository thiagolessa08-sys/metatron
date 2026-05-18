"""
Serviço NL→SQL usando Claude Haiku via Anthropic SDK.
Fluxo: pergunta → SQL → validação → execução → análise em texto.
"""
import json
import re
from anthropic import AsyncAnthropic

from app.config import settings
from app.services.sql_validator import validate_and_fix, SqlValidationError
from app.services.sybase_agent import SybaseAgentClient

# Schema resumido para o system prompt — apenas colunas relevantes
_SCHEMA_CONTEXT = """
## Schema disponível (Sybase IQ — metatron)

### metatron.TT_ACIONAMENTOS_METATRON
Registro de cada ligação/acionamento realizado.
Colunas:
- campanha (varchar), cpf (varchar), telefone (varchar)
- data (varchar, formato 'YYYY-MM-DD') — use comparação direta como string: WHERE data = '2026-05-17'
- hora (varchar)
- duracao (INTEGER real) — único campo numérico real; SUM/AVG funcionam sem CAST
- operador (varchar), descricao (varchar, qualificação da chamada), desligou (varchar)

### metatron.TT_METRICAS_METATRON
Métricas agregadas por campanha/fila.
ATENÇÃO: todas as colunas numéricas são armazenadas como VARCHAR no banco.
Para fazer SUM, AVG ou comparações numéricas use CAST(coluna AS NUMERIC).
Colunas:
- empresa (varchar), fila (varchar), campanha (varchar)
- total (varchar→número), localizados (varchar→número), em_contato (varchar→número)
- contatados (varchar→número), descartados (varchar→número)
- aproveitamento (varchar→número, percentual 0-100)
- discados_total (varchar→número), atendidas_hoje (varchar→número)
- hora (varchar), ativo (varchar, '1'=ativa '0'=inativa)

### metatron.TT_RELATORIO_METATRON
Detalhamento de chamadas com tarifação.
ATENÇÃO: todas as colunas são VARCHAR, incluindo duracao e Valor.
Use CAST(duracao AS NUMERIC) ou CAST(Valor AS NUMERIC) se precisar de soma/média.
Colunas:
- data_hora (varchar), numero (varchar), Operadora (varchar)
- tarifa (varchar), resultado (varchar)
- duracao (varchar→número, em segundos), Valor (varchar→número, custo em R$)
"""

_SYSTEM_PROMPT = f"""Você é um analista de dados especialista em Sybase IQ para uma central de discagem (call center).
Você recebe perguntas em português e gera **apenas SQL Sybase IQ** correto e performático.

{_SCHEMA_CONTEXT}

## Regras obrigatórias de SQL para Sybase IQ (column-store):

1. **Nunca use UPPER(), LOWER() ou TRIM() em colunas** — quebra o índice HG/LF.
   Errado: WHERE UPPER(operador) = 'JOAO'
   Certo:  WHERE operador = 'JOAO'

2. **Nunca use SELECT *** — liste sempre as colunas explicitamente.
   Errado: SELECT * FROM metatron.TT_ACIONAMENTOS_METATRON
   Certo:  SELECT TOP 100 operador, COUNT(*) AS total FROM metatron.TT_ACIONAMENTOS_METATRON

3. **Datas: use BETWEEN com literais 'YYYY-MM-DD'** — nunca YEAR(), MONTH() ou DATE() na coluna.
   Errado: WHERE YEAR(data) = 2026
   Certo:  WHERE data BETWEEN '2026-01-01' AND '2026-12-31'

4. **LIKE: nunca wildcard no início** — LIKE '%texto' força full scan.
   Errado: WHERE descricao LIKE '%CONVER%'
   Certo:  WHERE descricao = 'CONVERSAO'  (ou LIKE 'CONVER%')

5. **Não use TOP N nem LIMIT N** — o sistema já limita automaticamente os resultados via parâmetro separado. Escreva apenas o SELECT sem cláusula de limite.

6. **ORDER BY é permitido** — use quando fizer sentido ordenar (ex: ORDER BY total DESC).

7. **Sem subqueries correlacionadas** — use JOIN ou CTE.

8. **DISTINCT é mais caro que GROUP BY** — prefira GROUP BY.

9. **Joins: tabela com menos linhas à esquerda, sempre com ON explícito**.

10. **CAST obrigatório em colunas varchar numéricas** — Em TT_METRICAS_METATRON e TT_RELATORIO_METATRON
    todas as colunas de valor são VARCHAR. Sybase IQ NÃO faz cast implícito (erro -1001006).
    Errado: SUM(total), AVG(aproveitamento), SUM(Valor)
    Certo:  SUM(CAST(total AS NUMERIC)), AVG(CAST(aproveitamento AS NUMERIC)), SUM(CAST(Valor AS NUMERIC))
    Exceção: em TT_ACIONAMENTOS_METATRON o campo duracao é INTEGER real — não precisa de CAST.

## Formato de resposta

Responda APENAS com JSON no formato abaixo, sem markdown, sem explicação:
{{
  "sql": "SELECT operador, COUNT(*) AS total FROM ...",
  "chart_hint": {{
    "type": "bar",
    "x_column": "operador",
    "y_column": "total"
  }}
}}

`chart_hint` é opcional — inclua apenas quando o resultado se beneficiar de visualização.
Tipos aceitos: "bar", "line", "pie", "none".
Se não houver gráfico adequado, omita o campo chart_hint.

## Exemplos

Pergunta: "Quantas ligações por operador hoje?"
Resposta:
{{"sql": "SELECT operador, COUNT(*) AS total FROM metatron.TT_ACIONAMENTOS_METATRON WHERE data = '2026-05-17' GROUP BY operador ORDER BY total DESC", "chart_hint": {{"type": "bar", "x_column": "operador", "y_column": "total"}}}}

Pergunta: "Qual o aproveitamento das campanhas ativas?"
Resposta:
{{"sql": "SELECT campanha, aproveitamento, discados_total, atendidas_hoje FROM metatron.TT_METRICAS_METATRON WHERE ativo = '1'", "chart_hint": {{"type": "bar", "x_column": "campanha", "y_column": "aproveitamento"}}}}

Pergunta: "Qual operador ficou mais tempo em ligação na semana passada?"
Resposta:
{{"sql": "SELECT operador, SUM(duracao) AS tempo_total_s FROM metatron.TT_ACIONAMENTOS_METATRON WHERE data BETWEEN '2026-05-10' AND '2026-05-16' GROUP BY operador ORDER BY tempo_total_s DESC", "chart_hint": {{"type": "bar", "x_column": "operador", "y_column": "tempo_total_s"}}}}
"""

_ANALYSIS_SYSTEM = """Você é um analista de dados de call center.
Você recebe uma pergunta, o SQL gerado e os resultados da consulta.
Forneça uma análise clara e objetiva em português (3-5 frases).
Destaque o ponto mais importante, padrões relevantes e qualquer anomalia.
Não mencione SQL ou detalhes técnicos — foque no negócio."""


def _extract_json(text: str) -> dict:
    """Extrai o primeiro bloco JSON válido do texto do LLM."""
    text = text.strip()
    # Remove markdown code fences se presentes
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Tenta encontrar o primeiro { ... }
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if m:
            return json.loads(m.group())
        raise ValueError(f"LLM não retornou JSON válido: {text[:200]}")


async def nl_to_sql_and_run(
    question: str,
    history: list[dict],
    operador_filter: str | None = None,
) -> dict:
    """
    Converte pergunta em SQL, valida, executa e retorna análise.

    Args:
        question: Pergunta do usuário em português.
        history: Mensagens anteriores [{"role": "user"|"assistant", "content": str}].
        operador_filter: Se preenchido (consultor), injeta WHERE operador = ? no SQL.

    Returns:
        {
          "sql": str,
          "columns": list[str],
          "rows": list[list],
          "row_count": int,
          "analysis": str,
          "chart_hint": dict | None,
          "error": str | None,
        }
    """
    client = AsyncAnthropic(api_key=settings.anthropic_api_key)

    # Monta histórico de mensagens para contexto conversacional
    messages: list[dict] = []
    for h in history[-6:]:  # Últimas 6 trocas para não explodir o contexto
        if h.get("role") in ("user", "assistant") and h.get("content"):
            messages.append({"role": h["role"], "content": str(h["content"])})
    messages.append({"role": "user", "content": question})

    # Passo 1: Gerar SQL
    sql_raw = ""
    chart_hint = None
    try:
        resp = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=512,
            system=_SYSTEM_PROMPT,
            messages=messages,
        )
        raw_text = resp.content[0].text
        parsed = _extract_json(raw_text)
        sql_raw = parsed.get("sql", "").strip()
        chart_hint = parsed.get("chart_hint")
    except Exception as e:
        return {
            "sql": "",
            "columns": [],
            "rows": [],
            "row_count": 0,
            "analysis": "",
            "chart_hint": None,
            "error": f"Erro ao gerar SQL: {e}",
        }

    # Passo 2: Injetar filtro de consultor ANTES da validação
    if operador_filter and sql_raw:
        safe_op = operador_filter.replace("'", "''")
        # Injeta antes do GROUP BY / ORDER BY / final
        if re.search(r"\bWHERE\b", sql_raw, re.IGNORECASE):
            sql_raw = re.sub(
                r"(\bWHERE\b)",
                f"WHERE operador = '{safe_op}' AND ",
                sql_raw,
                count=1,
                flags=re.IGNORECASE,
            )
        else:
            # Insere WHERE antes de GROUP BY / ORDER BY ou no final
            insert_before = re.search(r"\b(GROUP BY|ORDER BY|TOP\s+\d+\s+\w)", sql_raw, re.IGNORECASE)
            if insert_before:
                pos = insert_before.start()
                sql_raw = sql_raw[:pos] + f"WHERE operador = '{safe_op}' " + sql_raw[pos:]
            else:
                sql_raw += f" WHERE operador = '{safe_op}'"

    # Passo 3: Validar e corrigir SQL
    try:
        sql_clean = validate_and_fix(sql_raw)
    except SqlValidationError as e:
        # Tenta uma segunda geração com a mensagem de erro como feedback
        try:
            feedback_msg = (
                f"O SQL gerado violou regras do Sybase IQ: {e}\n"
                "Corrija o SQL seguindo EXATAMENTE as regras do system prompt."
            )
            retry_messages = messages + [
                {"role": "assistant", "content": json.dumps({"sql": sql_raw})},
                {"role": "user", "content": feedback_msg},
            ]
            resp2 = await client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=512,
                system=_SYSTEM_PROMPT,
                messages=retry_messages,
            )
            parsed2 = _extract_json(resp2.content[0].text)
            sql_raw = parsed2.get("sql", "").strip()
            chart_hint = parsed2.get("chart_hint", chart_hint)
            if operador_filter and sql_raw:
                safe_op = operador_filter.replace("'", "''")
                if not re.search(rf"operador\s*=\s*'{re.escape(safe_op)}'", sql_raw, re.IGNORECASE):
                    sql_raw += f" -- filtro consultor aplicado"
            sql_clean = validate_and_fix(sql_raw)
        except SqlValidationError as e2:
            return {
                "sql": sql_raw,
                "columns": [],
                "rows": [],
                "row_count": 0,
                "analysis": "",
                "chart_hint": None,
                "error": f"Não foi possível gerar SQL válido: {e2}",
            }
        except Exception as e2:
            return {
                "sql": sql_raw,
                "columns": [],
                "rows": [],
                "row_count": 0,
                "analysis": "",
                "chart_hint": None,
                "error": f"Erro na segunda tentativa: {e2}",
            }

    # Passo 4: Executar no Sybase Agent
    try:
        agent = SybaseAgentClient()
        result = await agent.query(sql_clean, limit=500)
        columns: list[str] = result.get("columns", [])
        rows: list[list] = result.get("rows", [])
    except Exception as e:
        return {
            "sql": sql_clean,
            "columns": [],
            "rows": [],
            "row_count": 0,
            "analysis": "",
            "chart_hint": chart_hint,
            "error": f"Erro ao executar consulta: {e}",
        }

    # Passo 5: Gerar análise textual
    analysis = ""
    if rows:
        preview = json.dumps({"columns": columns, "rows": rows[:10]}, ensure_ascii=False)
        analysis_messages = [
            {
                "role": "user",
                "content": (
                    f"Pergunta do usuário: {question}\n\n"
                    f"SQL executado: {sql_clean}\n\n"
                    f"Resultado ({len(rows)} linhas, mostrando até 10):\n{preview}\n\n"
                    "Forneça uma análise objetiva dos resultados para o gestor."
                ),
            }
        ]
        try:
            analysis_resp = await client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=300,
                system=_ANALYSIS_SYSTEM,
                messages=analysis_messages,
            )
            analysis = analysis_resp.content[0].text.strip()
        except Exception:
            analysis = f"Consulta retornou {len(rows)} linhas."

    return {
        "sql": sql_clean,
        "columns": columns,
        "rows": rows,
        "row_count": len(rows),
        "analysis": analysis,
        "chart_hint": chart_hint,
        "error": None,
    }
