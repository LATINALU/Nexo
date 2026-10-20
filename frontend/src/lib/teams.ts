/**
 * Equipos guardados: agentes + opciones de ejecución + instrucciones por agente.
 * Invitado: localStorage. Con sesión: /api/teams (los equipos locales se suben al iniciar sesión).
 */

import { fetchWithAuth, hasSession } from "@/lib/api";
import type { RunMode } from "@/lib/chat";

export interface Team {
  id: string;
  name: string;
  emoji: string;
  description?: string;
  agents: string[];
  mode: RunMode;
  synthesize: boolean;
  web_search: boolean;
  instructions: Record<string, string>;
  updated_at?: string;
}

export type TeamDraft = Omit<Team, "id" | "updated_at">;

const LOCAL_KEY = "nexo_teams";

function readLocal(): Team[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeLocal(teams: Team[]) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(teams));
  } catch { /* storage lleno o bloqueado */ }
}

export async function listTeams(): Promise<Team[]> {
  if (!hasSession()) return readLocal();
  try {
    const response = await fetchWithAuth("/api/teams");
    if (!response.ok) return readLocal();
    const data = await response.json();
    return data.teams as Team[];
  } catch {
    return readLocal();
  }
}

export async function createTeam(draft: TeamDraft): Promise<Team> {
  if (hasSession()) {
    const response = await fetchWithAuth("/api/teams", { method: "POST", body: JSON.stringify(draft) });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.detail?.[0]?.msg || data?.detail || "No se pudo guardar el equipo");
    return data as Team;
  }
  const team: Team = { ...draft, id: `local_${Date.now().toString(36)}`, updated_at: new Date().toISOString() };
  writeLocal([team, ...readLocal()]);
  return team;
}

export async function deleteTeam(id: string): Promise<void> {
  if (hasSession() && !id.startsWith("local_")) {
    await fetchWithAuth(`/api/teams/${encodeURIComponent(id)}`, { method: "DELETE" });
    return;
  }
  writeLocal(readLocal().filter((t) => t.id !== id));
}

/** Al iniciar sesión: sube los equipos locales que no existan en la cuenta (por nombre). */
export async function syncLocalTeams(): Promise<void> {
  const local = readLocal();
  if (!local.length || !hasSession()) return;
  const remote = await listTeams();
  const names = new Set(remote.map((t) => t.name.toLowerCase()));
  for (const team of local) {
    if (names.has(team.name.toLowerCase())) continue;
    const { id: _id, updated_at: _u, ...draft } = team;
    await createTeam(draft).catch(() => {});
  }
  writeLocal([]);
}
