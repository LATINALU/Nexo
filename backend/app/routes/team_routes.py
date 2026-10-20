"""
Nexo - Equipos guardados
========================
Un equipo = agentes + modo + síntesis + búsqueda web + instrucciones por agente.
Los invitados los guardan en el navegador; con sesión se sincronizan aquí.
"""

import json
import uuid
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

from app.agents.catalog import AGENTS
from app.auth import get_current_user
from app.pg_database import pg_db

router = APIRouter(prefix="/api/teams", tags=["Teams"])

MAX_TEAMS_PER_USER = 100
MAX_AGENTS_PER_TEAM = 10


class TeamIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    emoji: str = Field("👥", max_length=16)
    description: str = Field("", max_length=300)
    agents: List[str] = Field(..., min_length=1, max_length=MAX_AGENTS_PER_TEAM)
    mode: str = "parallel"
    synthesize: bool = True
    web_search: bool = False
    instructions: Dict[str, str] = Field(default_factory=dict)

    @field_validator("agents")
    @classmethod
    def known_agents(cls, v: List[str]) -> List[str]:
        agents = [a for a in dict.fromkeys(v) if a in AGENTS]
        if not agents:
            raise ValueError("El equipo necesita al menos un agente válido")
        return agents

    @field_validator("mode")
    @classmethod
    def valid_mode(cls, v: str) -> str:
        return v if v in ("parallel", "sequential") else "parallel"

    @field_validator("instructions")
    @classmethod
    def trim_instructions(cls, v: Dict[str, str]) -> Dict[str, str]:
        return {k: str(text)[:1500] for k, text in v.items() if k in AGENTS and str(text).strip()}


def _row(r) -> Dict[str, Any]:
    instructions = r["instructions"]
    return {
        "id": str(r["id"]), "name": r["name"], "emoji": r["emoji"], "description": r["description"],
        "agents": list(r["agents"]), "mode": r["mode"], "synthesize": r["synthesize"],
        "web_search": r["web_search"],
        "instructions": json.loads(instructions) if isinstance(instructions, str) else (instructions or {}),
        "updated_at": r["updated_at"].isoformat() if r["updated_at"] else None,
    }


def _pool():
    if not pg_db._pool:
        raise HTTPException(status_code=503, detail="Base de datos no disponible")
    return pg_db._pool


@router.get("")
async def list_teams(user: Dict[str, Any] = Depends(get_current_user)):
    async with _pool().acquire() as conn:
        rows = await conn.fetch("SELECT * FROM public.nexo_teams WHERE user_id = $1 ORDER BY updated_at DESC",
                                uuid.UUID(str(user["user_id"])))
    return {"teams": [_row(r) for r in rows]}


@router.post("")
async def create_team(team: TeamIn, user: Dict[str, Any] = Depends(get_current_user)):
    uid = uuid.UUID(str(user["user_id"]))
    async with _pool().acquire() as conn:
        if await conn.fetchval("SELECT COUNT(*) FROM public.nexo_teams WHERE user_id = $1", uid) >= MAX_TEAMS_PER_USER:
            raise HTTPException(status_code=409, detail=f"Máximo {MAX_TEAMS_PER_USER} equipos")
        row = await conn.fetchrow("""
            INSERT INTO public.nexo_teams (user_id, name, emoji, description, agents, mode, synthesize, web_search,
                                           instructions)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *
        """, uid, team.name, team.emoji, team.description, team.agents, team.mode, team.synthesize,
            team.web_search, json.dumps(team.instructions))
    return _row(row)


@router.put("/{team_id}")
async def update_team(team_id: str, team: TeamIn, user: Dict[str, Any] = Depends(get_current_user)):
    try:
        tid = uuid.UUID(team_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Equipo no encontrado")
    async with _pool().acquire() as conn:
        row = await conn.fetchrow("""
            UPDATE public.nexo_teams SET name = $3, emoji = $4, description = $5, agents = $6, mode = $7,
                   synthesize = $8, web_search = $9, instructions = $10, updated_at = NOW()
            WHERE id = $1 AND user_id = $2 RETURNING *
        """, tid, uuid.UUID(str(user["user_id"])), team.name, team.emoji, team.description, team.agents,
            team.mode, team.synthesize, team.web_search, json.dumps(team.instructions))
    if not row:
        raise HTTPException(status_code=404, detail="Equipo no encontrado")
    return _row(row)


@router.delete("/{team_id}")
async def delete_team(team_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    try:
        tid = uuid.UUID(team_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Equipo no encontrado")
    async with _pool().acquire() as conn:
        result = await conn.execute("DELETE FROM public.nexo_teams WHERE id = $1 AND user_id = $2",
                                    tid, uuid.UUID(str(user["user_id"])))
    if result != "DELETE 1":
        raise HTTPException(status_code=404, detail="Equipo no encontrado")
    return {"deleted": True}
