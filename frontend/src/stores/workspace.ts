/**
 * Estado de trabajo en memoria (no persistente): proveedores LLM y modelo activos,
 * agentes seleccionados, catálogo de agentes y buscador web.
 */

import { create } from "zustand";
import type { ApiProvider } from "@/components/AppSettings";
import { Agent, getAgents } from "@/lib/api";
import { WebSearchConfig, isWebSearchReady, loadWebSearchConfig, saveWebSearchConfig } from "@/lib/webSearch";

export const MAX_SELECTED_AGENTS = 10;
export const DEFAULT_MODEL = "openai/gpt-oss-120b";

const EMPTY_PROVIDER: ApiProvider = {
  id: "groq", name: "Groq", type: "groq", apiKey: "", baseUrl: "https://api.groq.com/openai/v1",
  models: [], enabledModels: [], isActive: false,
};

const isUsable = (p: ApiProvider) => p.isActive && (!!p.apiKey || p.type === "local") && (p.enabledModels?.length || 0) > 0;

interface WorkspaceState {
  // proveedores
  providers: ApiProvider[];
  apiConfig: ApiProvider;
  model: string;
  setProviders: (providers: ApiProvider[]) => void;
  selectModel: (provider: ApiProvider, model: string) => void;
  // selección
  selectedAgents: string[];
  toggleAgent: (id: string) => void;
  setAgents: (ids: string[]) => void;
  toggleCategory: (ids: string[]) => void;
  // catálogo
  catalog: Agent[];
  catalogStatus: "idle" | "loading" | "ready" | "error";
  loadCatalog: () => Promise<void>;
  // búsqueda web (la key vive en lib/webSearch con su política de guardado)
  webSearch: WebSearchConfig | null;
  setWebSearch: (cfg: WebSearchConfig | null) => void;
  hydrateWebSearch: () => void;
}

export const useWorkspace = create<WorkspaceState>()((set, get) => ({
  providers: [],
  apiConfig: EMPTY_PROVIDER,
  model: DEFAULT_MODEL,
  setProviders: (providers) => {
    const active = providers.find(isUsable);
    set((s) => ({
      providers,
      apiConfig: active || EMPTY_PROVIDER,
      model: active ? (active.enabledModels?.includes(s.model) ? s.model : active.enabledModels?.[0] || DEFAULT_MODEL) : s.model,
    }));
  },
  selectModel: (provider, model) => set({ apiConfig: provider, model }),

  selectedAgents: [],
  toggleAgent: (id) =>
    set((s) => ({
      selectedAgents: s.selectedAgents.includes(id)
        ? s.selectedAgents.filter((a) => a !== id)
        : s.selectedAgents.length >= MAX_SELECTED_AGENTS ? s.selectedAgents : [...s.selectedAgents, id],
    })),
  setAgents: (ids) => set({ selectedAgents: Array.from(new Set(ids)).slice(0, MAX_SELECTED_AGENTS) }),
  toggleCategory: (ids) =>
    set((s) => ({
      selectedAgents: ids.every((id) => s.selectedAgents.includes(id))
        ? s.selectedAgents.filter((id) => !ids.includes(id))
        : [...s.selectedAgents, ...ids.filter((id) => !s.selectedAgents.includes(id))].slice(0, MAX_SELECTED_AGENTS),
    })),

  catalog: [],
  catalogStatus: "idle",
  loadCatalog: async () => {
    if (get().catalogStatus === "loading" || get().catalogStatus === "ready") return;
    set({ catalogStatus: "loading" });
    try {
      const { agents } = await getAgents();
      set({ catalog: agents, catalogStatus: "ready" });
    } catch {
      set({ catalogStatus: "error" });
    }
  },

  webSearch: null,
  setWebSearch: (cfg) => {
    saveWebSearchConfig(cfg);
    set({ webSearch: cfg });
  },
  hydrateWebSearch: () => set({ webSearch: loadWebSearchConfig() }),
}));

// ---- selectores derivados ---------------------------------------------------

export const selectApiReady = (s: WorkspaceState) => !!(s.apiConfig.isActive && (s.apiConfig.apiKey || s.apiConfig.type === "local"));
export const selectWebReady = (s: WorkspaceState) => isWebSearchReady(s.webSearch);
export const selectEnabledProviders = (s: WorkspaceState) => s.providers.filter((p) => p.isActive && (p.enabledModels?.length || 0) > 0);
