/**
 * Configuración del buscador web (el usuario trae su propia key).
 * Se guarda en el navegador solo si el usuario activó "guardar APIs";
 * si no, dura lo que la pestaña (sessionStorage).
 */

export type WebSearchProvider = "tavily" | "brave" | "searxng";

export interface WebSearchConfig {
  provider: WebSearchProvider;
  apiKey: string;
  baseUrl?: string;
}

export const WEB_SEARCH_PROVIDERS: Array<{ id: WebSearchProvider; name: string; needsKey: boolean; help: string; url: string }> = [
  { id: "tavily", name: "Tavily", needsKey: true, help: "Pensado para IA: devuelve el contenido de cada página. Plan gratuito disponible.", url: "https://tavily.com" },
  { id: "brave", name: "Brave Search", needsKey: true, help: "Índice propio e independiente. Plan gratuito disponible.", url: "https://brave.com/search/api/" },
  { id: "searxng", name: "SearXNG", needsKey: false, help: "Metabuscador que podés alojar vos mismo (requiere formato JSON habilitado).", url: "https://docs.searxng.org" },
];

const KEY = "nexo_web_search";

const persistent = () => localStorage.getItem("nexo-save-apis") === "true";

export function loadWebSearchConfig(): WebSearchConfig | null {
  try {
    const raw = localStorage.getItem(KEY) || sessionStorage.getItem(KEY);
    const cfg = raw ? JSON.parse(raw) : null;
    return cfg?.provider ? cfg : null;
  } catch {
    return null;
  }
}

export function saveWebSearchConfig(cfg: WebSearchConfig | null): void {
  try {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);
    if (cfg) (persistent() ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(cfg));
  } catch { /* storage bloqueado */ }
  window.dispatchEvent(new Event("nexo:web-search-changed"));
}

export function isWebSearchReady(cfg: WebSearchConfig | null): boolean {
  if (!cfg) return false;
  return cfg.provider === "searxng" ? !!cfg.baseUrl : !!cfg.apiKey;
}

export async function testWebSearch(cfg: WebSearchConfig): Promise<{ success: boolean; results?: number; error?: string }> {
  const response = await fetch("/api/web-search/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ webSearch: cfg }),
  });
  return response.json();
}
