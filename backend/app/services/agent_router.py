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
import math
import re
from typing import Dict, List, Optional, Tuple

from app.agents.catalog import AGENTS, CATEGORY_SPECS, AgentSpec
from app.services.llm_client import LLMClient, LLMError, Usage
from app.services.text_utils import tokenize as _tokens

CANDIDATES = 40


def _fields(spec: AgentSpec) -> Tuple[set, set, set]:
    """Tokens por campo: (categoría, nombre/especialidad, descripciones/capacidades)."""
    cat = CATEGORY_SPECS.get(spec.category)
    category = set(_tokens(" ".join([cat.name if cat else "", spec.category.replace("_", " ")])))
    strong = set(_tokens(" ".join([spec.name, spec.specialization]))) - category
    weak = set(_tokens(" ".join([spec.description, spec.short_description,
                                 " ".join(spec.capabilities).replace("_", " ")]))) - strong - category
    return category, strong, weak


_FIELDS: Dict[str, Tuple[set, set, set]] = {aid: _fields(s) for aid, s in AGENTS.items()}
_INDEX: Dict[str, set] = {aid: c | s | w for aid, (c, s, w) in _FIELDS.items()}
_DF: Dict[str, int] = {}
for _vocab in _INDEX.values():
    for _term in _vocab:
        _DF[_term] = _DF.get(_term, 0) + 1
_N = len(_INDEX)

# Pesos por campo: la categoría indica el rubro; el nombre, la especialidad; el resto, el detalle
_W_CATEGORY, _W_STRONG, _W_WEAK, _W_PARTIAL = 2.5, 2.0, 1.0, 0.5


def _idf(term: str) -> float:
    return math.log(1 + (_N - _DF.get(term, 0) + 0.5) / (_DF.get(term, 0) + 0.5))


def _score(words: List[str], aid: str) -> float:
    category, strong, weak = _FIELDS[aid]
    total = 0.0
    for w in words:
        if w in category:
            total += _W_CATEGORY * _idf(w)
        elif w in strong:
            total += _W_STRONG * _idf(w)
        elif w in weak:
            total += _W_WEAK * _idf(w)
        elif len(w) >= 5 and any(v.startswith(w[:5]) for v in _INDEX[aid]):
            # "programacion" ~ "programador": coincidencia parcial por raíz
            total += _W_PARTIAL * _idf(w)
    return total


def prefilter(task: str, limit: int = CANDIDATES) -> List[AgentSpec]:
    """Agentes ordenados por relevancia léxica (IDF + peso por campo)."""
    words = list(dict.fromkeys(_tokens(task)))
    if not words:
        return []
    scored = [(score, aid) for aid in _INDEX if (score := _score(words, aid)) > 0]
    scored.sort(key=lambda x: (-x[0], x[1]))
    return [AGENTS[aid] for _, aid in scored[:limit]]


def diversified(candidates: List[AgentSpec], k: int, per_category: int = 2) -> List[AgentSpec]:
    """Los mejores k, con como máximo `per_category` de cada categoría (equipos más complementarios)."""
    chosen: List[AgentSpec] = []
    counts: Dict[str, int] = {}
    for spec in candidates:
        if counts.get(spec.category, 0) < per_category:
            chosen.append(spec)
            counts[spec.category] = counts.get(spec.category, 0) + 1
        if len(chosen) == k:
            break
    return chosen


async def suggest_agents(task: str, llm: Optional[LLMClient], max_agents: int = 4,
                         language: str = "es") -> Dict[str, object]:
    candidates = prefilter(task)
    if not candidates:
        return {"agents": [], "reason": ""}
    fallback = {"agents": [c.id for c in diversified(candidates, max_agents)], "reason": ""}
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
