"""
Nexo - Configuración centralizada del backend.

Fuente única de verdad para variables de entorno. Carga, en orden:
  1. variables ya definidas en el entorno (Docker, shell)
  2. backend/.env
  3. ../.env.nexo (raíz del repo, usado en desarrollo local)

En producción los secretos son obligatorios: si faltan, el backend no arranca.
"""
import os
import logging
import secrets as _secrets
from pathlib import Path
from dotenv import load_dotenv

_BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(_BACKEND_DIR / ".env")
load_dotenv(_BACKEND_DIR.parent / ".env.nexo")

logger = logging.getLogger("nexo.config")

# ---------------------------------------------------------------------------
# Entorno
# ---------------------------------------------------------------------------
ENVIRONMENT = os.getenv("ENVIRONMENT", "development").lower()
IS_PRODUCTION = ENVIRONMENT == "production"
DEBUG = os.getenv("DEBUG", "false").lower() == "true"
HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", 8001))

# ---------------------------------------------------------------------------
# Secretos
# ---------------------------------------------------------------------------
_REQUIRED_SECRETS = ("JWT_SECRET_KEY", "SESSION_SECRET", "ENCRYPTION_KEY", "API_SECRET_KEY")
_missing = [k for k in _REQUIRED_SECRETS if len(os.getenv(k, "")) < 32]
if _missing and IS_PRODUCTION:
    raise RuntimeError(f"Secretos faltantes o demasiado cortos (min 32 chars): {', '.join(_missing)}")
if _missing:
    logger.warning("Secretos no configurados (%s): se usan claves temporales que cambian en cada reinicio.",
                   ", ".join(_missing))


def _secret(name: str) -> str:
    value = os.getenv(name, "")
    return value if len(value) >= 32 else _secrets.token_urlsafe(48)


JWT_SECRET_KEY = _secret("JWT_SECRET_KEY")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
SESSION_SECRET = _secret("SESSION_SECRET")
ENCRYPTION_KEY = _secret("ENCRYPTION_KEY")
API_SECRET_KEY = _secret("API_SECRET_KEY")

# ---------------------------------------------------------------------------
# PostgreSQL
# ---------------------------------------------------------------------------
def _build_database_url() -> str:
    url = os.getenv("DATABASE_URL")
    if url:
        return url.replace("postgresql+asyncpg://", "postgresql://")
    user = os.getenv("POSTGRES_USER", "nexo_user")
    password = os.getenv("POSTGRES_PASSWORD", "")
    host = os.getenv("POSTGRES_HOST", "localhost")
    port = os.getenv("POSTGRES_PORT") or os.getenv("NEXO_POSTGRES_PORT", "5433")
    db = os.getenv("POSTGRES_DB", "nexo")
    return f"postgresql://{user}:{password}@{host}:{port}/{db}"


DATABASE_URL = _build_database_url()

# ---------------------------------------------------------------------------
# Redis
# ---------------------------------------------------------------------------
def _build_redis_url() -> str:
    url = os.getenv("REDIS_URL")
    if url:
        return url
    password = os.getenv("REDIS_PASSWORD", "")
    host = os.getenv("REDIS_HOST", "localhost")
    port = os.getenv("REDIS_PORT") or os.getenv("NEXO_REDIS_PORT", "6380")
    auth = f":{password}@" if password else ""
    return f"redis://{auth}{host}:{port}/0"


REDIS_URL = _build_redis_url()

# ---------------------------------------------------------------------------
# Admin inicial
# ---------------------------------------------------------------------------
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@localhost")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")  # vacío = no se crea admin

# ---------------------------------------------------------------------------
# LLM providers
# ---------------------------------------------------------------------------
GROQ_API_KEY = os.getenv("GROQ_API_KEY") or None
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY") or None
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY") or None

DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "openai/gpt-oss-120b")

# URL base por defecto de cada proveedor (todos exponen API compatible con OpenAI)
PROVIDER_BASE_URLS = {
    "groq": "https://api.groq.com/openai/v1",
    "openai": "https://api.openai.com/v1",
    "anthropic": "https://api.anthropic.com/v1",
    "google": "https://generativelanguage.googleapis.com/v1beta/openai",
    "openrouter": "https://openrouter.ai/api/v1",
    "local": os.getenv("LOCAL_API_URL", "http://localhost:11434/v1"),
}

MODELS = {
    "groq-default": {"provider": "groq", "model": "openai/gpt-oss-120b", "api_key": GROQ_API_KEY,
                     "base_url": PROVIDER_BASE_URLS["groq"]},
    "groq-llama": {"provider": "groq", "model": "llama-3.3-70b-versatile", "api_key": GROQ_API_KEY,
                   "base_url": PROVIDER_BASE_URLS["groq"]},
    "openai-gpt4o-mini": {"provider": "openai", "model": "gpt-4o-mini", "api_key": OPENAI_API_KEY,
                          "base_url": PROVIDER_BASE_URLS["openai"]},
}

# Permitir que el usuario apunte el LLM a hosts privados (Ollama/LM Studio en localhost).
_allow_private = os.getenv("ALLOW_PRIVATE_LLM_URLS", "")
ALLOW_PRIVATE_LLM_URLS = (_allow_private.lower() == "true") if _allow_private else not IS_PRODUCTION

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
_cors_env = os.getenv("CORS_ORIGINS", "")
if _cors_env:
    CORS_ORIGINS = [o.strip() for o in _cors_env.split(",") if o.strip()]
elif IS_PRODUCTION:
    CORS_ORIGINS = [os.getenv("FRONTEND_URL", "")] if os.getenv("FRONTEND_URL") else []
else:
    CORS_ORIGINS = [
        "http://localhost:3000", "http://127.0.0.1:3000",
        "http://localhost:3002", "http://127.0.0.1:3002",
    ]

CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
CORS_ALLOW_HEADERS = ["accept", "accept-language", "content-language", "content-type", "authorization"]
CORS_MAX_AGE = 86400
