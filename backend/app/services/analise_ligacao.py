"""
Análise de ligação por IA: áudio → Whisper (transcrição) → GPT (análise estruturada).
Devolve resumo+sentimento, qualidade do atendimento e classificação do resultado.
"""
import io
import json
import logging

from openai import AsyncOpenAI
from pydub import AudioSegment

from app.config import settings
from app.schemas.analise_ligacao import (
    AnaliseLigacaoResult,
    QualidadeAtendimento,
    ChecklistItem,
)

logger = logging.getLogger(__name__)

# Status do funil (alinhado ao dashboard) que o modelo pode usar como classificação
_CLASSIFICACOES = [
    "Fechado",
    "Negociação",
    "Sem interesse",
    "Não localizado",
    "Sem contato",
    "Agendamento",
    "Indefinido",
]

_SYSTEM_PROMPT = """Você é um analista de qualidade de call center brasileiro. \
Recebe a transcrição de UMA ligação entre um OPERADOR (atendente) e um CLIENTE e \
produz uma avaliação objetiva em português do Brasil.

Responda SOMENTE com um objeto JSON válido, sem markdown, sem comentários, exatamente neste formato:

{
  "resumo": "resumo objetivo do que foi tratado na ligação (2-4 frases)",
  "sentimento": "positivo | neutro | negativo",
  "sentimento_justificativa": "por que classificou assim, citando o comportamento do cliente",
  "qualidade": {
    "nota": 0.0,
    "resumo_avaliacao": "avaliação geral do desempenho do operador (1-2 frases)",
    "checklist": [
      {"item": "Saudação e identificação", "atendido": true, "observacao": "..."},
      {"item": "Sondagem da necessidade", "atendido": true, "observacao": "..."},
      {"item": "Apresentação da oferta", "atendido": true, "observacao": "..."},
      {"item": "Contorno de objeções", "atendido": false, "observacao": "..."},
      {"item": "Tentativa de fechamento", "atendido": true, "observacao": "..."},
      {"item": "Cordialidade e tom adequado", "atendido": true, "observacao": "..."}
    ]
  },
  "classificacao": "uma de: Fechado, Negociação, Sem interesse, Não localizado, Sem contato, Agendamento, Indefinido",
  "classificacao_justificativa": "por que classificou o resultado assim"
}

Regras:
- A nota (0 a 10) reflete a qualidade geral do atendimento do operador.
- O checklist deve ter exatamente os 6 itens acima, na mesma ordem.
- "observacao" é curta (no máximo 1 frase) e pode ser null se não houver nada relevante.
- Classifique o RESULTADO da ligação, não o sentimento.
- Não invente informações que não estejam na transcrição."""


def _client() -> AsyncOpenAI:
    if not settings.openai_api_key:
        raise RuntimeError(
            "OPENAI_API_KEY não configurada. Defina a variável de ambiente no backend."
        )
    return AsyncOpenAI(api_key=settings.openai_api_key)


def _transcodificar_mp3(audio_bytes: bytes) -> tuple[bytes, str]:
    """
    Converte o áudio para MP3 16kHz mono via ffmpeg (pydub).
    Gravações de telefonia (.WAV mu-law/a-law/GSM) muitas vezes não são
    decodificadas direto pelo Whisper; normalizar resolve.
    Retorna (bytes, nome). Em caso de falha, devolve o original.
    """
    try:
        audio = AudioSegment.from_file(io.BytesIO(audio_bytes))
        audio = audio.set_frame_rate(16000).set_channels(1)
        out = io.BytesIO()
        audio.export(out, format="mp3", bitrate="64k")
        return out.getvalue(), "audio.mp3"
    except Exception as e:
        logger.warning("Falha ao transcodificar áudio, usando original: %s", e)
        return audio_bytes, "audio"


async def transcrever(audio_bytes: bytes, filename: str) -> str:
    """Transcreve o áudio usando Whisper. Retorna o texto da transcrição."""
    client = _client()
    # Normaliza o formato (telefonia → mp3) para garantir que o Whisper decodifique
    conv_bytes, conv_name = _transcodificar_mp3(audio_bytes)
    buffer = io.BytesIO(conv_bytes)
    buffer.name = conv_name
    resp = await client.audio.transcriptions.create(
        model=settings.openai_transcribe_model,
        file=buffer,
        language="pt",
        response_format="text",
    )
    # response_format="text" retorna a string diretamente
    return resp if isinstance(resp, str) else getattr(resp, "text", str(resp))


async def analisar_transcricao(transcricao: str) -> dict:
    """Envia a transcrição ao GPT e devolve o dict de análise."""
    client = _client()
    resp = await client.chat.completions.create(
        model=settings.openai_analysis_model,
        response_format={"type": "json_object"},
        temperature=0.2,
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"Transcrição da ligação:\n\n{transcricao}",
            },
        ],
    )
    raw = resp.choices[0].message.content or "{}"
    return json.loads(raw)


async def analisar_ligacao(audio_bytes: bytes, filename: str) -> AnaliseLigacaoResult:
    """Pipeline completo: transcreve e analisa o áudio de uma ligação."""
    transcricao = await transcrever(audio_bytes, filename)

    if not transcricao or not transcricao.strip():
        raise ValueError("Não foi possível transcrever o áudio (resultado vazio).")

    dados = await analisar_transcricao(transcricao)

    qual_raw = dados.get("qualidade", {}) or {}
    checklist = [
        ChecklistItem(
            item=str(c.get("item", "")),
            atendido=bool(c.get("atendido", False)),
            observacao=(c.get("observacao") or None),
        )
        for c in (qual_raw.get("checklist") or [])
        if isinstance(c, dict)
    ]

    try:
        nota = float(qual_raw.get("nota", 0))
    except (TypeError, ValueError):
        nota = 0.0
    nota = max(0.0, min(10.0, nota))

    qualidade = QualidadeAtendimento(
        nota=nota,
        resumo_avaliacao=str(qual_raw.get("resumo_avaliacao", "")),
        checklist=checklist,
    )

    classificacao = str(dados.get("classificacao", "Indefinido")).strip() or "Indefinido"
    sentimento = str(dados.get("sentimento", "neutro")).strip().lower()
    if sentimento not in ("positivo", "neutro", "negativo"):
        sentimento = "neutro"

    # estimativa simples de duração: ~150 palavras/min de fala
    palavras = len(transcricao.split())
    duracao_estimada = int(palavras / 150 * 60) if palavras else 0

    return AnaliseLigacaoResult(
        transcricao=transcricao.strip(),
        duracao_estimada_s=duracao_estimada,
        resumo=str(dados.get("resumo", "")),
        sentimento=sentimento,
        sentimento_justificativa=str(dados.get("sentimento_justificativa", "")),
        qualidade=qualidade,
        classificacao=classificacao,
        classificacao_justificativa=str(dados.get("classificacao_justificativa", "")),
        modelo_transcricao=settings.openai_transcribe_model,
        modelo_analise=settings.openai_analysis_model,
    )
