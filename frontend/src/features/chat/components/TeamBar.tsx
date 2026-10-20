"use client";

import { useMemo } from "react";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { analyzeTeam } from "@/intelligence/teamInsights";
import { useSettings } from "@/stores/settings";
import { useWorkspace } from "@/stores/workspace";

/** Quién está en el equipo y qué conviene ajustar. */
export function TeamBar() {
  const selected = useWorkspace((s) => s.selectedAgents);
  const catalog = useWorkspace((s) => s.catalog);
  const toggleAgent = useWorkspace((s) => s.toggleAgent);
  const options = useSettings((s) => s.runOptions);

  const agents = useMemo(() => selected.map((id) => catalog.find((a) => a.id === id)).filter((a) => !!a) as typeof catalog, [selected, catalog]);
  const analysis = useMemo(() => analyzeTeam(agents, options), [agents, options]);

  if (!selected.length) return null;
  return (
    <div className="px-4 py-2 border-b border-primary/10 bg-muted/10 flex flex-wrap items-center gap-1.5 text-xs">
      <Users className="h-3.5 w-3.5 text-primary" />
      {agents.map((a) => (
        <button key={a.id} onClick={() => toggleAgent(a.id)} title={`${a.specialization} · clic para quitar`}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-primary/25 bg-primary/5 hover:border-red-400 hover:text-red-400">
          <span>{a.emoji}</span>{a.name}
        </button>
      ))}
      {analysis.insights.map((insight) => (
        <span key={insight.id} className={cn("ml-1", insight.level === "warn" ? "text-amber-500" : "text-muted-foreground")}>
          · {insight.text}
        </span>
      ))}
    </div>
  );
}
