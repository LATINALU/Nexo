"""
Nexo - Orquestador multi-agente
==============================
Ejecuta los agentes seleccionados sobre una consulta y emite eventos en vivo.

Modos:
  - parallel   (default): todos los agentes trabajan a la vez sobre la consulta.
  - sequential: cada agente recibe un resumen de lo que dijeron los anteriores.

Si hay más de un agente, un Coordinador final sintetiza una respuesta integrada
(patrón manager-worker). Toda la salida se transmite token a token.

Eventos emitidos (dict con "type"):
  pipeline_start, agent_start, agent_token, agent_response, agent_error,
  synthesis_start, synthesis_token, synthesis_complete, pipeline_complete
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, Dict, List, Optional

from app.agents.catalog import FORMAT_HINTS, AgentSpec
from app.formatters.human_formatter import HumanResponseFormatter
from app.services.llm_client import LLMClient, LLMError, Usage

logger = logging.getLogger("nexo.orchestrator")

Emit = Callable[[Dict[str, Any]], Awaitable[None]]

MAX_PARALLEL_AGENTS = 4
MAX_HISTORY_MESSAGES = 8
MAX_HISTORY_CHARS = 2500
SYNTHESIS_INPUT_CHARS = 3500
TOKEN_FLUSH_CHARS = 48
TOKEN_FLUSH_SECONDS = 0.05

SYNTHESIS_AGENT_ID = "coordinator"

_TEXT = {
    "es": {
        "identity": "Respondes siempre en español.",
        "format": "Estructura sugerida",
        "focus": ("Trabajas dentro de un equipo de especialistas. Aporta lo que corresponde a TU especialidad "
                  "con profundidad práctica, sin relleno ni repetir la consulta."),
        "memory": "Contexto persistente del usuario (úsalo si es relevante)",
        "previous": "Aportes previos del equipo (complementa, no repitas)",
        "synth_name": "Coordinador",
        "synth_system": (
            "Eres el Coordinador de un equipo de agentes especialistas. Integras sus aportes en UNA respuesta "
            "final clara y accionable para el usuario. Resuelve contradicciones explicitando el criterio, "
            "elimina redundancias, conserva datos concretos (cifras, código, pasos) y termina con un plan de "
            "acción priorizado. No menciones que eres un modelo ni describas el proceso interno."),
        "synth_user": "Consulta del usuario",
        "synth_inputs": "Aportes de los especialistas",
        "synth_task": "Escribe la respuesta final integrada en markdown.",
    },
    "en": {
        "identity": "Always answer in English.",
        "format": "Suggested structure",
        "focus": ("You work inside a team of specialists. Contribute what belongs to YOUR specialty with "
                  "practical depth, no filler and without restating the request."),
        "memory": "Persistent user context (use it when relevant)",
        "previous": "Previous team contributions (build on them, don't repeat)",
        "synth_name": "Coordinator",
        "synth_system": (
            "You are the Coordinator of a team of specialist agents. Merge their contributions into ONE clear, "
            "actionable final answer. Resolve contradictions stating the criterion, remove redundancy, keep "
            "concrete data (figures, code, steps) and finish with a prioritized action plan. Do not mention "
            "being a model or describe the internal process."),
        "synth_user": "User request",
        "synth_inputs": "Specialist contributions",
        "synth_task": "Write the integrated final answer in markdown.",
    },
}


def tokens_per_agent(agent_count: int) -> int:
    """Presupuesto de salida por agente según el tamaño del equipo."""
    if agent_count <= 1:
        return 3000
    if agent_count <= 3:
        return 2048
    return 1500


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _truncate(text: str, limit: int) -> str:
    return text if len(text) <= limit else text[:limit].rsplit(" ", 1)[0] + " …"


def compact_summary(text: str, limit: int = 400) -> str:
    """Resumen corto de una respuesta para pasar contexto entre agentes (modo secuencial)."""
    lines = [ln.strip() for ln in text.splitlines()]
    useful = [ln for ln in lines if ln and not ln.startswith(("```", "---", "|-"))]
    return _truncate(" | ".join(useful), limit)


def sanitize_history(history: Any) -> List[Dict[str, str]]:
    """Últimos turnos válidos de la conversación enviados por el cliente."""
    if not isinstance(history, list):
        return []
    clean = []
    for item in history[-MAX_HISTORY_MESSAGES:]:
        if not isinstance(item, dict):
            continue
        role = item.get("role")
        content = item.get("content")
        if role in ("user", "assistant") and isinstance(content, str) and content.strip():
            clean.append({"role": role, "content": _truncate(content.strip(), MAX_HISTORY_CHARS)})
    return clean


class _TokenBuffer:
    """Agrupa fragmentos para no emitir un mensaje WebSocket por token."""

    def __init__(self, emit: Emit, event_type: str, agent_id: str):
        self._emit, self._type, self._agent_id = emit, event_type, agent_id
        self._parts: List[str] = []
        self._size = 0
        self._last = time.monotonic()

    async def push(self, delta: str) -> None:
        self._parts.append(delta)
        self._size += len(delta)
        if self._size >= TOKEN_FLUSH_CHARS or time.monotonic() - self._last >= TOKEN_FLUSH_SECONDS:
            await self.flush()

    async def flush(self) -> None:
        if not self._parts:
            return
        text = "".join(self._parts)
        self._parts, self._size, self._last = [], 0, time.monotonic()
        await self._emit({"type": self._type, "agent_id": self._agent_id, "delta": text})


@dataclass
class AgentResult:
    spec: AgentSpec
    content: str = ""
    error: Optional[str] = None
    elapsed_ms: float = 0.0
    usage: Usage = field(default_factory=Usage)


class Orchestrator:

    def __init__(self, agents: List[AgentSpec], llm: LLMClient, emit: Emit, *, language: str = "es",
                 mode: str = "parallel", synthesize: bool = True, memory_context: str = "",
                 history: Optional[List[Dict[str, str]]] = None,
                 agent_instructions: Optional[Dict[str, str]] = None):
        if not agents:
            raise ValueError("Se requiere al menos un agente")
        self.agents = agents
        self.llm = llm
        self.emit = emit
        self.language = language if language in _TEXT else "es"
        self.mode = mode if mode in ("parallel", "sequential") else "parallel"
        self.synthesize = synthesize and len(agents) > 1
        self.memory_context = memory_context
        self.history = history or []
        self.agent_instructions = agent_instructions or {}
        self.usage = Usage()
        self.results: List[Dict[str, Any]] = []
        self.synthesis: Optional[str] = None
        self._t = _TEXT[self.language]

    # ------------------------------------------------------------------ prompts

    def _system_prompt(self, spec: AgentSpec) -> str:
        hint = FORMAT_HINTS.get(spec.response_format, FORMAT_HINTS["analysis"])[self.language]
        parts = [spec.system_prompt, "", self._t["focus"], f"{self._t['format']}: {hint}.", self._t["identity"]]
        extra = (self.agent_instructions.get(spec.id) or "").strip()
        if extra:
            parts += ["", extra[:1500]]
        if self.memory_context:
            parts += ["", f"## {self._t['memory']}", _truncate(self.memory_context, 3000)]
        return "\n".join(parts)

    def _messages(self, spec: AgentSpec, task: str, previous: List[AgentResult]) -> List[Dict[str, str]]:
        user = task
        if previous:
            notes = "\n".join(f"- {r.spec.name}: {compact_summary(r.content)}" for r in previous if r.content)
            if notes:
                user = f"{task}\n\n---\n{self._t['previous']}:\n{notes}"
        return [{"role": "system", "content": self._system_prompt(spec)}, *self.history,
                {"role": "user", "content": user}]

    # ---------------------------------------------------------------- ejecución

    def _public(self, spec: AgentSpec) -> Dict[str, Any]:
        return {"id": spec.id, "name": spec.name, "emoji": spec.emoji, "category": spec.category,
                "specialty": spec.specialization}

    async def _run_agent(self, spec: AgentSpec, task: str, step: int, previous: List[AgentResult],
                         max_tokens: int) -> AgentResult:
        result = AgentResult(spec=spec)
        started = time.monotonic()
        await self.emit({"type": "agent_start", "agent_id": spec.id, "agent": spec.name, "step": step,
                         "total": len(self.agents), "timestamp": _now()})
        buffer = _TokenBuffer(self.emit, "agent_token", spec.id)
        chunks: List[str] = []
        try:
            async for delta in self.llm.stream(self._messages(spec, task, previous), max_tokens=max_tokens,
                                               usage=result.usage):
                chunks.append(delta)
                await buffer.push(delta)
            await buffer.flush()
            result.content = "".join(chunks).strip()
            if not result.content:
                raise LLMError("El modelo devolvió una respuesta vacía")
        except LLMError as e:
            result.error = str(e)
        result.elapsed_ms = (time.monotonic() - started) * 1000
        self.usage.add(result.usage)

        if result.error:
            await self.emit({"type": "agent_error", "agent_id": spec.id, "agent": spec.name,
                             "error": result.error, "timestamp": _now()})
        else:
            formatted = self._format(result, step)
            self.results.append(formatted)
            await self.emit({"type": "agent_response", "data": formatted, "timestamp": _now()})
        return result

    def _format(self, result: AgentResult, step: int) -> Dict[str, Any]:
        spec = result.spec
        formatted = HumanResponseFormatter.format_agent_response(
            raw_response=result.content, agent_id=spec.id, agent_name=spec.name, level=3,
            specialty=spec.specialization, step=step, total_steps=len(self.agents), language=self.language,
        )
        formatted.update({
            "agent_emoji": spec.emoji,
            "category": spec.category,
            "format_type": spec.response_format,
            "raw_content": result.content,
            "elapsed_ms": round(result.elapsed_ms),
            "usage": result.usage.as_dict(),
        })
        return formatted

    async def _run_synthesis(self, task: str, results: List[AgentResult]) -> None:
        ok = [r for r in results if r.content]
        if len(ok) < 2:
            return
        await self.emit({"type": "synthesis_start", "agent_id": SYNTHESIS_AGENT_ID,
                         "agent": self._t["synth_name"], "timestamp": _now()})
        per_agent = max(800, SYNTHESIS_INPUT_CHARS * 3 // len(ok))
        inputs = "\n\n".join(f"### {r.spec.emoji} {r.spec.name}\n{_truncate(r.content, per_agent)}" for r in ok)
        messages = [
            {"role": "system", "content": f"{self._t['synth_system']}\n{self._t['identity']}"},
            *self.history,
            {"role": "user", "content": (f"## {self._t['synth_user']}\n{task}\n\n## {self._t['synth_inputs']}\n"
                                         f"{inputs}\n\n{self._t['synth_task']}")},
        ]
        usage = Usage()
        buffer = _TokenBuffer(self.emit, "synthesis_token", SYNTHESIS_AGENT_ID)
        chunks: List[str] = []
        try:
            async for delta in self.llm.stream(messages, max_tokens=2500, temperature=0.4, usage=usage):
                chunks.append(delta)
                await buffer.push(delta)
            await buffer.flush()
        except LLMError as e:
            await self.emit({"type": "agent_error", "agent_id": SYNTHESIS_AGENT_ID,
                             "agent": self._t["synth_name"], "error": str(e), "timestamp": _now()})
            return
        finally:
            self.usage.add(usage)
        self.synthesis = "".join(chunks).strip()
        await self.emit({"type": "synthesis_complete", "agent_id": SYNTHESIS_AGENT_ID,
                         "agent": self._t["synth_name"], "content": self.synthesis,
                         "usage": usage.as_dict(), "timestamp": _now()})

    async def run(self, task: str) -> Dict[str, Any]:
        started = time.monotonic()
        max_tokens = tokens_per_agent(len(self.agents))
        await self.emit({"type": "pipeline_start", "mode": self.mode, "synthesis": self.synthesize,
                         "total_agents": len(self.agents), "agents": [self._public(a) for a in self.agents],
                         "timestamp": _now()})

        if self.mode == "sequential":
            done: List[AgentResult] = []
            for step, spec in enumerate(self.agents, 1):
                done.append(await self._run_agent(spec, task, step, done, max_tokens))
        else:
            semaphore = asyncio.Semaphore(MAX_PARALLEL_AGENTS)

            async def limited(step: int, spec: AgentSpec) -> AgentResult:
                async with semaphore:
                    return await self._run_agent(spec, task, step, [], max_tokens)

            done = list(await asyncio.gather(*(limited(i, s) for i, s in enumerate(self.agents, 1))))

        if self.synthesize:
            await self._run_synthesis(task, done)

        elapsed_ms = (time.monotonic() - started) * 1000
        succeeded = [r.spec.id for r in done if not r.error]
        summary = HumanResponseFormatter.create_pipeline_summary(
            agents_completed=succeeded, total_time_ms=elapsed_ms,
            success=len(succeeded) == len(done), language=self.language,
        )
        summary.update({"usage": self.usage.as_dict(), "failed": [r.spec.id for r in done if r.error],
                        "has_synthesis": self.synthesis is not None})
        await self.emit({"type": "pipeline_complete", "data": summary, "timestamp": _now()})
        return summary
