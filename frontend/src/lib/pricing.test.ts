import { beforeEach, describe, expect, it } from "vitest";
import { budgetBlock, costOf, formatUSD, recordSpend, saveBudget, savePrices, spendSummary } from "./pricing";

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(k: string) { return this.data.has(k) ? this.data.get(k)! : null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
  clear() { this.data.clear(); }
}

beforeEach(() => {
  (globalThis as any).localStorage = new MemoryStorage();
  (globalThis as any).window = { dispatchEvent: () => true };
  (globalThis as any).Event = class { constructor(public type: string) {} };
});

describe("costos", () => {
  it("calcula con precios por millón y devuelve null sin precio", () => {
    savePrices({ "gpt-x": { input: 2, output: 8 } });
    expect(costOf("gpt-x", { prompt_tokens: 500_000, completion_tokens: 250_000 })).toBeCloseTo(3);
    expect(costOf("otro", { prompt_tokens: 1, completion_tokens: 1 })).toBeNull();
  });

  it("acumula gasto por día y mes", () => {
    const d = new Date("2026-10-20T12:00:00Z");
    recordSpend(0.5, d);
    recordSpend(0.25, d);
    recordSpend(1, new Date("2026-10-02T12:00:00Z"));
    recordSpend(9, new Date("2026-09-30T12:00:00Z"));
    expect(spendSummary(d)).toEqual({ today: 0.75, month: 1.75 });
  });

  it("bloquea al alcanzar el presupuesto", () => {
    saveBudget({ daily: 1, monthly: null });
    expect(budgetBlock(undefined, { today: 0.9, month: 0.9 })).toBeNull();
    expect(budgetBlock(undefined, { today: 1, month: 1 })).toContain("diario");
    saveBudget({ daily: null, monthly: 5 });
    expect(budgetBlock(undefined, { today: 0, month: 6 })).toContain("mensual");
  });

  it("formatea montos chicos", () => {
    expect(formatUSD(0.0012)).toBe("US$0.0012");
    expect(formatUSD(1.5)).toBe("US$1.50");
  });
});
