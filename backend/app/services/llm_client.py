"""
Nexo - Cliente LLM
=================
Wrapper sobre AsyncOpenAI para cualquier proveedor con API compatible con
OpenAI (Groq, OpenAI, Anthropic, Google, OpenRouter, Ollama, LM Studio).

- Reutiliza un cliente por (base_url, api_key) en vez de crear uno por llamada.
- Streaming real token a token.
- Registra el uso de tokens cuando el proveedor lo informa.
"""

from __future__ import annotations

import hashlib
import logging
from collections import OrderedDict
from dataclasses import dataclass
from typing import AsyncIterator, Dict, List, Optional

import openai
from openai import AsyncOpenAI

logger = logging.getLogger("nexo.llm")

REQUEST_TIMEOUT_S = 120.0
_MAX_CACHED_CLIENTS = 64


class LLMError(Exception):
    """Error presentable al usuario."""


@dataclass
class Usage:
    prompt_tokens: int = 0
    completion_tokens: int = 0

    @property
    def total_tokens(self) -> int:
        return self.prompt_tokens + self.completion_tokens

    def add(self, other: "Usage") -> None:
        self.prompt_tokens += other.prompt_tokens
        self.completion_tokens += other.completion_tokens

    def as_dict(self) -> Dict[str, int]:
        return {"prompt_tokens": self.prompt_tokens, "completion_tokens": self.completion_tokens,
                "total_tokens": self.total_tokens}


_clients: "OrderedDict[str, AsyncOpenAI]" = OrderedDict()


def _client_for(api_key: str, base_url: str) -> AsyncOpenAI:
    key = hashlib.sha256(f"{base_url}|{api_key}".encode()).hexdigest()
    client = _clients.get(key)
    if client is None:
        client = AsyncOpenAI(api_key=api_key, base_url=base_url, timeout=REQUEST_TIMEOUT_S, max_retries=2)
        _clients[key] = client
        if len(_clients) > _MAX_CACHED_CLIENTS:
            _clients.popitem(last=False)
    else:
        _clients.move_to_end(key)
    return client


def _friendly_error(e: Exception) -> LLMError:
    if isinstance(e, openai.AuthenticationError):
        return LLMError("API key inválida o revocada")
    if isinstance(e, openai.PermissionDeniedError):
        return LLMError("La API key no tiene permiso para este modelo")
    if isinstance(e, openai.NotFoundError):
        return LLMError("Modelo no encontrado en el proveedor")
    if isinstance(e, openai.RateLimitError):
        return LLMError("Límite de uso del proveedor alcanzado; intenta en unos segundos")
    if isinstance(e, openai.APITimeoutError):
        return LLMError("El proveedor tardó demasiado en responder")
    if isinstance(e, openai.APIConnectionError):
        return LLMError("No se pudo conectar con el proveedor de IA")
    if isinstance(e, openai.BadRequestError):
        return LLMError(f"Solicitud rechazada por el proveedor: {getattr(e, 'message', e)}"[:300])
    if isinstance(e, openai.APIStatusError):
        return LLMError(f"Error del proveedor ({e.status_code})")
    return LLMError("Error inesperado llamando al modelo")


class LLMClient:
    """Cliente ligado a la configuración de un usuario: {type, api_key, base_url}."""

    def __init__(self, api_config: Dict[str, str], model: str):
        self.provider = api_config.get("type", "openai")
        self.model = model
        self._client = _client_for(api_config["api_key"], api_config["base_url"])
        # Algunos proveedores (p.ej. Ollama viejo) rechazan stream_options
        self._supports_usage = True

    async def stream(self, messages: List[Dict[str, str]], max_tokens: int = 2048,
                     temperature: float = 0.7, usage: Optional[Usage] = None) -> AsyncIterator[str]:
        """Genera fragmentos de texto a medida que llegan."""
        kwargs = dict(model=self.model, messages=messages, max_tokens=max_tokens,
                      temperature=temperature, stream=True)
        if self._supports_usage:
            kwargs["stream_options"] = {"include_usage": True}
        try:
            try:
                response = await self._client.chat.completions.create(**kwargs)
            except openai.BadRequestError as e:
                if "stream_options" not in str(e):
                    raise
                self._supports_usage = False
                kwargs.pop("stream_options", None)
                response = await self._client.chat.completions.create(**kwargs)

            async for chunk in response:
                if chunk.usage and usage is not None:
                    usage.add(Usage(chunk.usage.prompt_tokens or 0, chunk.usage.completion_tokens or 0))
                if not chunk.choices:
                    continue
                delta = chunk.choices[0].delta
                if delta and delta.content:
                    yield delta.content
        except openai.OpenAIError as e:
            logger.info("Error LLM (%s/%s): %s", self.provider, self.model, e)
            raise _friendly_error(e) from e

    async def complete(self, messages: List[Dict[str, str]], max_tokens: int = 1024,
                       temperature: float = 0.3, usage: Optional[Usage] = None) -> str:
        parts = [p async for p in self.stream(messages, max_tokens, temperature, usage)]
        return "".join(parts)
