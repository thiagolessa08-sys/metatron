"""
Validador de SQL para Sybase IQ.
Bloqueia DML/DDL, aplica guardrails de performance column-store,
e injeta TOP N quando ausente.
"""
import re

# DDL/DML — nunca permitir
_BLOCKED = re.compile(
    r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE|GRANT|REVOKE)\b",
    re.IGNORECASE,
)

# Guardrails de performance Sybase IQ (column-store)
_GUARDRAILS: list[tuple[re.Pattern, str]] = [
    (
        re.compile(r"\bUPPER\s*\(", re.IGNORECASE),
        "Não use UPPER() em colunas — quebra índice HG/LF no Sybase IQ. "
        "Use comparação direta com o valor no case correto.",
    ),
    (
        re.compile(r"\bLOWER\s*\(", re.IGNORECASE),
        "Não use LOWER() em colunas — quebra índice HG/LF no Sybase IQ. "
        "Use comparação direta com o valor no case correto.",
    ),
    (
        re.compile(r"\bTRIM\s*\(", re.IGNORECASE),
        "Não use TRIM() em colunas indexadas — força full scan no Sybase IQ.",
    ),
    (
        re.compile(r"\bSELECT\s+\*", re.IGNORECASE),
        "Nunca use SELECT * — liste as colunas explicitamente. "
        "Sybase IQ é column-store e só lê as colunas pedidas; SELECT * cancela esse ganho.",
    ),
    (
        re.compile(r"LIKE\s+'%[^']+", re.IGNORECASE),
        "Wildcard no início do LIKE (LIKE '%texto') força full scan. "
        "Prefira LIKE 'texto%' ou comparação por igualdade.",
    ),
    (
        re.compile(r"\bYEAR\s*\(\s*\w[\w.]*\s*\)", re.IGNORECASE),
        "Não aplique YEAR() na coluna — use BETWEEN com literais de data "
        "('YYYY-MM-DD') para aproveitar o índice.",
    ),
    (
        re.compile(r"\bMONTH\s*\(\s*\w[\w.]*\s*\)", re.IGNORECASE),
        "Não aplique MONTH() na coluna — use BETWEEN com literais de data.",
    ),
    (
        re.compile(r"\bDAY\s*\(\s*\w[\w.]*\s*\)", re.IGNORECASE),
        "Não aplique DAY() na coluna — use BETWEEN com literais de data.",
    ),
]

# Tabelas permitidas para consulta
ALLOWED_TABLES = {
    "metatron.TT_ACIONAMENTOS_METATRON",
    "metatron.TT_METRICAS_METATRON",
    "metatron.TT_RELATORIO_METATRON",
}

# O agent já limita via parâmetro "limit" no payload JSON —
# não injetamos TOP N no SQL para evitar conflito com o driver Sybase IQ.
_HAS_TOP = re.compile(r"\bTOP\s+\d+\b", re.IGNORECASE)
_HAS_LIMIT = re.compile(r"\bLIMIT\s+\d+\b", re.IGNORECASE)


class SqlValidationError(ValueError):
    pass


def validate_and_fix(sql: str) -> str:
    """
    Valida o SQL e aplica correções automáticas onde possível.
    Lança SqlValidationError com mensagem descritiva se a violação não puder ser corrigida.
    Retorna o SQL (possivelmente corrigido) pronto para envio ao agent.
    """
    sql = sql.strip().rstrip(";")

    # 1. Bloqueio DML/DDL
    m = _BLOCKED.search(sql)
    if m:
        raise SqlValidationError(
            f"Comando '{m.group().upper()}' não é permitido — apenas consultas SELECT."
        )

    # 2. Deve começar com SELECT
    if not re.match(r"^\s*SELECT\b", sql, re.IGNORECASE):
        raise SqlValidationError("Apenas consultas SELECT são permitidas.")

    # 3. Guardrails de performance
    violations: list[str] = []
    for pattern, message in _GUARDRAILS:
        if pattern.search(sql):
            violations.append(message)

    if violations:
        raise SqlValidationError(
            "SQL viola boas práticas do Sybase IQ:\n" + "\n".join(f"• {v}" for v in violations)
        )

    # 4. Verificar tabelas referenciadas (warn não bloqueia; apenas tabelas não-metatron são suspeitas)
    # Extrai nomes após FROM/JOIN
    referenced = re.findall(r"\b(?:FROM|JOIN)\s+([\w.]+)", sql, re.IGNORECASE)
    unknown = [t for t in referenced if t.lower() not in {a.lower() for a in ALLOWED_TABLES}]
    if unknown:
        raise SqlValidationError(
            f"Tabela(s) não autorizadas: {', '.join(unknown)}. "
            f"Tabelas permitidas: {', '.join(ALLOWED_TABLES)}."
        )

    return sql
