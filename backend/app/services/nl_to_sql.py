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

# Schema real — colunas confirmadas nas tabelas Sybase IQ
_SCHEMA_CONTEXT = """
## Schema disponível (Sybase IQ — metatron)

### metatron.TT_ACIONAMENTOS_METATRON
Registro granular de cada acionamento/ligação (1 linha por chamada).

| Coluna      | Tipo      | Descrição                                                  |
|-------------|-----------|------------------------------------------------------------|
| empresa     | varchar   | Código da empresa (ex: 'CORDEIRO', '6220')                 |
| campanha    | varchar   | Nome da campanha (ex: '6220_ELAINE_SP')                    |
| operador    | varchar   | Login/nome do atendente (ex: 'EMERSON_ALEXANDRE')          |
| descricao   | varchar   | Qualificação/desfecho da chamada (ex: 'CONVERSAO', 'NÃO ATENDEU') |
| data        | TIMESTAMP | Data e hora do acionamento — filtre com BETWEEN 'YYYY-MM-DD' |
| hora        | TIME      | Hora isolada — use DATEPART(hour, hora) para extrair 0-23  |
| duracao     | INTEGER   | Duração em segundos — use SUM/AVG/MAX diretamente          |
| telefone    | varchar   | Número discado (ex: '11945003524')                         |
| cpf         | varchar   | CPF do contato (sem máscara)                               |
| desligou    | varchar   | Quem encerrou a chamada                                    |

Filtros comuns:
  - Por empresa:  WHERE empresa = 'CORDEIRO'
  - Por período:  WHERE data BETWEEN '2026-01-01' AND '2026-04-30'
  - Por dia:      WHERE CAST(data AS DATE) = '2026-05-20'
  - Por operador: WHERE operador = 'EMERSON_ALEXANDRE'

### metatron.TT_METRICAS_METATRON
Snapshot agregado de mailing por campanha (1 linha por campanha).

| Coluna                | Tipo    | Descrição                                          |
|-----------------------|---------|----------------------------------------------------|
| empresa               | varchar | Código da empresa                                  |
| campanha              | varchar | Mesma chave de TT_ACIONAMENTOS.campanha            |
| servidor              | varchar | Servidor/instância do discador                     |
| ativo                 | varchar | '1' = campanha ativa, '0' = inativa                |
| total                 | NUMERIC | Total de registros no mailing                      |
| localizados           | NUMERIC | Registros localizados                              |
| em_contato            | NUMERIC | Em tratamento/contato                              |
| contatados            | NUMERIC | Efetivamente contatados                            |
| discados_total        | NUMERIC | Total de discagens realizadas                      |
| atendidas_hoje        | NUMERIC | Atendimentos no dia                                |
| agendamentos_publicos | NUMERIC | Agendamentos públicos                              |
| agendamentos_privados | NUMERIC | Agendamentos privados                              |
| aproveitamento        | varchar | Percentual 0-100 — ATENÇÃO: é VARCHAR, use localizados / total * 100 para calcular |
| fila                  | varchar | Código da fila/grupo (ex: '81004')                 |
| data                  | DATE    | Data do snapshot                                   |
| hora                  | TIME    | Hora do snapshot                                   |

Campos NUMERIC aceitam SUM/AVG/MAX/MIN diretamente, sem CAST.
Para aproveitamento real: localizados / total * 100 AS aproveitamento_pct

### metatron.TT_RELATORIO_METATRON
Detalhamento de chamadas com tarifação por chamada (fonte: fornecedor de telefonia).

| Coluna              | Tipo      | Descrição                                          |
|---------------------|-----------|----------------------------------------------------|
| data_hora           | TIMESTAMP | Data e hora da chamada — use BETWEEN para filtrar  |
| numero              | varchar   | Telefone discado — casa com TT_ACIONAMENTOS.telefone |
| Operadora           | varchar   | Operadora da chamada (atenção: O maiúsculo)        |
| resultado           | varchar   | Resultado da chamada                               |
| duracao             | NUMERIC   | Duração em segundos                                |
| Dur_Min             | NUMERIC   | Duração em minutos (atenção: D e M maiúsculos)     |
| Valor               | NUMERIC   | Custo em R$ (atenção: V maiúsculo)                 |
| tarifa              | NUMERIC   | Tarifa unitária                                    |
| dur_min_tarif       | NUMERIC   | Minutos tarifados                                  |
| TechPrefix          | varchar   | Prefixo técnico                                    |
| Tipo_Numero         | varchar   | Tipo do número                                     |
| codigo_desligamento | varchar   | Código de encerramento                             |

ATENÇÃO: nesta tabela use os nomes exatos: `Operadora`, `Dur_Min`, `Valor` (com maiúsculas).

## Relacionamentos

1. **Acionamentos × Métricas** — por campanha:
   JOIN metatron.TT_METRICAS_METATRON m ON a.campanha = m.campanha
   Combina volume real de ligações com snapshot de mailing.

2. **Acionamentos × Tarifação** — por telefone:
   JOIN metatron.TT_RELATORIO_METATRON r ON a.telefone = r.numero
   Combina operador/campanha com custo/operadora.

3. **Métricas × Tarifação**: sem ligação direta — use TT_ACIONAMENTOS como ponte.

4. **Hierarquia**: empresa → campanha → operador → acionamentos.
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

3. **Datas: use BETWEEN com literais 'YYYY-MM-DD' na coluna data** — nunca YEAR(), MONTH() ou DATE().
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

10. **Agregação de campos NUMERIC é livre — sem CAST**.
    Em TT_METRICAS_METATRON e TT_RELATORIO_METATRON, todos os campos marcados como NUMERIC no schema
    aceitam SUM/AVG/MAX/MIN diretamente. Não use CAST.
    O único campo VARCHAR que parece numérico é TT_METRICAS_METATRON.aproveitamento (percentual);
    para esse, prefira recalcular: localizados / total * 100.
    Errado: SUM(CAST(total AS INTEGER)), AVG(CAST(aproveitamento AS DOUBLE))
    Certo:  SUM(total), SUM(valor), SUM(localizados) / SUM(total) * 100 AS aproveitamento

11. **Agrupar por dia: use CAST(coluna AS DATE), nunca CONVERT() nem DATEFORMAT()**.
    A coluna `data` é TIMESTAMP. Para agrupar por dia, converta para DATE com CAST.
    Use um alias diferente de `data` para evitar conflito com o nome da coluna.
    Errado: GROUP BY CONVERT(VARCHAR(10), data, 23), GROUP BY DATEFORMAT(data, 'yyyy-mm-dd')
    Certo:  SELECT CAST(data AS DATE) AS dia, COUNT(*) AS total ... GROUP BY CAST(data AS DATE)
    Exemplo completo:
    SELECT CAST(data AS DATE) AS dia, COUNT(*) AS total
    FROM metatron.TT_ACIONAMENTOS_METATRON
    WHERE telefone = '11999999999'
    GROUP BY CAST(data AS DATE)
    ORDER BY dia DESC

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
{{"sql": "SELECT operador, COUNT(*) AS total FROM metatron.TT_ACIONAMENTOS_METATRON WHERE CAST(data AS DATE) = '2026-05-29' GROUP BY operador ORDER BY total DESC", "chart_hint": {{"type": "bar", "x_column": "operador", "y_column": "total"}}}}

Pergunta: "Qual o aproveitamento das campanhas ativas?"
Resposta:
{{"sql": "SELECT campanha, localizados / total * 100 AS aproveitamento_pct, discados_total, atendidas_hoje FROM metatron.TT_METRICAS_METATRON WHERE ativo = '1' ORDER BY aproveitamento_pct DESC", "chart_hint": {{"type": "bar", "x_column": "campanha", "y_column": "aproveitamento_pct"}}}}

Pergunta: "Qual operador ficou mais tempo em ligação esta semana?"
Resposta:
{{"sql": "SELECT operador, SUM(duracao) AS tempo_total_s FROM metatron.TT_ACIONAMENTOS_METATRON WHERE data BETWEEN '2026-05-26' AND '2026-05-29' GROUP BY operador ORDER BY tempo_total_s DESC", "chart_hint": {{"type": "bar", "x_column": "operador", "y_column": "tempo_total_s"}}}}

Pergunta: "Qual o custo total por operadora?"
Resposta:
{{"sql": "SELECT Operadora, SUM(Valor) AS custo_total FROM metatron.TT_RELATORIO_METATRON GROUP BY Operadora ORDER BY custo_total DESC", "chart_hint": {{"type": "bar", "x_column": "Operadora", "y_column": "custo_total"}}}}

Pergunta: "Quantas campanhas estão ativas?"
Resposta:
{{"sql": "SELECT campanha, fila, total, discados_total, atendidas_hoje FROM metatron.TT_METRICAS_METATRON WHERE ativo = '1' ORDER BY campanha"}}

Pergunta: "Volume de ligações reais vs tamanho do mailing por campanha"
Resposta:
{{"sql": "SELECT m.campanha, SUM(m.total) AS mailing, COUNT(a.campanha) AS ligacoes FROM metatron.TT_METRICAS_METATRON m LEFT JOIN metatron.TT_ACIONAMENTOS_METATRON a ON a.campanha = m.campanha GROUP BY m.campanha ORDER BY ligacoes DESC", "chart_hint": {{"type": "bar", "x_column": "campanha", "y_column": "ligacoes"}}}}

Pergunta: "Custo total por operador no último mês"
Resposta:
{{"sql": "SELECT a.operador, SUM(r.Valor) AS custo_total FROM metatron.TT_ACIONAMENTOS_METATRON a INNER JOIN metatron.TT_RELATORIO_METATRON r ON a.telefone = r.numero WHERE a.data BETWEEN '2026-04-29' AND '2026-05-29' GROUP BY a.operador ORDER BY custo_total DESC", "chart_hint": {{"type": "bar", "x_column": "operador", "y_column": "custo_total"}}}}

Pergunta: "Ligações da empresa CORDEIRO"
Resposta:
{{"sql": "SELECT campanha, COUNT(*) AS total FROM metatron.TT_ACIONAMENTOS_METATRON WHERE empresa = 'CORDEIRO' GROUP BY campanha ORDER BY total DESC", "chart_hint": {{"type": "bar", "x_column": "campanha", "y_column": "total"}}}}

Pergunta: "Quais as qualificações mais usadas no mês?"
Resposta:
{{"sql": "SELECT descricao, COUNT(*) AS total FROM metatron.TT_ACIONAMENTOS_METATRON WHERE data BETWEEN '2026-05-01' AND '2026-05-29' GROUP BY descricao ORDER BY total DESC", "chart_hint": {{"type": "bar", "x_column": "descricao", "y_column": "total"}}}}

Pergunta: "Ranking de operadores por número de conversões"
Resposta:
{{"sql": "SELECT operador, COUNT(*) AS conversoes FROM metatron.TT_ACIONAMENTOS_METATRON WHERE descricao = 'CONVERSAO' GROUP BY operador ORDER BY conversoes DESC", "chart_hint": {{"type": "bar", "x_column": "operador", "y_column": "conversoes"}}}}
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
