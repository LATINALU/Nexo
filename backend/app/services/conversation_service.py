"""
Nexo - Conversation Service
==========================
Persistencia de los turnos de chat (WebSocket) en PostgreSQL. Todas las
operaciones están ligadas al usuario dueño de la conversación.
"""

import json
import logging
import uuid
from typing import Dict, List, Optional

logger = logging.getLogger("nexo.conversations")


class ConversationService:

    def __init__(self):
        from app.pg_database import pg_db
        self._pg = pg_db

    async def ensure_conversation(self, user_id: str, conversation_id: Optional[str], title: str,
                                  model: Optional[str] = None, agents: Optional[List[str]] = None) -> Optional[str]:
        """
        Devuelve un conversation_id del usuario: reutiliza el recibido si es suyo
        o no existe todavía (lo crea con ese id); si pertenece a otro usuario,
        crea uno nuevo. None si no hay base de datos.
        """
        pool = self._pg._pool
        if not pool:
            return None
        uid = uuid.UUID(user_id)
        conv_id = (conversation_id or "")[:100] or f"conv_{uuid.uuid4().hex[:16]}"
        async with pool.acquire() as conn:
            owner = await conn.fetchval(
                "SELECT user_id FROM public.nexo_conversations WHERE conversation_id = $1", conv_id)
            if owner is not None and owner != uid:
                conv_id = f"conv_{uuid.uuid4().hex[:16]}"
                owner = None
            if owner is None:
                await conn.execute("""
                    INSERT INTO public.nexo_conversations (user_id, conversation_id, title, model, agents)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (conversation_id) DO NOTHING
                """, uid, conv_id, title[:500] or "Nueva conversación", model, agents or [])
            else:
                await conn.execute("""
                    UPDATE public.nexo_conversations SET model = $2, agents = $3 WHERE conversation_id = $1
                """, conv_id, model, agents or [])
        return conv_id

    async def add_message(self, conversation_id: str, role: str, content: str,
                          agent_id: Optional[str] = None, metadata: Optional[Dict] = None) -> bool:
        pool = self._pg._pool
        if not pool:
            return False
        async with pool.acquire() as conn, conn.transaction():
            conv_pk = await conn.fetchval(
                "SELECT id FROM public.nexo_conversations WHERE conversation_id = $1", conversation_id)
            if not conv_pk:
                return False
            await conn.execute("""
                INSERT INTO public.nexo_messages (conversation_id, role, content, agent_id, metadata)
                VALUES ($1, $2, $3, $4, $5)
            """, conv_pk, role, content, agent_id, json.dumps(metadata or {}, default=str))
            await conn.execute("""
                UPDATE public.nexo_conversations
                SET message_count = message_count + 1, updated_at = NOW() WHERE id = $1
            """, conv_pk)
        return True


_service_instance: Optional[ConversationService] = None


def get_conversation_service() -> ConversationService:
    global _service_instance
    if _service_instance is None:
        _service_instance = ConversationService()
    return _service_instance
