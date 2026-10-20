"use client";

/**
 * Chat multi-agente con streaming token a token.
 * - Los agentes responden en vivo (paralelo o secuencial) y un Coordinador integra las respuestas.
 * - Detener, regenerar, exportar a Markdown y sugerencia automática de agentes.
 * - Historial local (localStorage); con sesión iniciada el backend además lo persiste.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AlertCircle, Brain, ChevronLeft, Compass, Copy, Check, Download, Layers, Loader2, Menu,
  RotateCcw, Save, Send, Settings2, Sparkles, Square, User, Wand2, Wifi, WifiOff, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getCurrentLanguage } from "@/lib/i18n";
import { suggestAgents } from "@/lib/api";
import {
  AgentResponseData, ChatMessage, LiveAgent, RunMode, RunStats, SYNTHESIS_ID,
  buildHistory, conversationToMarkdown, downloadText, slugify, streamViaSSE,
} from "@/lib/chat";
import { ConversationStorage, Conversation } from "@/lib/conversationStorage";
import { useAgentSocket, AgentSocketEvent } from "@/hooks/useAgentSocket";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConversationHistory } from "@/components/ConversationHistory";
import { TaskSelector } from "@/components/TaskSelector";
import { SpecializedAgentResponse } from "@/components/SpecializedAgentResponse";

const MAX_INPUT = 10000;
const MAX_STORED_CONVERSATIONS = 100;
const OPTIONS_KEY = "nexo_run_options";

interface ApiConfigLike {
  type: string;
  apiKey: string;
  baseUrl?: string;
}

interface StreamingChatProps {
  selectedAgents: string[];
  model: string;
  apiConfig: ApiConfigLike;
  agentInstructions?: Record<string, string>;
  onConversationSaved?: (id: string, title: string) => void;
  onConnectionChange?: (connected: boolean) => void;
  onSelectPreset?: (agents: string[]) => void;
}

const newConversationId = () => `conv_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

function toStored(messages: ChatMessage[]): Conversation["messages"] {
  return messages.map((m) => ({
    role: m.role as any,
    content: m.content,
    timestamp: m.timestamp.toISOString(),
    agentResponses: m.agentResponse ? [m.agentResponse] : undefined,
    metadata: { isSynthesis: m.isSynthesis, interrupted: m.interrupted, agentName: m.agentName, agentEmoji: m.agentEmoji },
  }));
}

function fromStored(conversation: Conversation): ChatMessage[] {
  return conversation.messages.map((m: any) => ({
    role: m.role,
    content: m.content,
    timestamp: new Date(m.timestamp),
    agentResponse: m.agentResponses?.[0],
    agentName: m.metadata?.agentName ?? m.agentResponses?.[0]?.agent_name,
    agentEmoji: m.metadata?.agentEmoji ?? m.agentResponses?.[0]?.agent_emoji,
    isSynthesis: m.metadata?.isSynthesis,
    interrupted: m.metadata?.interrupted,
  }));
}

function loadOptions(): { mode: RunMode; synthesize: boolean } {
  try {
    const saved = JSON.parse(localStorage.getItem(OPTIONS_KEY) || "{}");
    return { mode: saved.mode === "sequential" ? "sequential" : "parallel", synthesize: saved.synthesize !== false };
  } catch {
    return { mode: "parallel", synthesize: true };
  }
}

function Markdown({ children }: { children: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none prose-pre:bg-black/40 prose-table:text-xs prose-th:px-2 prose-td:px-2">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
      title="Copiar"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

export function StreamingChatV2({
  selectedAgents,
  model,
  apiConfig,
  agentInstructions = {},
  onConversationSaved,
  onConnectionChange,
  onSelectPreset,
}: StreamingChatProps) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [live, setLive] = useState<Record<string, LiveAgent>>({});
  const [liveOrder, setLiveOrder] = useState<string[]>([]);
  const [synthesisLive, setSynthesisLive] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [stats, setStats] = useState<RunStats | null>(null);
  const [conversationId, setConversationId] = useState<string>("");
  const [options, setOptions] = useState<{ mode: RunMode; synthesize: boolean }>({ mode: "parallel", synthesize: true });
  const [showOptions, setShowOptions] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [showHistory, setShowHistory] = useState(true);
  const [showMobilePanel, setShowMobilePanel] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sseAbortRef = useRef<AbortController | null>(null);
  const liveRef = useRef<{ live: Record<string, LiveAgent>; synthesis: string | null }>({ live: {}, synthesis: null });
  liveRef.current = { live, synthesis: synthesisLive };

  // ------------------------------------------------------------------ setup
  useEffect(() => {
    const check = () => {
      setIsMobile(window.innerWidth < 768);
      setIsTablet(window.innerWidth >= 768 && window.innerWidth < 1024);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    setOptions(loadOptions());
    const savedId = ConversationStorage.getCurrentConversationId?.() || localStorage.getItem("nexo_current_conversation");
    const saved = savedId ? ConversationStorage.getConversation(savedId) : null;
    if (saved) {
      setConversationId(saved.id);
      setMessages(fromStored(saved));
    } else {
      setConversationId(newConversationId());
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(OPTIONS_KEY, JSON.stringify(options));
    } catch { /* storage lleno o bloqueado */ }
  }, [options]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, live, synthesisLive]);

  // ------------------------------------------------------------- persistencia
  const saveConversation = useCallback(() => {
    if (!conversationId || messages.length === 0) return;
    const existing = ConversationStorage.getConversation(conversationId);
    const firstUser = messages.find((m) => m.role === "user");
    try {
      ConversationStorage.saveConversation({
        id: conversationId,
        title: existing?.title && !existing.title.startsWith("Nueva conversación")
          ? existing.title
          : (firstUser?.content || "Nueva conversación").slice(0, 60),
        messages: toStored(messages),
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        model,
        agents: selectedAgents,
      });
      ConversationStorage.cleanOldConversations?.(MAX_STORED_CONVERSATIONS);
      localStorage.setItem("nexo_current_conversation", conversationId);
    } catch (e) {
      console.warn("No se pudo guardar la conversación localmente:", e);
    }
  }, [conversationId, messages, model, selectedAgents]);

  // Guarda al terminar cada ejecución (no durante el streaming)
  useEffect(() => {
    if (isProcessing || messages.length === 0) return;
    const timer = setTimeout(saveConversation, 400);
    return () => clearTimeout(timer);
  }, [isProcessing, messages, saveConversation]);

  // ----------------------------------------------------------------- eventos
  const resetLive = () => {
    setLive({});
    setLiveOrder([]);
    setSynthesisLive(null);
  };

  /** Pasa a mensajes lo que se alcanzó a generar (al detener). */
  const flushLiveAsInterrupted = useCallback(() => {
    const { live: current, synthesis } = liveRef.current;
    const partial: ChatMessage[] = Object.values(current)
      .filter((a) => a.text.trim())
      .map((a) => ({ role: "agent", content: a.text, timestamp: new Date(), agentName: a.name, agentEmoji: a.emoji, interrupted: true }));
    if (synthesis?.trim()) {
      partial.push({ role: "assistant", content: synthesis, timestamp: new Date(), isSynthesis: true, interrupted: true });
    }
    if (partial.length) setMessages((prev) => [...prev, ...partial]);
    resetLive();
    setIsProcessing(false);
  }, []);

  const handleEvent = useCallback((data: AgentSocketEvent) => {
    switch (data.type) {
      case "pipeline_start": {
        const entries: Record<string, LiveAgent> = {};
        for (const a of data.agents || []) {
          entries[a.id] = { id: a.id, name: a.name, emoji: a.emoji || "🤖", text: "", status: "waiting" };
        }
        setLive(entries);
        setLiveOrder((data.agents || []).map((a: any) => a.id));
        setIsProcessing(true);
        break;
      }
      case "agent_start":
        setLive((prev) => prev[data.agent_id] ? { ...prev, [data.agent_id]: { ...prev[data.agent_id], status: "streaming" } } : prev);
        break;
      case "agent_token":
        setLive((prev) => {
          const agent = prev[data.agent_id];
          return agent ? { ...prev, [data.agent_id]: { ...agent, status: "streaming", text: agent.text + data.delta } } : prev;
        });
        break;
      case "agent_response": {
        const response: AgentResponseData = data.data;
        setMessages((prev) => [...prev, {
          role: "agent", content: response.raw_content || response.summary || "", timestamp: new Date(),
          agentResponse: response, agentName: response.agent_name, agentEmoji: response.agent_emoji,
        }]);
        setLive((prev) => {
          const next = { ...prev };
          delete next[response.agent_id];
          return next;
        });
        break;
      }
      case "agent_error":
        if (data.agent_id === SYNTHESIS_ID) {
          setSynthesisLive(null);
          setNotice(`No se pudo generar la respuesta integrada: ${data.error}`);
          break;
        }
        setMessages((prev) => [...prev, {
          role: "agent", content: `⚠️ ${data.error}`, timestamp: new Date(),
          agentName: liveRef.current.live[data.agent_id]?.name || data.agent, agentEmoji: "⚠️",
        }]);
        setLive((prev) => {
          const next = { ...prev };
          delete next[data.agent_id];
          return next;
        });
        break;
      case "synthesis_start":
        setSynthesisLive("");
        break;
      case "synthesis_token":
        setSynthesisLive((prev) => (prev ?? "") + data.delta);
        break;
      case "synthesis_complete":
        setMessages((prev) => [...prev, { role: "assistant", content: data.content, timestamp: new Date(), isSynthesis: true }]);
        setSynthesisLive(null);
        break;
      case "pipeline_complete": {
        const summary = data.data || {};
        setStats({
          elapsedMs: summary.processing_time_ms || 0,
          totalTokens: summary.usage?.total_tokens || 0,
          agents: summary.agents_count || 0,
          failed: (summary.failed || []).length,
        });
        resetLive();
        setIsProcessing(false);
        break;
      }
      case "pipeline_cancelled":
        flushLiveAsInterrupted();
        setNotice("Generación detenida");
        break;
      case "conversation_saved":
        onConversationSaved?.(data.conversation_id, data.title);
        break;
      case "warning":
        setNotice(data.message);
        break;
      case "error":
        setError(data.message || "Error inesperado");
        resetLive();
        setIsProcessing(false);
        break;
    }
  }, [flushLiveAsInterrupted, onConversationSaved]);

  const { status, send, reconnect } = useAgentSocket(handleEvent);
  const isConnected = status === "open";

  useEffect(() => {
    onConnectionChange?.(isConnected);
  }, [isConnected, onConnectionChange]);

  // Si el socket se cae a mitad de una ejecución por WS, no dejar la UI bloqueada
  const processingRef = useRef(false);
  processingRef.current = isProcessing;
  useEffect(() => {
    if (status === "closed" && processingRef.current && !sseAbortRef.current) {
      flushLiveAsInterrupted();
      setError("Se perdió la conexión con el servidor. Reintenta la consulta.");
    }
  }, [status, flushLiveAsInterrupted]);

  // ----------------------------------------------------------------- acciones
  const apiReady = !!(apiConfig?.apiKey || apiConfig?.type === "local");

  const runQuery = useCallback(async (text: string, baseMessages: ChatMessage[]) => {
    setError(null);
    setNotice(null);
    setStats(null);
    if (!apiReady) {
      setError("Configura tu API key en Ajustes para usar los agentes");
      return;
    }
    if (selectedAgents.length === 0) {
      setError("Selecciona al menos un agente (o usa ✨ Sugerir)");
      return;
    }
    const userMessage: ChatMessage = { role: "user", content: text, timestamp: new Date() };
    setMessages([...baseMessages, userMessage]);
    setIsProcessing(true);

    const payload = {
      message: text,
      agents: selectedAgents,
      model,
      apiConfig: { type: apiConfig.type, apiKey: apiConfig.apiKey, baseUrl: apiConfig.baseUrl },
      conversation_id: conversationId,
      language: getCurrentLanguage(),
      mode: options.mode,
      synthesize: options.synthesize,
      history: buildHistory(baseMessages),
      agentInstructions,
    };

    if (send({ action: "start_pipeline", ...payload })) return;

    // Sin WebSocket: misma ejecución vía SSE
    const controller = new AbortController();
    sseAbortRef.current = controller;
    try {
      await streamViaSSE(payload, handleEvent, controller.signal);
    } catch (e: any) {
      if (e?.name === "AbortError") {
        flushLiveAsInterrupted();
        setNotice("Generación detenida");
      } else {
        setError(`Error en streaming: ${e?.message || e}`);
        resetLive();
      }
    } finally {
      sseAbortRef.current = null;
      setIsProcessing(false);
    }
  }, [apiReady, selectedAgents, model, apiConfig, conversationId, options, agentInstructions, send, handleEvent, flushLiveAsInterrupted]);

  const sendMessage = () => {
    const text = input.trim();
    if (!text || isProcessing) return;
    setInput("");
    runQuery(text.slice(0, MAX_INPUT), messages);
  };

  const stop = () => {
    if (sseAbortRef.current) sseAbortRef.current.abort();
    else send({ action: "cancel" });
  };

  const lastUserIndex = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === "user") return i;
    return -1;
  }, [messages]);

  const regenerate = () => {
    if (lastUserIndex < 0 || isProcessing) return;
    runQuery(messages[lastUserIndex].content, messages.slice(0, lastUserIndex));
  };

  const suggest = async () => {
    const text = input.trim();
    if (text.length < 3) {
      setNotice("Escribe primero tu consulta y luego pide sugerencias");
      return;
    }
    setSuggesting(true);
    setError(null);
    try {
      const result = await suggestAgents(text, apiReady ? apiConfig : null, model, getCurrentLanguage());
      if (!result.agents.length) {
        setNotice("No encontré agentes relevantes; prueba describiendo mejor la tarea");
      } else {
        onSelectPreset?.(result.agents.map((a) => a.id));
        const names = result.agents.map((a) => `${a.emoji} ${a.name}`).join(", ");
        setNotice(`Equipo sugerido: ${names}${result.reason ? ` — ${result.reason}` : ""}`);
      }
    } catch (e: any) {
      setError(e?.message || "No se pudieron sugerir agentes");
    } finally {
      setSuggesting(false);
    }
  };

  const exportMarkdown = () => {
    if (!messages.length) return;
    const title = messages.find((m) => m.role === "user")?.content.slice(0, 60) || "Conversación Nexo";
    downloadText(`nexo-${slugify(title)}.md`, conversationToMarkdown(title, messages));
  };

  const newConversation = () => {
    if (isProcessing) stop();
    setConversationId(newConversationId());
    setMessages([]);
    setStats(null);
    setError(null);
    setNotice(null);
    resetLive();
  };

  const selectConversation = (conversation: Conversation) => {
    if (isProcessing) return;
    setConversationId(conversation.id);
    localStorage.setItem("nexo_current_conversation", conversation.id);
    setMessages(fromStored(conversation));
    setStats(null);
  };

  const deleteConversation = (id: string) => {
    if (id === conversationId) newConversation();
  };

  // ------------------------------------------------------------------ render
  const renderMessage = (message: ChatMessage, index: number) => {
    if (message.role === "user") {
      return (
        <div key={index} className="flex gap-3 mb-6 justify-end animate-in fade-in-0 slide-in-from-bottom-2">
          <div className="max-w-[85%] rounded-2xl px-4 py-3 shadow-sm bg-gradient-to-r from-blue-600 to-blue-700 text-white">
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          </div>
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
            <User className="h-4 w-4 text-blue-400" />
          </div>
        </div>
      );
    }

    if (message.isSynthesis) {
      return (
        <div key={index} className="mb-6 rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/10 via-background to-cyan-500/5 p-5 shadow-lg shadow-primary/10">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-primary/20">
            <div className="flex items-center gap-2 font-semibold text-primary">
              <Compass className="h-5 w-5" /> Respuesta integrada
              {message.interrupted && <Badge variant="outline" className="text-[10px]">interrumpida</Badge>}
            </div>
            <CopyButton text={message.content} />
          </div>
          <Markdown>{message.content}</Markdown>
        </div>
      );
    }

    if (message.agentResponse && !message.interrupted) {
      return (
        <div key={index} className="mb-4">
          <SpecializedAgentResponse
            response={{
              ...message.agentResponse,
              agent_name: message.agentName || message.agentResponse.agent_name,
              agent_emoji: message.agentEmoji || message.agentResponse.agent_emoji,
              raw_content: message.content || message.agentResponse.raw_content,
            }}
            conversationId={conversationId}
            isExpanded={!messages.slice(index + 1).some((m) => m.isSynthesis)}
          />
        </div>
      );
    }

    return (
      <div key={index} className="mb-4 rounded-xl border border-primary/20 bg-muted/20 p-4">
        <div className="flex items-center gap-2 mb-2 text-sm font-semibold">
          <span className="text-xl">{message.agentEmoji || "🤖"}</span>
          {message.agentName || "Agente"}
          {message.interrupted && <Badge variant="outline" className="text-[10px]">interrumpido</Badge>}
        </div>
        <Markdown>{message.content}</Markdown>
      </div>
    );
  };

  const liveAgents = liveOrder.map((id) => live[id]).filter(Boolean);

  const connectionBadge = isConnected ? (
    <Badge variant="outline" className="text-xs text-green-400 border-green-400/50"><Wifi className="h-3 w-3 mr-1" />En vivo</Badge>
  ) : (
    <button onClick={reconnect} title="Reintentar conexión">
      <Badge variant="outline" className="text-xs text-amber-400 border-amber-400/50">
        <WifiOff className="h-3 w-3 mr-1" />{status === "connecting" ? "Conectando…" : "Sin conexión (SSE)"}
      </Badge>
    </button>
  );

  const history = (
    <ConversationHistory
      currentConversationId={conversationId}
      onSelectConversation={selectConversation}
      onNewConversation={newConversation}
      onDeleteConversation={deleteConversation}
      onSave={saveConversation}
    />
  );

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden w-full">
      {isMobile && (
        <div className="flex items-center justify-between p-3 border-b border-primary/10 bg-muted/30">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setShowMobilePanel(!showMobilePanel)} className="h-8 w-8 p-0">
              {showMobilePanel ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
            <Brain className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Nexo</span>
          </div>
          {connectionBadge}
        </div>
      )}

      {isMobile && showMobilePanel && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setShowMobilePanel(false)} />
          <div className="fixed inset-y-0 left-0 z-50 w-80 bg-background border-r border-primary/10 overflow-hidden">
            <div className="flex items-center justify-between p-3 border-b border-primary/10">
              <span className="font-semibold text-sm">Historial</span>
              <Button size="sm" variant="ghost" onClick={saveConversation} disabled={!messages.length} className="h-8 px-2 text-xs">
                <Save className="h-3 w-3 mr-1" />Guardar
              </Button>
            </div>
            {history}
          </div>
        </>
      )}

      <div className="flex flex-1 h-full overflow-hidden relative">
        <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden relative">
          {!isMobile && (
            <div className="flex items-center justify-between p-3 border-b border-primary/10 bg-muted/30">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-primary/20 border border-primary/40"><Layers className="h-5 w-5 text-primary" /></div>
                <span className="font-bold text-lg text-primary">Agentes</span>
                <Badge variant="outline" className="text-xs">{selectedAgents.length} seleccionados</Badge>
                {connectionBadge}
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={newConversation} className="text-xs font-semibold">Nuevo</Button>
                <Button variant="ghost" size="sm" onClick={exportMarkdown} disabled={!messages.length} title="Exportar a Markdown" className="text-xs gap-1">
                  <Download className="h-3.5 w-3.5" />Exportar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowHistory(!showHistory)} title={showHistory ? "Ocultar historial" : "Mostrar historial"}
                  className={cn("p-0 h-8 w-8", showHistory && "bg-primary/10")}>
                  <ChevronLeft className={cn("h-4 w-4 transition-transform", showHistory && "rotate-180")} />
                </Button>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4" ref={scrollRef}>
            <div className="max-w-5xl mx-auto">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 mb-4 text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" /><span className="flex-1">{error}</span>
                  <button onClick={() => setError(null)}><X className="h-3.5 w-3.5" /></button>
                </div>
              )}

              {messages.length === 0 && liveAgents.length === 0 ? (
                <div className="h-full min-h-[50vh] flex items-center justify-center p-8">
                  <div className="flex flex-col items-center text-center max-w-md">
                    <div className="bg-gradient-to-br from-primary/20 to-cyan-500/20 rounded-full p-8 mb-8 ring-1 ring-primary/30">
                      <Brain className="h-16 w-16 text-primary" />
                    </div>
                    <h3 className="text-2xl font-black mb-3 bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">
                      Sistema Multi-Agente
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Elige una tarea predefinida, selecciona agentes de las 50 categorías, o escribe tu consulta y pulsa
                      <span className="inline-flex items-center gap-1 mx-1 font-semibold text-primary"><Wand2 className="h-3 w-3" />Sugerir</span>
                      para que el sistema arme el equipo. Los agentes trabajan en paralelo y un Coordinador integra sus aportes.
                    </p>
                  </div>
                </div>
              ) : (
                messages.map(renderMessage)
              )}

              {liveAgents.map((agent) => (
                <div key={agent.id} className="mb-4 rounded-xl border border-primary/20 bg-muted/20 p-4">
                  <div className="flex items-center gap-2 mb-2 text-sm font-semibold">
                    <span className="text-xl">{agent.emoji}</span>{agent.name}
                    <Loader2 className={cn("h-3.5 w-3.5 animate-spin text-primary", agent.status === "waiting" && "opacity-40")} />
                    <span className="text-xs font-normal text-muted-foreground">{agent.status === "waiting" ? "en cola" : "escribiendo…"}</span>
                  </div>
                  {agent.text ? <Markdown>{agent.text}</Markdown> : <div className="h-4 w-1/3 rounded bg-primary/10 animate-pulse" />}
                </div>
              ))}

              {synthesisLive !== null && (
                <div className="mb-6 rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/10 via-background to-cyan-500/5 p-5">
                  <div className="flex items-center gap-2 mb-3 font-semibold text-primary">
                    <Compass className="h-5 w-5" />Integrando respuestas<Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                  {synthesisLive ? <Markdown>{synthesisLive}</Markdown> : <div className="h-4 w-1/2 rounded bg-primary/10 animate-pulse" />}
                </div>
              )}

              {!isProcessing && (stats || lastUserIndex >= 0) && (
                <div className="flex flex-wrap items-center justify-center gap-3 mb-6 text-xs text-muted-foreground">
                  {stats && (
                    <span>
                      ✅ {stats.agents} agente{stats.agents === 1 ? "" : "s"}
                      {stats.failed > 0 && ` · ⚠️ ${stats.failed} con error`}
                      {" · "}⏱️ {(stats.elapsedMs / 1000).toFixed(1)} s
                      {stats.totalTokens > 0 && ` · ${stats.totalTokens.toLocaleString()} tokens`}
                    </span>
                  )}
                  {lastUserIndex >= 0 && (
                    <button onClick={regenerate} className="inline-flex items-center gap-1 hover:text-primary transition-colors">
                      <RotateCcw className="h-3 w-3" />Regenerar
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="p-4 border-t border-primary/10 bg-background/95 backdrop-blur">
            <div className="max-w-5xl mx-auto">
              {notice && (
                <div className="flex items-start gap-2 mb-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/15 text-xs text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" /><span className="flex-1">{notice}</span>
                  <button onClick={() => setNotice(null)}><X className="h-3 w-3" /></button>
                </div>
              )}
              <div className="relative flex items-end gap-2">
                <div className="relative flex-1">
                  <textarea
                    value={input}
                    maxLength={MAX_INPUT}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder={isProcessing ? "Los agentes están trabajando…" : "Describe tu tarea… (Enter envía, Shift+Enter nueva línea)"}
                    className="w-full min-h-[60px] max-h-[200px] p-4 pr-24 rounded-xl bg-background border border-primary/20 focus:border-primary focus:ring-1 focus:ring-primary/50 resize-none text-sm"
                    disabled={isProcessing}
                  />
                  <div className="absolute right-3 bottom-3 flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground font-mono">{input.length}/{MAX_INPUT}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="relative">
                    <Button variant="outline" size="sm" className="h-[28px] w-[60px] px-0" onClick={() => setShowOptions(!showOptions)} title="Opciones de ejecución">
                      <Settings2 className="h-3.5 w-3.5" />
                    </Button>
                    {showOptions && (
                      <>
                        <div className="fixed inset-0 z-30" onClick={() => setShowOptions(false)} />
                        <div className="absolute bottom-full right-0 mb-2 w-64 rounded-xl border border-border bg-card p-3 shadow-xl z-40 text-xs space-y-3">
                          <div>
                            <div className="font-semibold mb-1">Modo de trabajo</div>
                            {(["parallel", "sequential"] as RunMode[]).map((mode) => (
                              <label key={mode} className="flex items-start gap-2 py-1 cursor-pointer">
                                <input type="radio" checked={options.mode === mode} onChange={() => setOptions({ ...options, mode })} className="mt-0.5" />
                                <span>
                                  <b>{mode === "parallel" ? "Paralelo" : "Secuencial"}</b>
                                  <span className="block text-muted-foreground">
                                    {mode === "parallel" ? "Todos a la vez: más rápido." : "Cada agente ve lo que dijeron los anteriores."}
                                  </span>
                                </span>
                              </label>
                            ))}
                          </div>
                          <label className="flex items-start gap-2 cursor-pointer border-t border-border pt-2">
                            <input type="checkbox" checked={options.synthesize} onChange={(e) => setOptions({ ...options, synthesize: e.target.checked })} className="mt-0.5" />
                            <span><b>Respuesta integrada</b><span className="block text-muted-foreground">Un Coordinador une los aportes en una sola respuesta.</span></span>
                          </label>
                        </div>
                      </>
                    )}
                  </div>
                  <Button variant="outline" size="sm" className="h-[28px] w-[60px] px-0 text-primary" onClick={suggest}
                    disabled={suggesting || isProcessing} title="Sugerir agentes para esta consulta">
                    {suggesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                  </Button>
                </div>

                {isProcessing ? (
                  <Button onClick={stop} title="Detener" className="h-[60px] w-[60px] rounded-xl bg-red-500/90 hover:bg-red-500 text-white">
                    <Square className="h-5 w-5 fill-current" />
                  </Button>
                ) : (
                  <Button onClick={sendMessage} disabled={!input.trim()} title="Enviar"
                    className="h-[60px] w-[60px] rounded-xl shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground">
                    <Send className="h-6 w-6 ml-0.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {!isMobile && <TaskSelector onSelect={(agents) => onSelectPreset?.(agents)} className="h-full shrink-0" />}

        {!isMobile && showHistory && (
          <div className={cn("border-l border-primary/10 h-full flex-shrink-0 bg-card overflow-hidden", isTablet ? "w-60" : "w-72")}>
            {history}
          </div>
        )}
      </div>
    </div>
  );
}

export default StreamingChatV2;
