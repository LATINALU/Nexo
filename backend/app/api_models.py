"""
Endpoint para detectar modelos disponibles en una API
"""
import logging
import httpx
from typing import List, Dict, Any, Optional

# Descripciones de para qué es buena cada IA
MODEL_DESCRIPTIONS = {
    # OpenAI
    "gpt-4o": "🧠 Mejor para: Razonamiento complejo, análisis profundo, código avanzado",
    "gpt-4o-mini": "⚡ Mejor para: Tareas rápidas, chat, resúmenes, bajo costo",
    "gpt-4-turbo": "💪 Mejor para: Tareas largas, documentos extensos, visión",
    "gpt-3.5-turbo": "💰 Mejor para: Tareas simples, alto volumen, económico",
    "o1-preview": "🔬 Mejor para: Matemáticas, ciencia, razonamiento paso a paso",
    "o1-mini": "🧮 Mejor para: Código, lógica, problemas técnicos",
    
    # Groq (Llama)
    "llama-3.3-70b-versatile": "🦙 Mejor para: Uso general, rápido, multilingüe",
    "llama-3.1-70b-versatile": "🦙 Mejor para: Razonamiento, código, análisis",
    "llama-3.1-8b-instant": "⚡ Mejor para: Respuestas ultra rápidas, chat",
    "llama-guard-3-8b": "🛡️ Mejor para: Moderación de contenido, seguridad",
    "mixtral-8x7b-32768": "🎭 Mejor para: Contexto largo, multilingüe",
    "gemma-7b-it": "💎 Mejor para: Instrucciones, tareas específicas",
    "gemma2-9b-it": "💎 Mejor para: Razonamiento mejorado, código",
    
    # DeepSeek
    "deepseek-chat": "🔍 Mejor para: Chat general, código, análisis",
    "deepseek-coder": "💻 Mejor para: Programación, debugging, código",
    "deepseek-reasoner": "🧠 Mejor para: Razonamiento profundo, matemáticas",
    
    # Anthropic Claude
    "claude-3-5-sonnet-20241022": "✨ Mejor para: Escritura, análisis, código elegante",
    "claude-3-opus-20240229": "👑 Mejor para: Tareas complejas, creatividad, investigación",
    "claude-3-sonnet-20240229": "📝 Mejor para: Balance calidad/velocidad, documentos",
    "claude-3-haiku-20240307": "🚀 Mejor para: Respuestas rápidas, alto volumen",
    
    # Mistral
    "mistral-large-latest": "🌟 Mejor para: Razonamiento, multilingüe europeo",
    "mistral-medium-latest": "⚖️ Mejor para: Balance costo/rendimiento",
    "mistral-small-latest": "💨 Mejor para: Tareas simples, rápido",
    "codestral-latest": "💻 Mejor para: Código, 80+ lenguajes",
    
    # Together AI
    "meta-llama/Llama-3.3-70B-Instruct-Turbo": "🦙 Mejor para: Instrucciones, chat, análisis",
    "meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo": "🏆 Mejor para: Máxima calidad, tareas complejas",
    "mistralai/Mixtral-8x22B-Instruct-v0.1": "🎭 Mejor para: Contexto largo, multilingüe",
    "Qwen/Qwen2.5-72B-Instruct-Turbo": "🐉 Mejor para: Chino/inglés, código, matemáticas",
    
    # OpenRouter
    "openai/gpt-4o": "🧠 Mejor para: Razonamiento complejo, análisis",
    "anthropic/claude-3.5-sonnet": "✨ Mejor para: Escritura, código elegante",
    "google/gemini-pro-1.5": "🌐 Mejor para: Multimodal, contexto muy largo",
    "meta-llama/llama-3.1-405b-instruct": "🏆 Mejor para: Open source más potente",
}


logger = logging.getLogger("nexo.models")

_SKIP_MODEL_KEYWORDS = ("embed", "whisper", "tts", "dall-e", "moderation", "guard", "transcribe")


class ModelFetchError(Exception):
    """Error presentable al usuario al consultar modelos."""


async def fetch_available_models(api_type: str, api_key: str, base_url: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Consulta el endpoint /models del proveedor (API compatible con OpenAI).
    La base_url pasa por la protección SSRF antes de hacer la request.
    """
    from app.config import PROVIDER_BASE_URLS
    from app.validators import is_safe_outbound_url

    api_type = (api_type or "openai").lower()
    base = (base_url or PROVIDER_BASE_URLS.get(api_type) or PROVIDER_BASE_URLS["openai"]).rstrip("/")
    if not is_safe_outbound_url(base):
        raise ModelFetchError("URL base no permitida")

    url = base if base.endswith("/models") else f"{base}/models"
    if api_type == "anthropic":
        headers = {"x-api-key": api_key, "anthropic-version": "2023-06-01"}
    else:
        headers = {"Authorization": f"Bearer {api_key or 'local'}"}

    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=False) as client:
            response = await client.get(url, headers=headers)
    except httpx.HTTPError as e:
        logger.info("No se pudo conectar a %s: %s", url, e)
        raise ModelFetchError("No se pudo conectar con el proveedor")

    if response.status_code in (401, 403):
        raise ModelFetchError("API key inválida o sin permisos")
    if response.status_code != 200:
        raise ModelFetchError(f"El proveedor respondió {response.status_code}")

    try:
        data = response.json()
    except ValueError:
        raise ModelFetchError("Respuesta inválida del proveedor")

    models = []
    for model in data.get("data", data.get("models", [])) or []:
        model_id = model.get("id") or model.get("name") or ""
        if not model_id or any(k in model_id.lower() for k in _SKIP_MODEL_KEYWORDS):
            continue
        models.append({
            "id": model_id,
            "name": model.get("display_name") or model_id,
            "description": MODEL_DESCRIPTIONS.get(model_id, "🤖 Modelo de IA"),
            "provider": api_type,
        })
    models.sort(key=lambda x: x["id"])
    return models


def get_model_description(model_id: str) -> str:
    """Obtiene la descripción de un modelo."""
    return MODEL_DESCRIPTIONS.get(model_id, "🤖 Modelo de IA para tareas generales")
