"""
Nexo - User Memory Routes
========================
CRUD de memoria persistente del usuario (PostgreSQL). Se inyecta como contexto
en las conversaciones con los agentes.
"""

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.auth import get_current_user
from app.pg_database import pg_db

router = APIRouter(prefix="/api/memory", tags=["User Memory"])


class MemoryItem(BaseModel):
    key: str = Field(..., min_length=1, max_length=200)
    value: str = Field(..., min_length=1, max_length=4000)
    category: Optional[str] = Field("general", max_length=50)
    importance: Optional[int] = Field(5, ge=1, le=10)


def _uid(user: Dict[str, Any]) -> str:
    return str(user["user_id"])


@router.get("")
@router.get("/", include_in_schema=False)
async def get_memories(user: Dict[str, Any] = Depends(get_current_user),
                       category: Optional[str] = None, limit: int = Query(100, ge=1, le=500)):
    memories = await pg_db.get_memories(_uid(user), category=category, limit=limit)
    return {"memories": memories, "total": len(memories)}


@router.post("")
@router.post("/", include_in_schema=False)
async def save_memory(item: MemoryItem, user: Dict[str, Any] = Depends(get_current_user)):
    result = await pg_db.save_memory(
        user_id=_uid(user), key=item.key, value=item.value,
        category=item.category or "general", importance=item.importance or 5,
    )
    return {"memory": result}


@router.get("/context")
async def get_memory_context(user: Dict[str, Any] = Depends(get_current_user)):
    return {"context": await pg_db.get_memory_context(_uid(user))}


@router.delete("/{key}")
async def delete_memory(key: str, user: Dict[str, Any] = Depends(get_current_user)):
    if not await pg_db.delete_memory(_uid(user), key):
        raise HTTPException(status_code=404, detail="Memoria no encontrada")
    return {"deleted": True}
