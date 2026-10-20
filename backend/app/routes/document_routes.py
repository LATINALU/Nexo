"""
Nexo - Documentos adjuntos
==========================
POST   /api/documents          sube un archivo (multipart) y devuelve su id
GET    /api/documents          documentos del usuario con sesión
GET    /api/documents/{id}     metadatos
DELETE /api/documents/{id}

Invitados: el documento queda accesible solo con su id (UUID aleatorio) durante 24 h
si no hay base de datos. Con sesión, queda ligado al usuario.
"""

import json
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile

from app.auth import get_current_user, get_optional_user
from app.middleware.rate_limiter import limiter
from app.services.documents import MAX_FILE_BYTES, DocumentError, build_document, document_store
from app.services.llm_client import LLMClient
from app.validators import SecurityValidator

router = APIRouter(prefix="/api/documents", tags=["Documents"])


def _uid(user: Optional[Dict[str, Any]]) -> Optional[str]:
    return str(user["user_id"]) if user else None


def _ocr_llm(raw: Optional[str]) -> Optional[LLMClient]:
    """Campo `ocr` (JSON): {type, apiKey, baseUrl, model} del modelo con visión del usuario."""
    if not raw:
        return None
    try:
        cfg = json.loads(raw)
    except ValueError:
        return None
    if not isinstance(cfg, dict) or not cfg.get("model"):
        return None
    parsed = SecurityValidator.validate_api_config(cfg)
    return LLMClient(parsed, SecurityValidator.validate_model_name(cfg["model"])) if parsed else None


@router.post("")
@limiter.limit("20/minute")
async def upload_document(request: Request, file: UploadFile = File(...), ocr: Optional[str] = Form(None),
                          language: str = Form("es"),
                          user: Optional[Dict[str, Any]] = Depends(get_optional_user)):
    data = await file.read(MAX_FILE_BYTES + 1)
    try:
        doc = await build_document(file.filename or "documento.txt", file.content_type or "", data, _uid(user),
                                   ocr_llm=_ocr_llm(ocr), language=language if language in ("es", "en") else "es")
    except DocumentError as e:
        raise HTTPException(status_code=400, detail=str(e))
    await document_store.save(doc)
    return doc.public()


@router.get("")
async def list_documents(user: Dict[str, Any] = Depends(get_current_user)):
    return {"documents": await document_store.list_for_user(_uid(user))}


@router.get("/{document_id}")
async def get_document(document_id: str, user: Optional[Dict[str, Any]] = Depends(get_optional_user)):
    doc = await document_store.get(document_id, _uid(user))
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    return doc.public()


@router.delete("/{document_id}")
async def delete_document(document_id: str, user: Optional[Dict[str, Any]] = Depends(get_optional_user)):
    if not await document_store.delete(document_id, _uid(user)):
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    return {"deleted": True}
