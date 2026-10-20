"""
Nexo - Validación de entradas del usuario
========================================
- Protección SSRF para las URLs de proveedores LLM que envía el cliente.
- Normalización de la configuración de API, el modelo y el texto del mensaje.
"""

import ipaddress
import re
import socket
from typing import Any, Dict, Optional
from urllib.parse import urlparse

from app.config import ALLOW_PRIVATE_LLM_URLS, DEFAULT_MODEL, IS_PRODUCTION, PROVIDER_BASE_URLS

_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_MODEL_NAME = re.compile(r"^[A-Za-z0-9_\-/.:@]{1,100}$")
_PROVIDER_TYPE = re.compile(r"^[a-z0-9_-]{1,30}$")


def is_safe_outbound_url(url: str, allow_private: Optional[bool] = None) -> bool:
    """
    Rechaza esquemas no http(s), credenciales embebidas y hosts que resuelven a
    IPs privadas, loopback, link-local (metadata cloud 169.254.x), reservadas o
    multicast, salvo que ALLOW_PRIVATE_LLM_URLS esté activo (Ollama/LM Studio local).
    """
    if allow_private is None:
        allow_private = ALLOW_PRIVATE_LLM_URLS
    try:
        parsed = urlparse(url)
    except ValueError:
        return False
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        return False
    if parsed.username or parsed.password:
        return False
    if allow_private:
        return True
    if IS_PRODUCTION and parsed.scheme != "https":
        return False
    try:
        infos = socket.getaddrinfo(parsed.hostname, parsed.port or (443 if parsed.scheme == "https" else 80))
    except (socket.gaierror, UnicodeError, ValueError):
        return False
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if (ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved
                or ip.is_multicast or ip.is_unspecified):
            return False
    return True


class SecurityValidator:

    @staticmethod
    def sanitize_text(text: str, max_length: int = 10000) -> str:
        """
        Limpia texto destinado al LLM: quita caracteres de control y limita longitud.
        NO escapa HTML: React ya escapa al renderizar y escapar aquí corrompía
        código y símbolos como < > & en los prompts.
        """
        if not text:
            return ""
        return _CONTROL_CHARS.sub("", text)[:max_length].strip()

    @staticmethod
    def validate_model_name(model: str) -> str:
        model = (model or "").strip()
        return model if _MODEL_NAME.match(model) else DEFAULT_MODEL

    @staticmethod
    def validate_api_config(config: Dict[str, Any]) -> Dict[str, str]:
        """Normaliza {type, apiKey, baseUrl} del cliente a {type, api_key, base_url}; {} si no es usable."""
        if not isinstance(config, dict):
            return {}
        api_type = str(config.get("type") or "openai").lower()
        if not _PROVIDER_TYPE.match(api_type):
            return {}

        api_key = config.get("apiKey", config.get("api_key", "")) or ""
        if not isinstance(api_key, str) or len(api_key) > 300 or any(c.isspace() for c in api_key.strip()):
            return {}
        api_key = api_key.strip()

        base_url = config.get("baseUrl", config.get("base_url")) or PROVIDER_BASE_URLS.get(api_type, "")
        if not isinstance(base_url, str) or not base_url or not is_safe_outbound_url(base_url):
            return {}

        if not api_key:  # los servidores locales (Ollama/LM Studio) no requieren key
            if api_type != "local":
                return {}
            api_key = "local"
        return {"type": api_type, "api_key": api_key, "base_url": base_url.rstrip("/")}
