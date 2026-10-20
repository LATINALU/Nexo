"""
Nexo - Búsqueda web
===================
Proveedores (el usuario trae su propia key, igual que con el LLM):
  - tavily:  https://tavily.com  (devuelve contenido extraído, ideal para LLMs)
  - brave:   https://brave.com/search/api
  - searxng: instancia propia (base_url), sin key

La investigación web es un paso previo a los agentes: el LLM genera consultas,
se buscan en paralelo y los resultados se entregan a todos como fuentes [W1]…
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import Dict, List, Optional

import httpx

from app.services.llm_client import LLMClient, LLMError, Usage
from app.services.text_utils import unique_by

logger = logging.getLogger("nexo.web_search")

PROVIDERS = ("tavily", "brave", "searxng")
MAX_QUERIES = 3
RESULTS_PER_QUERY = 5
MAX_SOURCES = 8
SNIPPET_CHARS = 700
TIMEOUT_S = 15.0


class WebSearchError(Exception):
    """Error presentable al usuario."""


def validate_search_config(config: Optional[Dict]) -> Optional[Dict[str, str]]:
    """Normaliza {provider, apiKey, baseUrl}; None si no es usable."""
    from app.validators import is_safe_outbound_url

    if not isinstance(config, dict):
        return None
    provider = str(config.get("provider") or "").lower()
    if provider not in PROVIDERS:
        return None
    api_key = str(config.get("apiKey") or config.get("api_key") or "").strip()
    base_url = str(config.get("baseUrl") or config.get("base_url") or "").strip().rstrip("/")
    if len(api_key) > 300 or any(c.isspace() for c in api_key):
        return None
    if provider in ("tavily", "brave") and not api_key:
        return None
    if provider == "searxng" and (not base_url or not is_safe_outbound_url(base_url)):
        return None
    return {"provider": provider, "api_key": api_key, "base_url": base_url}


async def _search_one(client: httpx.AsyncClient, cfg: Dict[str, str], query: str) -> List[Dict]:
    provider = cfg["provider"]
    if provider == "tavily":
        r = await client.post("https://api.tavily.com/search", json={
            "api_key": cfg["api_key"], "query": query, "max_results": RESULTS_PER_QUERY,
            "search_depth": "basic", "include_answer": False,
        })
        if r.status_code in (401, 403):
            raise WebSearchError("API key de Tavily inválida")
        r.raise_for_status()
        items = r.json().get("results", [])
        return [{"title": i.get("title", ""), "url": i.get("url", ""), "content": i.get("content", "")} for i in items]
    if provider == "brave":
        r = await client.get("https://api.search.brave.com/res/v1/web/search",
                             params={"q": query, "count": RESULTS_PER_QUERY},
                             headers={"X-Subscription-Token": cfg["api_key"], "Accept": "application/json"})
        if r.status_code in (401, 403, 422):
            raise WebSearchError("API key de Brave Search inválida")
        r.raise_for_status()
        items = (r.json().get("web") or {}).get("results", [])
        return [{"title": i.get("title", ""), "url": i.get("url", ""),
                 "content": re.sub(r"<[^>]+>", "", i.get("description", ""))} for i in items]
    r = await client.get(f"{cfg['base_url']}/search", params={"q": query, "format": "json"})
    r.raise_for_status()
    items = r.json().get("results", [])[:RESULTS_PER_QUERY]
    return [{"title": i.get("title", ""), "url": i.get("url", ""), "content": i.get("content", "")} for i in items]


async def search(cfg: Dict[str, str], queries: List[str]) -> List[Dict]:
    """Ejecuta las consultas en paralelo y devuelve fuentes únicas numeradas [W1]…"""
    async with httpx.AsyncClient(timeout=TIMEOUT_S, follow_redirects=False) as client:
        outcomes = await asyncio.gather(*(_search_one(client, cfg, q) for q in queries), return_exceptions=True)
    results: List[Dict] = []
    errors = []
    for outcome in outcomes:
        if isinstance(outcome, WebSearchError):
            raise outcome
        if isinstance(outcome, Exception):
            errors.append(outcome)
            continue
        results.extend(outcome)
    if not results and errors:
        logger.info("Búsqueda web falló: %s", errors[0])
        raise WebSearchError("El buscador no respondió")
    sources = unique_by([r for r in results if r.get("url", "").startswith(("http://", "https://"))], "url")
    return [{"label": f"W{i + 1}", "title": s["title"][:200] or s["url"], "url": s["url"],
             "content": (s.get("content") or "")[:SNIPPET_CHARS]} for i, s in enumerate(sources[:MAX_SOURCES])]


async def plan_queries(task: str, llm: LLMClient, language: str, history: List[Dict[str, str]],
                       usage: Usage) -> List[str]:
    """Pide al LLM 1-3 consultas de búsqueda; si falla, usa la consulta del usuario."""
    context = ""
    if history:
        context = "Contexto de la conversación:\n" + "\n".join(
            f"{m['role']}: {m['content'][:300]}" for m in history[-4:]) + "\n\n"
    lang = "español" if language == "es" else "English"
    messages = [
        {"role": "system", "content": (
            "Generas consultas para un buscador web que ayuden a responder el pedido con información "
            f'actual y verificable. Responde SOLO JSON: {{"queries": ["...", "..."]}} con 1 a {MAX_QUERIES} '
            f"consultas cortas, en {lang} o en inglés si da mejores resultados.")},
        {"role": "user", "content": f"{context}Pedido:\n{task[:1500]}"},
    ]
    try:
        raw = await llm.complete(messages, max_tokens=200, temperature=0.0, usage=usage)
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        queries = json.loads(match.group(0)).get("queries", []) if match else []
        queries = [str(q).strip()[:200] for q in queries if str(q).strip()][:MAX_QUERIES]
    except (LLMError, ValueError, AttributeError):
        queries = []
    return queries or [task[:200]]
