"use client";

import { useEffect, useState } from "react";
import { DollarSign, Wallet } from "lucide-react";
import type { ApiProvider } from "@/components/AppSettings";
import {
  Budget, ModelPrice, formatUSD, loadBudget, loadPrices, saveBudget, savePrices, spendSummary,
} from "@/lib/pricing";

function NumberInput({ value, onChange, placeholder }: { value: number | null | undefined; onChange: (v: number | null) => void; placeholder?: string }) {
  return (
    <input
      type="number" min={0} step="0.01" inputMode="decimal" placeholder={placeholder}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : Math.max(0, Number(e.target.value)))}
      className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-sm font-mono"
    />
  );
}

export function CostSettings({ providers }: { providers: ApiProvider[] }) {
  const [prices, setPrices] = useState<Record<string, ModelPrice>>({});
  const [budget, setBudget] = useState<Budget>({ daily: null, monthly: null });
  const [spend, setSpend] = useState({ today: 0, month: 0 });

  useEffect(() => {
    setPrices(loadPrices());
    setBudget(loadBudget());
    setSpend(spendSummary());
  }, []);

  const models = Array.from(new Set(providers.flatMap((p) => (p.isActive ? p.enabledModels || [] : []))));

  const setPrice = (model: string, field: keyof ModelPrice, value: number | null) => {
    const current = prices[model] || { input: 0, output: 0 };
    const next = { ...prices };
    const updated = { ...current, [field]: value ?? 0 };
    if (!updated.input && !updated.output) delete next[model];
    else next[model] = updated;
    setPrices(next);
    savePrices(next);
  };

  const updateBudget = (next: Budget) => {
    setBudget(next);
    saveBudget(next);
  };

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-xl border border-border">
          <div className="text-xs text-muted-foreground">Gastado hoy</div>
          <div className="text-2xl font-black text-primary">{formatUSD(spend.today)}</div>
        </div>
        <div className="p-4 rounded-xl border border-border">
          <div className="text-xs text-muted-foreground">Este mes</div>
          <div className="text-2xl font-black text-primary">{formatUSD(spend.month)}</div>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Wallet className="h-4 w-4 text-primary" />Presupuesto</h3>
        <p className="text-xs text-muted-foreground">Al alcanzarlo, Nexo no envía más consultas hasta el día/mes siguiente. Vacío = sin límite.</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs space-y-1"><span className="font-semibold">Diario (USD)</span>
            <NumberInput value={budget.daily} onChange={(daily) => updateBudget({ ...budget, daily })} placeholder="sin límite" />
          </label>
          <label className="text-xs space-y-1"><span className="font-semibold">Mensual (USD)</span>
            <NumberInput value={budget.monthly} onChange={(monthly) => updateBudget({ ...budget, monthly })} placeholder="sin límite" />
          </label>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><DollarSign className="h-4 w-4 text-primary" />Precios por modelo</h3>
        <p className="text-xs text-muted-foreground">
          USD por <b>millón</b> de tokens, según la página de precios de tu proveedor. Sin precio, Nexo muestra solo tokens
          y ese consumo no cuenta para el presupuesto.
        </p>
        {models.length === 0 ? (
          <p className="text-xs text-amber-500">Habilitá modelos en “APIs & Modelos” para cargar sus precios.</p>
        ) : (
          <div className="rounded-xl border border-border divide-y divide-border">
            <div className="grid grid-cols-[1fr_100px_100px] gap-2 px-3 py-2 text-[11px] font-semibold text-muted-foreground">
              <span>Modelo</span><span>Entrada</span><span>Salida</span>
            </div>
            {models.map((m) => (
              <div key={m} className="grid grid-cols-[1fr_100px_100px] gap-2 px-3 py-2 items-center">
                <span className="text-xs font-mono truncate" title={m}>{m}</span>
                <NumberInput value={prices[m]?.input} onChange={(v) => setPrice(m, "input", v)} placeholder="0.00" />
                <NumberInput value={prices[m]?.output} onChange={(v) => setPrice(m, "output", v)} placeholder="0.00" />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
