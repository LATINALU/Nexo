"""
Nexo - Online Users Tracker
==========================
Sesiones WebSocket activas para el panel de admin. Usa Redis (asíncrono) con
TTL por sesión; si Redis no está disponible, guarda en memoria del proceso.
"""

import json
import logging
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Dict, List, Optional

import redis.asyncio as redis

logger = logging.getLogger("nexo.online_users")

SESSION_TTL_S = 300
_SESSION_PREFIX = "nexo:session:"
_PEAK_KEY = "nexo:peak_users"


@dataclass
class OnlineUser:
    user_id: str
    session_id: str
    client_id: str
    connected_at: str
    last_activity: str
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    device_type: Optional[str] = None


class OnlineUsersTracker:

    def __init__(self, redis_url: str):
        self._redis_url = redis_url
        self._redis: Optional[redis.Redis] = None
        self._memory: Dict[str, OnlineUser] = {}
        self._memory_peak = 0

    async def connect(self) -> None:
        try:
            client = redis.from_url(self._redis_url, decode_responses=True, socket_connect_timeout=2)
            await client.ping()
            self._redis = client
            logger.info("Redis conectado para tracking de usuarios")
        except Exception as e:
            logger.warning("Redis no disponible, tracking en memoria: %s", e)
            self._redis = None

    async def add_user(self, user_id: str, session_id: str, client_id: str, ip_address: Optional[str] = None,
                       user_agent: Optional[str] = None, device_type: Optional[str] = None) -> None:
        now = datetime.now(timezone.utc).isoformat()
        user = OnlineUser(user_id, session_id, client_id, now, now, ip_address, (user_agent or "")[:300], device_type)
        if self._redis:
            try:
                await self._redis.setex(_SESSION_PREFIX + session_id, SESSION_TTL_S, json.dumps(asdict(user)))
                return
            except Exception as e:
                logger.warning("Redis falló en add_user: %s", e)
        self._memory[session_id] = user
        self._memory_peak = max(self._memory_peak, len({u.user_id for u in self._memory.values()}))

    async def update_activity(self, session_id: str) -> None:
        if self._redis:
            try:
                await self._redis.expire(_SESSION_PREFIX + session_id, SESSION_TTL_S)
                return
            except Exception as e:
                logger.warning("Redis falló en update_activity: %s", e)
        if session_id in self._memory:
            self._memory[session_id].last_activity = datetime.now(timezone.utc).isoformat()

    async def remove_user(self, session_id: str) -> None:
        if self._redis:
            try:
                await self._redis.delete(_SESSION_PREFIX + session_id)
            except Exception as e:
                logger.warning("Redis falló en remove_user: %s", e)
        self._memory.pop(session_id, None)

    async def get_online_users(self) -> List[Dict]:
        if self._redis:
            try:
                sessions = []
                async for key in self._redis.scan_iter(match=_SESSION_PREFIX + "*", count=200):
                    raw = await self._redis.get(key)
                    if raw:
                        sessions.append(json.loads(raw))
                return sessions
            except Exception as e:
                logger.warning("Redis falló en get_online_users: %s", e)
        return [asdict(u) for u in self._memory.values()]

    async def get_user_sessions(self, user_id: str) -> List[Dict]:
        return [s for s in await self.get_online_users() if s.get("user_id") == user_id]

    async def get_stats(self) -> Dict:
        sessions = await self.get_online_users()
        unique = {s.get("user_id") for s in sessions}
        devices: Dict[str, int] = {}
        for s in sessions:
            device = s.get("device_type") or "unknown"
            devices[device] = devices.get(device, 0) + 1

        peak = self._memory_peak
        if self._redis:
            try:
                peak = int(await self._redis.get(_PEAK_KEY) or 0)
                if len(unique) > peak:
                    peak = len(unique)
                    await self._redis.set(_PEAK_KEY, peak)
            except Exception:
                pass
        return {
            "online_users": len(unique),
            "total_sessions": len(sessions),
            "peak_users": max(peak, len(unique)),
            "device_breakdown": devices,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


_tracker_instance: Optional[OnlineUsersTracker] = None


def get_tracker(redis_url: Optional[str] = None) -> OnlineUsersTracker:
    global _tracker_instance
    if _tracker_instance is None:
        from app.config import REDIS_URL
        _tracker_instance = OnlineUsersTracker(redis_url or REDIS_URL)
    return _tracker_instance
