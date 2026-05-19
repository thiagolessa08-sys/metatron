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
Registro de cada ligação/acionamento realizado (granular: 1 linha por chamada).
Colunas:
- campanha (varchar) — identifica a campanha; formato '<empresa>_<nome>' (ex: '6220_elaine_sp')
- cpf (varchar) — CPF do contato (sem máscara)
- telefone (varchar) — número discado (sem máscara, ex: '11945003524')
- data_correta (TIMESTAMP) — data/hora do acionamento; use BETWEEN com literais ISO: WHERE data_correta BETWEEN '2026-01-01' AND '2026-04-01'
- hora (TIME) — hora isolada; DATEPART(hour, hora) extrai a hora inteira (0-23)
- duracao (INTEGER) — duração da chamada em segundos
- operador (varchar) — nome do atendente (ex: 'EMERSON_ALEXANDRE')
- descricao (varchar) — qualificação/desfecho da chamada
- desligou (varchar) — quem desligou
Agregações livres: COUNT(*), SUM(duracao), AVG(duracao), MAX(duracao), MIN(duracao).

### metatron.TT_METRICAS_METATRON
Snapshot agregado por campanha (1 linha por campanha).
Colunas:
- empresa (varchar) — código da empresa (ex: '6220'); é o prefixo de `campanha` antes do '_'
- fila (varchar) — código da fila/grupo (ex: '81004')
- campanha (varchar) — mesma chave de TT_ACIONAMENTOS.campanha
- ativo (varchar) — '1'=ativa, '0'=inativa
- servidor (varchar), hora_original (varchar), id (varchar)
- data (DATE), hora (TIME)
- aproveitamento (varchar, percentual 0-100; única coluna numérica que está como VARCHAR)
Campos NUMERIC (podem ser usados com SUM/AVG/MAX/MIN diretamente, sem CAST):
- total, localizados, em_contato, contatados, descartados
- novos, resets, atualiza, higieniza
- agendamentos_publicos, agendamentos_privados
- discados_total, atendidas_hoje
Fórmula de aproveitamento real: localizados / total * 100.

### metatron.TT_RELATORIO_METATRON
Detalhamento de chamadas com tarifação (granular por chamada, mas via fornecedor de telefonia).
Colunas varchar:
- data_hora (varchar), numero (varchar) — telefone discado, casa com TT_ACIONAMENTOS.telefone
- TechPrefix (varchar), Tipo_Numero (varchar), Operadora (varchar)
- resultado (varchar), codigo_desligamento (varchar)
- data (TIMESTAMP)
Campos NUMERIC (podem ser usados com SUM/AVG/MAX/MIN diretamente):
- tarifa, valor (custo em R$), duracao (segundos)
- dur_min (minutos), dur_min_tarif (minutos tarifados)

## Relacionamentos entre as tabelas

1. **Acionamentos × Métricas** (por campanha):
   INNER JOIN metatron.TT_METRICAS_METATRON m ON a.campanha = m.campanha
   Use para combinar volume real de ligações (acionamentos) com o snapshot de mailing (métricas).

2. **Acionamentos × Relatório de tarifação** (por telefone):
   INNER JOIN metatron.TT_RELATORIO_METATRON r ON a.telefone = r.numero
   Use para juntar operador/campanha (acionamentos) com custo/operadora (relatório).

3. **Métricas × Relatório**: não há ligação direta — passe sempre via TT_ACIONAMENTOS.

4. **Hierarquia**: empresa → campanha → fila → acionamentos.
   Para filtrar por empresa em TT_ACIONAMENTOS, use o prefixo: WHERE campanha LIKE '6220_%'
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

3. **Datas: use BETWEEN com literais 'YYYY-MM-DD' na coluna data_correta** — nunca YEAR(), MONTH() ou DATE().
   Errado: WHERE YEAR(data_correta) = 2026
   Certo:  WHERE data_correta BETWEEN '2026-01-01' AND '2026-12-31'

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
{{"sql": "SELECT operador, COUNT(*) AS total FROM metatron.TT_ACIONAMENTOS_METATRON WHERE data_correta = '2026-05-18' GROUP BY operador ORDER BY total DESC", "chart_hint": {{"type": "bar", "x_column": "operador", "y_column": "total"}}}}

Pergunta: "Qual o aproveitamento das campanhas ativas?"
Resposta:
{{"sql": "SELECT campanha, aproveitamento, discados_total, atendidas_hoje FROM metatron.TT_METRICAS_METATRON WHERE ativo = '1' ORDER BY campanha", "chart_hint": {{"type": "bar", "x_column": "campanha", "y_column": "aproveitamento"}}}}

Pergunta: "Qual operador ficou mais tempo em ligação na semana passada?"
Resposta:
{{"sql": "SELECT operador, SUM(duracao) AS tempo_total_s FROM metatron.TT_ACIONAMENTOS_METATRON WHERE data_correta BETWEEN '2026-05-10' AND '2026-05-16' GROUP BY operador ORDER BY tempo_total_s DESC", "chart_hint": {{"type": "bar", "x_column": "operador", "y_column": "tempo_total_s"}}}}

Pergunta: "Qual o custo total por operadora?"
Resposta:
{{"sql": "SELECT Operadora, SUM(valor) AS custo_total FROM metatron.TT_RELATORIO_METATRON GROUP BY Operadora ORDER BY custo_total DESC", "chart_hint": {{"type": "bar", "x_column": "Operadora", "y_column": "custo_total"}}}}

Pergunta: "Quantas campanhas estão ativas?"
Resposta:
{{"sql": "SELECT campanha, fila, total, discados_total, atendidas_hoje FROM metatron.TT_METRICAS_METATRON WHERE ativo = '1'"}}

Pergunta: "Volume de ligações reais vs tamanho do mailing por campanha"
Resposta (JOIN acionamentos × métricas pela coluna campanha):
{{"sql": "SELECT m.campanha, SUM(m.total) AS mailing, COUNT(a.campanha) AS ligacoes FROM metatron.TT_METRICAS_METATRON m LEFT JOIN metatron.TT_ACIONAMENTOS_METATRON a ON a.campanha = m.campanha GROUP BY m.campanha ORDER BY ligacoes DESC", "chart_hint": {{"type": "bar", "x_column": "campanha", "y_column": "ligacoes"}}}}

Pergunta: "Custo total por operador no último mês"
Resposta (JOIN acionamentos × relatório pelo telefone):
{{"sql": "SELECT a.operador, SUM(r.valor) AS custo_total FROM metatron.TT_ACIONAMENTOS_METATRON a INNER JOIN metatron.TT_RELATORIO_METATRON r ON a.telefone = r.numero WHERE a.data_correta BETWEEN '2026-04-18' AND '2026-05-18' GROUP BY a.operador ORDER BY custo_total DESC", "chart_hint": {{"type": "bar", "x_column": "operador", "y_column": "custo_total"}}}}

Pergunta: "Volume de ligações da empresa 6220"
Resposta (empresa = prefixo da campanha):
{{"sql": "SELECT campanha, COUNT(*) AS total FROM metatron.TT_ACIONAMENTOS_METATRON WHERE campanha LIKE '6220_%' GROUP BY campanha ORDER BY total DESC", "chart_hint": {{"type": "bar", "x_column": "campanha", "y_column": "total"}}}}
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
