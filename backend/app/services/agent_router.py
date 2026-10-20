"""
Nexo - Sugerencia automática de agentes
======================================
Dado un pedido del usuario, propone el equipo de agentes más adecuado:
  1. Prefiltro léxico barato sobre los 500 agentes (top N candidatos).
  2. El LLM elige entre los candidatos y justifica brevemente.
Si el LLM falla, se devuelve el top del prefiltro.
"""

from __future__ import annotations

import json
import re
from typing import Dict, List, Optional

from app.agents.catalog import AGENTS, CATEGORY_SPECS, AgentSpec
from app.services.llm_client import LLMClient, LLMError, Usage
from app.services.text_utils import tokenize as _tokens

CANDIDATES = 40


def _index_text(spec: AgentSpec) -> str:
    cat = CATEGORY_SPECS.get(spec.category)
    return " ".join([spec.name, spec.description, spec.short_description, spec.specialization,
                     " ".join(spec.capabilities).replace("_", " "), cat.name if cat else ""])


_INDEX: Dict[str, set] = {aid: set(_tokens(_index_text(s))) for aid, s in AGENTS.items()}


def prefilter(task: str, limit: int = CANDIDATES) -> List[AgentSpec]:
    words = _tokens(task)
    if not words:
        return []
    scored = []
    for aid, vocab in _INDEX.items():
        # coincidencia exacta o por prefijo (marketing ~ marketplace no, pero "program" ~ "programacion" sí)
        score = sum(1.0 if w in vocab else 0.5 if any(v.startswith(w[:6]) for v in vocab) else 0.0
                    for w in words)
        if score:
            scored.append((score, aid))
    scored.sort(key=lambda x: (-x[0], x[1]))
    return [AGENTS[aid] for _, aid in scored[:limit]]


async def suggest_agents(task: str, llm: Optional[LLMClient], max_agents: int = 4,
                         language: str = "es") -> Dict[str, object]:
    candidates = prefilter(task)
    if not candidates:
        return {"agents": [], "reason": ""}
    fallback = {"agents": [c.id for c in candidates[:max_agents]], "reason": ""}
    if llm is None:
        return fallback

    listing = "\n".join(f"- {c.id}: {c.name} — {c.short_description or c.description}" for c in candidates)
    lang = "español" if language == "es" else "English"
    messages = [
        {"role": "system", "content": (
            "Eliges el equipo mínimo de especialistas para resolver un pedido. Responde SOLO JSON válido: "
            '{"agents": ["id1", "id2"], "reason": "una frase"}. '
            f"Usa entre 1 y {max_agents} ids de la lista, ordenados por relevancia. "
            f"La razón va en {lang}.")},
        {"role": "user", "content": f"Pedido:\n{task[:2000]}\n\nCandidatos:\n{listing}"},
    ]
    try:
        raw = await llm.complete(messages, max_tokens=300, temperature=0.0, usage=Usage())
    except LLMError:
        return fallback
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    try:
        data = json.loads(match.group(0)) if match else {}
    except json.JSONDecodeError:
        data = {}
    valid_ids = {c.id for c in candidates}
    chosen = [a for a in dict.fromkeys(data.get("agents") or []) if a in valid_ids][:max_agents]
    if not chosen:
        return fallback
    return {"agents": chosen, "reason": str(data.get("reason") or "")[:300]}
