"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { Agent, getAgent } from "@/lib/api";
import { cn } from "@/lib/utils";

interface AgentDetail extends Agent {
  full_description?: string;
  backstory?: string;
  category_name?: string;
}

interface AgentDetailPanelProps {
  agentId: string;
  isSelected: boolean;
  instructions?: string;
  onToggleSelected: (agentId: string) => void;
  onInstructionsChange: (agentId: string, instructions: string) => void;
  onClose: () => void;
}

const MAX_INSTRUCTIONS = 1500;

export function AgentDetailPanel({
  agentId,
  isSelected,
  instructions = "",
  onToggleSelected,
  onInstructionsChange,
  onClose,
}: AgentDetailPanelProps) {
  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState(instructions);

  useEffect(() => {
    let cancelled = false;
    setAgent(null);
    setError(null);
    getAgent(agentId)
      .then((data) => !cancelled && setAgent(data as AgentDetail))
      .catch(() => !cancelled && setError("No se pudo cargar el agente"));
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  useEffect(() => setDraft(instructions), [instructions]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-primary/30 bg-card/95 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-primary/20 px-6 py-5 sticky top-0 bg-card/95 backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{agent?.emoji || "🤖"}</span>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-[0.2em]">{agent?.category_name || "Agente"}</p>
              <h2 className="text-2xl font-semibold text-primary">{agent?.name || agentId}</h2>
              {agent?.specialization && <p className="text-sm text-muted-foreground">{agent.specialization}</p>}
            </div>
          </div>
          <button className="p-2 rounded-full border border-border hover:border-primary hover:text-primary" onClick={onClose} aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-6 space-y-6">
          {error && <p className="text-sm text-red-400">{error}</p>}
          {!agent && !error && <Loader2 className="h-5 w-5 animate-spin text-primary" />}

          {agent && (
            <>
              <section>
                <h3 className="text-sm font-semibold text-primary mb-2">Qué hace</h3>
                <p className="text-sm leading-relaxed">{agent.full_description || agent.description}</p>
              </section>
              {agent.backstory && (
                <section>
                  <h3 className="text-sm font-semibold text-primary mb-2">Experiencia</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{agent.backstory}</p>
                </section>
              )}
              {agent.capabilities?.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold text-primary mb-2">Capacidades</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {agent.capabilities.map((c) => (
                      <span key={c} className="px-3 py-1 text-[11px] rounded-full border border-primary/30 bg-primary/5 text-primary">
                        {c.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          <section>
            <h3 className="text-sm font-semibold text-primary mb-1">Instrucciones personalizadas</h3>
            <p className="text-xs text-muted-foreground mb-2">
              Se agregan al prompt de este agente en cada consulta (tono, formato, restricciones, contexto de tu empresa…).
            </p>
            <textarea
              value={draft}
              maxLength={MAX_INSTRUCTIONS}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ej.: Responde con ejemplos en Python y prioriza soluciones open source."
              className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/50 min-h-[120px]"
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] text-muted-foreground font-mono">{draft.length}/{MAX_INSTRUCTIONS}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => onToggleSelected(agentId)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors",
                    isSelected ? "border-primary bg-primary/20 text-primary" : "border-border hover:border-primary",
                  )}
                >
                  {isSelected ? <span className="inline-flex items-center gap-1"><Check className="h-3 w-3" />Seleccionado</span> : "Seleccionar"}
                </button>
                <button
                  onClick={() => {
                    onInstructionsChange(agentId, draft.trim());
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Guardar
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
