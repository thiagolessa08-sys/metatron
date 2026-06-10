from pydantic import BaseModel, Field


class ChecklistItem(BaseModel):
    item: str  # nome do critério (ex: "Saudação inicial")
    atendido: bool
    observacao: str | None = None


class QualidadeAtendimento(BaseModel):
    nota: float = Field(..., ge=0, le=10)  # 0-10
    resumo_avaliacao: str
    checklist: list[ChecklistItem]


class AnaliseLigacaoResult(BaseModel):
    # Transcrição (gerada pelo Whisper, exibida como apoio)
    transcricao: str
    duracao_estimada_s: int = 0

    # Resumo + sentimento
    resumo: str
    sentimento: str  # "positivo" | "neutro" | "negativo"
    sentimento_justificativa: str

    # Qualidade do atendimento
    qualidade: QualidadeAtendimento

    # Classificação do resultado (alinhada ao funil)
    classificacao: str  # ex: "Fechado", "Negociação", "Sem interesse", ...
    classificacao_justificativa: str

    # Modelos usados (rastreabilidade)
    modelo_transcricao: str
    modelo_analise: str
