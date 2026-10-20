"""
Nexo - Authentication Routes (PostgreSQL)
========================================
Registro, login y perfil (autenticación local con PostgreSQL).
"""

import logging
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr, field_validator

from app.auth import ACCESS_TOKEN_TTL, get_current_user, jwt_manager
from app.middleware.rate_limiter import limiter
from app.pg_database import pg_db

logger = logging.getLogger("nexo.auth")

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


class RegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str

    @field_validator('username')
    @classmethod
    def validate_username(cls, v):
        if len(v) < 3 or len(v) > 30:
            raise ValueError('Username debe tener entre 3 y 30 caracteres')
        if not v.replace('_', '').replace('-', '').isalnum():
            raise ValueError('Username solo puede contener letras, números, _ y -')
        return v

    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        if len(v) < 8 or len(v) > 128:
            raise ValueError('La contraseña debe tener entre 8 y 128 caracteres')
        if v.isdigit() or v.isalpha():
            raise ValueError('La contraseña debe combinar letras y números o símbolos')
        return v


class LoginRequest(BaseModel):
    username: str  # username o email
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]
    expires_in: int


def _issue_token(user: Dict[str, Any]) -> LoginResponse:
    token = jwt_manager.create_access_token({
        "user_id": user["id"],
        "username": user["username"],
        "role": user["role"],
        "user_code": user["user_code"],
    })
    return LoginResponse(access_token=token, user=user, expires_in=int(ACCESS_TOKEN_TTL.total_seconds()))


@router.post("/register", response_model=LoginResponse)
@limiter.limit("5/minute")
async def register(request: Request, body: RegisterRequest):
    try:
        user = await pg_db.create_user(
            username=body.username, email=body.email, password=body.password,
            role="free",
        )
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return _issue_token(user)


@router.post("/login", response_model=LoginResponse)
@limiter.limit("10/minute")
async def login(request: Request, body: LoginRequest):
    user = await pg_db.authenticate_user(body.username, body.password)
    if not user:
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    return _issue_token(user)


@router.get("/me")
async def get_me(current: Dict[str, Any] = Depends(get_current_user)):
    user = await pg_db.get_user_by_id(str(current["user_id"]))
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return user


@router.get("/usage")
async def get_usage(current: Dict[str, Any] = Depends(get_current_user)):
    return await pg_db.get_usage(str(current["user_id"]))
