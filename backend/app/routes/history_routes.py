"""
Nexo - Conversation History Routes (PostgreSQL)
==============================================
Historial persistente por usuario. Toda operación verifica que la conversación
pertenezca al usuario del token.
"""

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.auth import get_current_user
from app.pg_database import pg_db

logger = logging.getLogger("nexo.history")

router = APIRouter(prefix="/api/history", tags=["Conversation History"])

MAX_MESSAGES_PER_CONVERSATION = 2000  # incluye todas las ramas
MAX_SYNC_BATCH = 100


class SaveConversationRequest(BaseModel):
    conversation_id: str = Field(..., min_length=1, max_length=100)
    title: str = Field("Nueva conversación", max_length=500)
    messages: List[Dict[str, Any]] = Field(default_factory=list, max_length=MAX_MESSAGES_PER_CONVERSATION)
    model: Optional[str] = Field(None, max_length=100)
    agents: Optional[List[str]] = None


def _uid(user: Dict[str, Any]) -> str:
    return str(user["user_id"])


@router.get("")
@router.get("/", include_in_schema=False)
async def get_conversations(user: Dict[str, Any] = Depends(get_current_user),
                            limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0)):
    return await pg_db.get_conversations(_uid(user), limit=limit, offset=offset)


@router.get("/{conversation_id}")
async def get_conversation(conversation_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    conv = await pg_db.get_conversation(conversation_id, _uid(user))
    if not conv:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")
    return conv


@router.post("")
@router.post("/", include_in_schema=False)
async def save_conversation(body: SaveConversationRequest, user: Dict[str, Any] = Depends(get_current_user)):
    try:
        return await pg_db.save_conversation(
            user_id=_uid(user), conversation_id=body.conversation_id, title=body.title,
            messages=body.messages, model=body.model, agents=body.agents,
        )
    except PermissionError:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")


@router.delete("/{conversation_id}")
async def delete_conversation(conversation_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    if not await pg_db.delete_conversation(conversation_id, _uid(user)):
        raise HTTPException(status_code=404, detail="Conversación no encontrada")
    return {"deleted": True}


@router.post("/sync")
async def sync_conversations(conversations: List[Dict[str, Any]],
                             user: Dict[str, Any] = Depends(get_current_user)):
    """Sube conversaciones locales al servidor (upsert masivo)."""
    if len(conversations) > MAX_SYNC_BATCH:
        raise HTTPException(status_code=413, detail=f"Máximo {MAX_SYNC_BATCH} conversaciones por sync")
    synced = 0
    for conv in conversations:
        conv_id = str(conv.get("id") or conv.get("conversation_id") or "")[:100]
        if not conv_id:
            continue
        try:
            await pg_db.save_conversation(
                user_id=_uid(user), conversation_id=conv_id,
                title=str(conv.get("title") or "Sin título")[:500],
                messages=(conv.get("messages") or [])[:MAX_MESSAGES_PER_CONVERSATION],
                model=conv.get("model"), agents=conv.get("agents") or [],
            )
            synced += 1
        except Exception as e:
            logger.warning("Sync falló para %s: %s", conv_id, e)
    return {"synced": synced, "total": len(conversations)}
