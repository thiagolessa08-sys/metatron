import logging

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.auth.dependencies import require_role
from app.schemas.analise_ligacao import AnaliseLigacaoResult
from app.services.analise_ligacao import analisar_ligacao

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/analise-ligacao")

# Limite de upload e formatos aceitos pelo Whisper
_MAX_BYTES = 25 * 1024 * 1024  # 25 MB (limite da API do Whisper)
_EXTENSOES = (".mp3", ".mp4", ".mpeg", ".mpga", ".m4a", ".wav", ".webm", ".ogg")


@router.post("", response_model=AnaliseLigacaoResult)
async def analisar(
    file: UploadFile = File(...),
    _user=Depends(require_role("gestor", "admin")),
) -> AnaliseLigacaoResult:
    nome = (file.filename or "audio").lower()
    if not nome.endswith(_EXTENSOES):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Formato não suportado. Use: {', '.join(_EXTENSOES)}",
        )

    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Arquivo de áudio vazio.",
        )
    if len(audio_bytes) > _MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Áudio acima de 25 MB. Comprima ou divida a ligação.",
        )

    try:
        return await analisar_ligacao(audio_bytes, file.filename or "audio.mp3")
    except RuntimeError as e:
        # OPENAI_API_KEY ausente
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        logger.exception("Falha na análise de ligação")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao analisar a ligação: {e}",
        )
