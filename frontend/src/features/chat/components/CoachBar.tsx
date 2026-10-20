"use client";

import { AlertTriangle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CoachAction, CoachTip } from "@/intelligence/queryCoach";

/** Sugerencias del coach mientras se escribe la consulta. */
export function CoachBar({ tips, onAction }: { tips: CoachTip[]; onAction: (action: CoachAction) => void }) {
  if (!tips.length) return null;
  return (
    <div className="flex flex-col gap-1 mb-2" aria-live="polite">
      {tips.map((tip) => (
        <div key={tip.id} className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs",
          tip.level === "warn" ? "border-amber-500/40 bg-amber-500/10 text-amber-500" : "border-primary/15 bg-primary/5 text-muted-foreground",
        )}>
          {tip.level === "warn" ? <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> : <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />}
          <span className="flex-1">{tip.text}</span>
          {tip.action && (
            <button onClick={() => onAction(tip.action!)} className="shrink-0 font-semibold text-primary hover:underline">
              {tip.actionLabel}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
