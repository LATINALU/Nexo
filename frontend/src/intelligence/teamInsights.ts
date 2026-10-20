/**
 * Análisis del equipo seleccionado: cobertura de categorías, tamaño y redundancia.
 */

import type { Agent } from "@/lib/api";

export interface TeamInsight {
  id: string;
  level: "info" | "warn";
  text: string;
}

export interface TeamAnalysis {
  categories: Array<{ id: string; count: number }>;
  insights: TeamInsight[];
}

export function analyzeTeam(selected: Agent[], opts: { synthesize: boolean; review: boolean }): TeamAnalysis {
  const byCategory = new Map<string, number>();
  for (const a of selected) byCategory.set(a.category, (byCategory.get(a.category) || 0) + 1);
  const categories = Array.from(byCategory.entries()).map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count);
  const insights: TeamInsight[] = [];
  const n = selected.length;

  if (n >= 7) {
    insights.push({ id: "big", level: "warn", text: `Equipo grande (${n}): más costo y respuestas más cortas por agente. 3–5 suele bastar.` });
  }
  if (n >= 4 && categories.length === 1) {
    insights.push({ id: "mono", level: "info", text: "Todos son de la misma categoría: sumá otra perspectiva (negocio, legal, finanzas…)." });
  }
  const crowded = categories.find((c) => c.count >= 4 && categories.length > 1);
  if (crowded) {
    insights.push({ id: "crowded", level: "info", text: `${crowded.count} agentes de una misma categoría pueden repetirse entre sí.` });
  }
  if (n >= 3 && !opts.synthesize) {
    insights.push({ id: "nosynth", level: "info", text: "Con varios agentes, la respuesta integrada evita leer todo por separado." });
  }
  if (n === 1 && opts.review) {
    insights.push({ id: "solo-review", level: "info", text: "Un agente con revisión crítica: buena combinación para temas delicados." });
  }
  return { categories, insights: insights.slice(0, 2) };
}
