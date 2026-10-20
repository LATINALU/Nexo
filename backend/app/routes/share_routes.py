"""
Nexo - Conversaciones compartidas
=================================
POST   /api/shares          crea un link de solo lectura con una instantánea del camino activo
GET    /api/shares/{id}     lectura pública (no requiere sesión)
DELETE /api/shares/{id}     revoca: con la clave del dueño (X-Share-Key) o la sesión del dueño

La instantánea es inmutable: mensajes posteriores no aparecen en el link.
"""

import hashlib
import hmac
import json
import secrets
import time
import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field, field_validator

from app.auth import get_optional_user
from app.middleware.rate_limiter import limiter
from app.pg_database import pg_db

router = APIRouter(prefix="/api/shares", tags=["Shares"])

MAX_TURNS = 100
MAX_ANSWERS_PER_TURN = 15
MAX_TEXT = 40_000
MAX_PAYLOAD_BYTES = 1_500_000
_MEMORY_MAX = 500

_memory: Dict[str, Dict[str, Any]] = {}


class SharedAnswer(BaseModel):
    name: str = Field("", max_length=120)
    emoji: str = Field("", max_length=16)
    content: str = Field("", max_length=MAX_TEXT)
    is_synthesis: bool = False
    is_review: bool = False


class SharedSource(BaseModel):
    label: str = Field(..., max_length=10)
    kind: str = Field("web", max_length=10)
    title: str = Field("", max_length=300)
    url: Optional[str] = Field(None, max_length=1000)

    @field_validator("url")
    @classmethod
    def http_only(cls, v: Optional[str]) -> Optional[str]:
        return v if v and v.startswith(("http://", "https://")) else None


class SharedTurn(BaseModel):
    question: str = Field(..., max_length=MAX_TEXT)
    answers: List[SharedAnswer] = Field(default_factory=list, max_length=MAX_ANSWERS_PER_TURN)
    sources: List[SharedSource] = Field(default_factory=list, max_length=40)


class ShareIn(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    turns: List[SharedTurn] = Field(..., min_length=1, max_length=MAX_TURNS)


def _hash(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


@router.post("")
@limiter.limit("10/minute")
async def create_share(request: Request, body: ShareIn, user: Optional[Dict[str, Any]] = Depends(get_optional_user)):
    payload = {"title": body.title, "turns": [t.model_dump() for t in body.turns], "created_at": time.time()}
    encoded = json.dumps(payload, ensure_ascii=False)
    if len(encoded.encode()) > MAX_PAYLOAD_BYTES:
        raise HTTPException(status_code=413, detail="La conversación es demasiado grande para compartir")
    share_id = secrets.token_urlsafe(16)
    owner_key = secrets.token_urlsafe(24)
    owner_id = str(user["user_id"]) if user else None
    if pg_db._pool:
        async with pg_db._pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO public.nexo_shares (id, owner_id, owner_key_hash, title, payload)
                VALUES ($1, $2, $3, $4, $5)
            """, share_id, uuid.UUID(owner_id) if owner_id else None, _hash(owner_key), body.title, encoded)
    else:
        if len(_memory) >= _MEMORY_MAX:
            _memory.pop(next(iter(_memory)))
        _memory[share_id] = {"owner_id": owner_id, "key_hash": _hash(owner_key), "payload": payload, "views": 0}
    return {"id": share_id, "owner_key": owner_key}


@router.get("/{share_id}")
@limiter.limit("60/minute")
async def get_share(request: Request, share_id: str):
    if len(share_id) > 32:
        raise HTTPException(status_code=404, detail="Link no encontrado o revocado")
    if pg_db._pool:
        async with pg_db._pool.acquire() as conn:
            row = await conn.fetchrow("""
                UPDATE public.nexo_shares SET views = views + 1 WHERE id = $1 RETURNING payload, views
            """, share_id)
        if not row:
            raise HTTPException(status_code=404, detail="Link no encontrado o revocado")
        payload = json.loads(row["payload"]) if isinstance(row["payload"], str) else row["payload"]
        return {**payload, "views": row["views"]}
    entry = _memory.get(share_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Link no encontrado o revocado")
    entry["views"] += 1
    return {**entry["payload"], "views": entry["views"]}


@router.delete("/{share_id}")
async def revoke_share(share_id: str, x_share_key: Optional[str] = Header(None),
                       user: Optional[Dict[str, Any]] = Depends(get_optional_user)):
    user_id = str(user["user_id"]) if user else None
    if pg_db._pool:
        async with pg_db._pool.acquire() as conn:
            row = await conn.fetchrow("SELECT owner_id, owner_key_hash FROM public.nexo_shares WHERE id = $1", share_id)
            if not row:
                raise HTTPException(status_code=404, detail="Link no encontrado")
            owner, key_hash = (str(row["owner_id"]) if row["owner_id"] else None), row["owner_key_hash"]
            if not _authorized(owner, key_hash, user_id, x_share_key):
                raise HTTPException(status_code=403, detail="No puedes revocar este link")
            await conn.execute("DELETE FROM public.nexo_shares WHERE id = $1", share_id)
        return {"revoked": True}
    entry = _memory.get(share_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Link no encontrado")
    if not _authorized(entry["owner_id"], entry["key_hash"], user_id, x_share_key):
        raise HTTPException(status_code=403, detail="No puedes revocar este link")
    _memory.pop(share_id, None)
    return {"revoked": True}


def _authorized(owner_id: Optional[str], key_hash: str, user_id: Optional[str], key: Optional[str]) -> bool:
    if owner_id and user_id == owner_id:
        return True
    return bool(key) and hmac.compare_digest(_hash(key), key_hash)
