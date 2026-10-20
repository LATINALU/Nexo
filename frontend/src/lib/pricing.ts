/**
 * Costos y presupuesto. Los precios los define el usuario (USD por millón de tokens),
 * porque cambian seguido y dependen del proveedor; Nexo no inventa tarifas.
 * El gasto se registra en el navegador por día.
 */

export interface ModelPrice {
  input: number; // USD por 1M tokens de entrada
  output: number; // USD por 1M tokens de salida
}

export interface Budget {
  daily: number | null; // USD
  monthly: number | null;
}

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
}

const PRICES_KEY = "nexo_model_prices";
const BUDGET_KEY = "nexo_budget";
const LEDGER_KEY = "nexo_spend_ledger";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* storage bloqueado */ }
  window.dispatchEvent(new Event("nexo:pricing-changed"));
}

export const loadPrices = () => read<Record<string, ModelPrice>>(PRICES_KEY, {});
export const savePrices = (prices: Record<string, ModelPrice>) => write(PRICES_KEY, prices);
export const loadBudget = () => read<Budget>(BUDGET_KEY, { daily: null, monthly: null });
export const saveBudget = (budget: Budget) => write(BUDGET_KEY, budget);

/** Costo en USD, o null si el modelo no tiene precio configurado. */
export function costOf(model: string, usage: Usage, prices = loadPrices()): number | null {
  const price = prices[model];
  if (!price) return null;
  return (usage.prompt_tokens * price.input + usage.completion_tokens * price.output) / 1_000_000;
}

const today = (d = new Date()) => d.toISOString().slice(0, 10);

export function recordSpend(cost: number, date = new Date()) {
  if (!(cost > 0)) return;
  const ledger = read<Record<string, number>>(LEDGER_KEY, {});
  const day = today(date);
  ledger[day] = (ledger[day] || 0) + cost;
  // conservar ~13 meses
  const cutoff = today(new Date(date.getTime() - 400 * 86_400_000));
  for (const k of Object.keys(ledger)) if (k < cutoff) delete ledger[k];
  write(LEDGER_KEY, ledger);
}

export function spendSummary(date = new Date()): { today: number; month: number } {
  const ledger = read<Record<string, number>>(LEDGER_KEY, {});
  const month = today(date).slice(0, 7);
  let monthTotal = 0;
  for (const [day, value] of Object.entries(ledger)) if (day.startsWith(month)) monthTotal += value;
  return { today: ledger[today(date)] || 0, month: monthTotal };
}

/** Mensaje de bloqueo si se alcanzó el presupuesto, o null. */
export function budgetBlock(budget = loadBudget(), spend = spendSummary()): string | null {
  if (budget.daily != null && spend.today >= budget.daily) {
    return `Alcanzaste tu presupuesto diario (${formatUSD(budget.daily)}). Ajustalo en Ajustes → Costos.`;
  }
  if (budget.monthly != null && spend.month >= budget.monthly) {
    return `Alcanzaste tu presupuesto mensual (${formatUSD(budget.monthly)}). Ajustalo en Ajustes → Costos.`;
  }
  return null;
}

export function formatUSD(value: number): string {
  if (value === 0) return "US$0";
  if (value < 0.01) return `US$${value.toFixed(4)}`;
  return `US$${value.toFixed(2)}`;
}
