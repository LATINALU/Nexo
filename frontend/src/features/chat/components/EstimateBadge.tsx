"use client";

import { Gauge } from "lucide-react";
import { RunEstimate, formatTokens } from "@/intelligence/estimator";
import { formatUSD } from "@/lib/pricing";

/** Estimación previa: llamadas, tokens y costo de enviar la consulta así. */
export function EstimateBadge({ estimate }: { estimate: RunEstimate | null }) {
  if (!estimate) return null;
  const cost = estimate.costLow != null && estimate.costHigh != null
    ? ` · ${formatUSD(estimate.costLow)}–${formatUSD(estimate.costHigh)}`
    : "";
  const detail = [
    `${estimate.calls} llamadas al modelo: ${estimate.breakdown.join(", ")}`,
    estimate.calibrated ? "Calibrado con tus consultas anteriores." : "Estimación inicial: se ajusta con el uso.",
    estimate.costLow == null ? "Cargá el precio del modelo en Ajustes → Costos para ver el costo." : "",
  ].filter(Boolean).join("\n");
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground font-mono cursor-help" title={detail}>
      <Gauge className="h-3 w-3" />
      ≈{formatTokens(estimate.tokensLow)}–{formatTokens(estimate.tokensHigh)} tok · {estimate.calls} llamadas{cost}
    </span>
  );
}
