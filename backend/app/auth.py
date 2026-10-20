"""
Nexo - Autenticación JWT
=======================
Tokens de acceso firmados con JWT_SECRET_KEY y dependencias de FastAPI para
proteger endpoints (Authorization: Bearer <token>).
"""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.exceptions import ExpiredSignatureError, InvalidTokenError

from app.config import JWT_ALGORITHM, JWT_SECRET_KEY

ACCESS_TOKEN_TTL = timedelta(hours=24)

_bearer = HTTPBearer(auto_error=False)


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(status_code=401, detail=detail, headers={"WWW-Authenticate": "Bearer"})


class JWTManager:
    """Emisión y verificación de tokens de acceso."""

    @staticmethod
    def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
        now = datetime.now(timezone.utc)
        payload = {
            **data,
            "iat": now,
            "exp": now + (expires_delta or ACCESS_TOKEN_TTL),
            "jti": str(uuid.uuid4()),
            "type": "access",
        }
        return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

    @staticmethod
    def verify_token(token: str) -> Dict[str, Any]:
        """Decodifica un token de acceso o lanza 401."""
        try:
            payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        except ExpiredSignatureError:
            raise _unauthorized("Token expirado")
        except InvalidTokenError:
            raise _unauthorized("Token inválido")
        if payload.get("type") != "access" or not payload.get("user_id"):
            raise _unauthorized("Token inválido")
        return payload


jwt_manager = JWTManager()


def user_from_token(token: Optional[str]) -> Optional[Dict[str, Any]]:
    """Versión no-lanzadora para WebSocket: devuelve el payload o None."""
    if not token:
        return None
    if token.startswith("Bearer "):
        token = token[7:]
    try:
        return jwt_manager.verify_token(token)
    except HTTPException:
        return None


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> Optional[Dict[str, Any]]:
    if not credentials:
        return None
    return jwt_manager.verify_token(credentials.credentials)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> Dict[str, Any]:
    """Payload del token del usuario autenticado (user_id, username, role...)."""
    if not credentials:
        raise _unauthorized("Token de autenticación requerido")
    return jwt_manager.verify_token(credentials.credentials)


async def require_admin(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Exige rol admin según la base de datos (no se confía en el rol del token)."""
    from app.pg_database import pg_db

    profile = await pg_db.get_user_by_id(str(user["user_id"]))
    if not profile or not profile.get("is_active") or str(profile.get("role", "")).lower() != "admin":
        raise HTTPException(status_code=403, detail="Se requiere rol de administrador")
    return user


def generate_client_id() -> str:
    return f"client_{uuid.uuid4().hex}"


__all__ = [
    "JWTManager", "jwt_manager", "user_from_token",
    "get_current_user", "get_optional_user", "require_admin", "generate_client_id",
]
