"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Plus, Trash2, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Team, TeamDraft, createTeam, deleteTeam, listTeams } from "@/lib/teams";

const EMOJIS = ["👥", "🚀", "💼", "🧠", "🛠️", "📈", "🎯", "⚖️", "🎨", "🔬"];

interface TeamsPanelProps {
  /** Configuración actual que se guardaría como equipo */
  current: Omit<TeamDraft, "name" | "emoji" | "description">;
  onApply: (team: Team) => void;
}

export function TeamsPanel({ current, onApply }: TeamsPanelProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setTeams(await listTeams());
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
    window.addEventListener("nexo:session-changed", reload);
    return () => window.removeEventListener("nexo:session-changed", reload);
  }, [reload]);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const team = await createTeam({ ...current, name: name.trim(), emoji, description: "" });
      setTeams((prev) => [team, ...prev]);
      setCreating(false);
      setName("");
    } catch (e: any) {
      setError(e?.message || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    await deleteTeam(id);
    setTeams((prev) => prev.filter((t) => t.id !== id));
    setConfirmDelete(null);
  };

  return (
    <div className="p-2 border-b border-primary/10">
      <div className="flex items-center justify-between px-1 mb-1.5">
        <span className="font-bold text-[11px] uppercase tracking-wider text-primary flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" />Mis equipos
        </span>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            disabled={current.agents.length === 0}
            title={current.agents.length ? "Guardar la selección actual como equipo" : "Selecciona agentes primero"}
            className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-primary hover:underline disabled:opacity-40 disabled:no-underline"
          >
            <Plus className="h-3 w-3" />Guardar actual
          </button>
        )}
      </div>

      {creating && (
        <div className="mb-2 p-2 rounded-lg border border-primary/30 bg-primary/5 space-y-2">
          <div className="flex gap-1 flex-wrap">
            {EMOJIS.map((e) => (
              <button key={e} onClick={() => setEmoji(e)}
                className={cn("w-6 h-6 rounded text-sm", emoji === e ? "bg-primary/30" : "hover:bg-primary/10")}>{e}</button>
            ))}
          </div>
          <input
            autoFocus
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            placeholder="Nombre del equipo"
            className="w-full px-2 py-1.5 rounded-md border border-border bg-background text-xs"
          />
          <div className="text-[10px] text-muted-foreground">
            {current.agents.length} agentes · {current.mode === "parallel" ? "paralelo" : "secuencial"}
            {current.synthesize ? " · síntesis" : ""}{current.web_search ? " · web" : ""}
            {Object.keys(current.instructions).length ? ` · ${Object.keys(current.instructions).length} instrucciones` : ""}
          </div>
          {error && <div className="text-[10px] text-red-400">{error}</div>}
          <div className="flex justify-end gap-1">
            <button onClick={() => { setCreating(false); setError(null); }} className="p-1 rounded hover:bg-muted"><X className="h-3.5 w-3.5" /></button>
            <button onClick={save} disabled={!name.trim() || saving}
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-primary text-primary-foreground text-[11px] font-semibold disabled:opacity-50">
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}Guardar
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="px-1 py-2"><Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /></div>
      ) : teams.length === 0 ? (
        !creating && <p className="px-1 text-[10px] text-muted-foreground">Elegí agentes y guardalos como equipo para reutilizarlos.</p>
      ) : (
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {teams.map((team) => (
            <div key={team.id} className="group flex items-center gap-2 p-2 rounded-lg hover:bg-primary/10 border border-transparent hover:border-primary/20">
              <button onClick={() => onApply(team)} className="flex items-center gap-2 min-w-0 flex-1 text-left" title={`Usar ${team.name}`}>
                <span className="text-base">{team.emoji}</span>
                <span className="min-w-0">
                  <span className="block text-xs font-medium truncate">{team.name}</span>
                  <span className="block text-[10px] text-muted-foreground">
                    {team.agents.length} agentes{team.web_search ? " · web" : ""}{team.mode === "sequential" ? " · secuencial" : ""}
                  </span>
                </span>
              </button>
              {confirmDelete === team.id ? (
                <span className="flex items-center gap-1">
                  <button onClick={() => remove(team.id)} className="text-[10px] font-semibold text-red-400 hover:underline">Borrar</button>
                  <button onClick={() => setConfirmDelete(null)} className="p-0.5"><X className="h-3 w-3" /></button>
                </span>
              ) : (
                <button onClick={() => setConfirmDelete(team.id)} title="Eliminar equipo"
                  className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-red-400">
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
