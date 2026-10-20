"use client";

/**
 * Nexo - Equipos de agentes IA
 * 500 agentes especializados en 50 categorías.
 */

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Cpu, Settings, Zap } from "lucide-react";
import { CategorySidebar } from "@/components/CategorySidebar";
import { Chat } from "@/components/Chat";
import { TeamsPanel } from "@/components/TeamsPanel";
import type { RunOptions } from "@/lib/chat";
import type { Team } from "@/lib/teams";
import { WebSearchConfig, loadWebSearchConfig } from "@/lib/webSearch";
import { AppSettings, ApiProvider } from "@/components/AppSettings";
import { AgentDetailPanel } from "@/components/AgentDetailPanel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DEFAULT_MODEL = "openai/gpt-oss-120b";
const MAX_SELECTED_AGENTS = 10;
const INSTRUCTIONS_KEY = "nexo_agent_instructions";
const OPTIONS_KEY = "nexo_run_options";
const DEFAULT_OPTIONS: RunOptions = { mode: "parallel", synthesize: true, webSearch: false };

function loadOptions(): RunOptions {
  try {
    const saved = JSON.parse(localStorage.getItem(OPTIONS_KEY) || "{}");
    return {
      mode: saved.mode === "sequential" ? "sequential" : "parallel",
      synthesize: saved.synthesize !== false,
      webSearch: saved.webSearch === true,
    };
  } catch {
    return DEFAULT_OPTIONS;
  }
}

const EMPTY_PROVIDER: ApiProvider = {
  id: "groq",
  name: "Groq",
  type: "groq",
  apiKey: "",
  baseUrl: "https://api.groq.com/openai/v1",
  models: [],
  enabledModels: [],
  isActive: false,
};

function loadInstructions(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(INSTRUCTIONS_KEY) || "{}");
  } catch {
    return {};
  }
}

export default function HomePage() {
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [providers, setProviders] = useState<ApiProvider[]>([]);
  const [apiConfig, setApiConfig] = useState<ApiProvider>(EMPTY_PROVIDER);
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL);
  const [wsConnected, setWsConnected] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [detailAgentId, setDetailAgentId] = useState<string | null>(null);
  const [agentInstructions, setAgentInstructions] = useState<Record<string, string>>({});

  const [runOptions, setRunOptions] = useState<RunOptions>(DEFAULT_OPTIONS);
  const [webSearchConfig, setWebSearchConfig] = useState<WebSearchConfig | null>(null);

  useEffect(() => {
    setAgentInstructions(loadInstructions());
    setRunOptions(loadOptions());
    const refreshSearch = () => setWebSearchConfig(loadWebSearchConfig());
    refreshSearch();
    window.addEventListener("nexo:web-search-changed", refreshSearch);
    return () => window.removeEventListener("nexo:web-search-changed", refreshSearch);
  }, []);

  const updateRunOptions = useCallback((next: RunOptions) => {
    setRunOptions(next);
    try {
      localStorage.setItem(OPTIONS_KEY, JSON.stringify(next));
    } catch { /* storage lleno o bloqueado */ }
  }, []);

  const applyTeam = (team: Team) => {
    setSelectedAgents(team.agents.slice(0, MAX_SELECTED_AGENTS));
    updateRunOptions({ mode: team.mode, synthesize: team.synthesize, webSearch: team.web_search });
    setAgentInstructions((prev) => {
      const next = { ...prev, ...team.instructions };
      try {
        localStorage.setItem(INSTRUCTIONS_KEY, JSON.stringify(next));
      } catch { /* storage lleno o bloqueado */ }
      return next;
    });
  };

  const selectedInstructions = Object.fromEntries(
    Object.entries(agentInstructions).filter(([id]) => selectedAgents.includes(id)),
  );

  const apiReady = !!(apiConfig.isActive && (apiConfig.apiKey || apiConfig.type === "local"));
  const enabledProviders = providers.filter((p) => p.isActive && (p.enabledModels?.length || 0) > 0);

  const handleProvidersChange = useCallback((next: ApiProvider[]) => {
    setProviders(next);
    const active = next.find((p) => p.isActive && (p.apiKey || p.type === "local") && (p.enabledModels?.length || 0) > 0);
    if (!active) {
      setApiConfig(EMPTY_PROVIDER);
      return;
    }
    setApiConfig(active);
    setSelectedModel((current) => (active.enabledModels?.includes(current) ? current : active.enabledModels?.[0] || DEFAULT_MODEL));
  }, []);

  const toggleAgent = (agentId: string) =>
    setSelectedAgents((prev) =>
      prev.includes(agentId) ? prev.filter((id) => id !== agentId) : prev.length >= MAX_SELECTED_AGENTS ? prev : [...prev, agentId],
    );

  const toggleCategory = (agentIds: string[]) =>
    setSelectedAgents((prev) => {
      if (agentIds.every((id) => prev.includes(id))) return prev.filter((id) => !agentIds.includes(id));
      return [...prev, ...agentIds.filter((id) => !prev.includes(id))].slice(0, MAX_SELECTED_AGENTS);
    });

  const updateInstructions = (agentId: string, text: string) => {
    setAgentInstructions((prev) => {
      const next = { ...prev };
      if (text) next[agentId] = text;
      else delete next[agentId];
      try {
        localStorage.setItem(INSTRUCTIONS_KEY, JSON.stringify(next));
      } catch { /* storage lleno o bloqueado */ }
      return next;
    });
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden relative">
      <header className="h-16 border-b border-primary/20 bg-card/50 backdrop-blur-sm px-6 flex items-center justify-between shrink-0 relative z-20">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/favicon.svg" alt="" className="h-11 w-11 rounded-xl shadow-lg shadow-primary/20" />
          <div className="hidden sm:block">
            <h1 className="text-xl font-black tracking-tight bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">Nexo</h1>
            <span className="text-xs font-semibold text-muted-foreground">Equipos de agentes IA · 500 especialistas</span>
          </div>
        </div>

        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:flex items-center gap-3">
          <button
            onClick={() => !apiReady && setIsSettingsOpen(true)}
            className={cn(
              "flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-bold tracking-wider uppercase transition-all",
              apiReady
                ? "bg-green-500/10 border-green-500/30 text-green-500"
                : "bg-red-500/10 border-red-500/30 text-red-500 hover:bg-red-500/20",
            )}
            title={wsConnected ? "Servidor conectado en tiempo real" : "Servidor sin WebSocket (se usará SSE)"}
          >
            <Zap className={cn("h-4 w-4", apiReady && "fill-current")} />
            {apiReady ? `${apiConfig.name} lista` : "Configura tu API"}
            <span className={cn("h-2 w-2 rounded-full", wsConnected ? "bg-green-500" : "bg-amber-500")} />
          </button>

          <div className="relative">
            <button
              onClick={() => setShowModelDropdown(!showModelDropdown)}
              disabled={enabledProviders.length === 0}
              className={cn(
                "flex items-center gap-2 px-4 py-1.5 rounded-full border transition-all",
                enabledProviders.length ? "bg-primary/10 border-primary/30 text-primary hover:bg-primary/20" : "bg-muted/30 border-border text-muted-foreground",
              )}
            >
              <Cpu className="h-4 w-4" />
              <span className="text-xs font-mono max-w-40 truncate">{selectedModel || "Sin modelo"}</span>
              <ChevronDown className={cn("h-3 w-3 transition-transform", showModelDropdown && "rotate-180")} />
            </button>
            {showModelDropdown && enabledProviders.length > 0 && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowModelDropdown(false)} />
                <div className="absolute top-full left-0 mt-2 min-w-64 bg-card border border-border rounded-lg shadow-xl z-40 max-h-72 overflow-y-auto">
                  {enabledProviders.map((provider) => (
                    <div key={provider.id}>
                      <div className="px-3 py-2 bg-muted/30 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{provider.name}</div>
                      {(provider.enabledModels || []).map((m) => (
                        <button
                          key={m}
                          onClick={() => {
                            setSelectedModel(m);
                            setApiConfig(provider);
                            setShowModelDropdown(false);
                          }}
                          className={cn(
                            "w-full flex items-center justify-between px-3 py-2 hover:bg-primary/10 text-left",
                            m === selectedModel && provider.id === apiConfig.id && "bg-primary/20 text-primary",
                          )}
                        >
                          <span className="text-xs font-mono truncate">{m}</span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={() => setIsSettingsOpen(true)} className="gap-2">
          <Settings className="h-4 w-4" />Ajustes
        </Button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-80 border-r border-primary/20 flex-shrink-0 overflow-hidden">
          <CategorySidebar
            selectedAgents={selectedAgents}
            onAgentToggle={toggleAgent}
            onSelectCategory={(_categoryId, agentIds) => toggleCategory(agentIds)}
            onClearAll={() => setSelectedAgents([])}
            onShowAgentDetails={setDetailAgentId}
            isConnected={apiReady}
          />
        </div>

        <main className="flex-1 overflow-hidden">
          <Chat
            selectedAgents={selectedAgents}
            model={selectedModel}
            apiConfig={apiConfig}
            agentInstructions={selectedInstructions}
            options={runOptions}
            onOptionsChange={updateRunOptions}
            webSearchConfig={webSearchConfig}
            onConnectionChange={setWsConnected}
            onSelectPreset={(ids) => setSelectedAgents(ids.slice(0, MAX_SELECTED_AGENTS))}
            sidePanelHeader={
              <TeamsPanel
                current={{
                  agents: selectedAgents,
                  mode: runOptions.mode,
                  synthesize: runOptions.synthesize,
                  web_search: runOptions.webSearch,
                  instructions: selectedInstructions,
                }}
                onApply={applyTeam}
              />
            }
          />
        </main>
      </div>

      <AppSettings isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} onProvidersChange={handleProvidersChange} />

      {detailAgentId && (
        <AgentDetailPanel
          agentId={detailAgentId}
          isSelected={selectedAgents.includes(detailAgentId)}
          instructions={agentInstructions[detailAgentId]}
          onToggleSelected={toggleAgent}
          onInstructionsChange={updateInstructions}
          onClose={() => setDetailAgentId(null)}
        />
      )}
    </div>
  );
}
