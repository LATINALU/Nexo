"use client";

/**
 * Chat multi-agente de Nexo.
 * - Streaming token a token; agentes en paralelo o secuencial; Coordinador que integra.
 * - Documentos adjuntos (RAG, OCR de escaneos, búsqueda semántica opcional) y búsqueda web,
 *   con fuentes citables [D1]/[W1]; en modo nativo cada agente decide cuándo buscar.
 * - Conversación como árbol: editar o regenerar crea ramas navegables (‹ 1/2 ›).
 * - Historial local; con sesión se guarda el árbol completo en la cuenta.
 */

import React, { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AlertCircle, Brain, Check, ChevronLeft, ChevronRight, Compass, Copy, Download, FileText, Globe, Layers,
  Loader2, Menu, Paperclip, Pencil, RotateCcw, Save, Search, Send, Settings2, Sparkles, Square, User,
  Wand2, Wifi, WifiOff, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getCurrentLanguage } from "@/lib/i18n";
import { hasSession, saveServerConversation, suggestAgents } from "@/lib/api";
import {
  AgentResponseData, ChatMessage, ConversationTree, LiveAgent, RunMode, RunOptions, SYNTHESIS_ID, Source, Turn,
  activePath, addTurn, buildHistory, conversationToMarkdown, downloadText, emptyTree, latestLeaf,
  messagesToTree, newTurnId, siblingsOf, slugify, streamViaSSE, treeToMessages, updateTurn,
} from "@/lib/chat";
import {
  ACCEPTED_DOCUMENTS, DocumentRef, MAX_DOCUMENTS_PER_CHAT, deleteDocument, formatBytes, uploadDocument,
} from "@/lib/documents";
import { WebSearchConfig, isWebSearchReady } from "@/lib/webSearch";
import type { ResolvedModelConfig } from "@/lib/docSettings";
import { ConversationStorage, Conversation } from "@/lib/conversationStorage";
import { useAgentSocket, AgentSocketEvent } from "@/hooks/useAgentSocket";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConversationHistory } from "@/components/ConversationHistory";
import { TaskSelector } from "@/components/TaskSelector";
import { SpecializedAgentResponse } from "@/components/SpecializedAgentResponse";

const MAX_INPUT = 10000;
const MAX_STORED_CONVERSATIONS = 100;

interface ApiConfigLike {
  type: string;
  apiKey: string;
  baseUrl?: string;
}

interface ChatProps {
  selectedAgents: string[];
  model: string;
  apiConfig: ApiConfigLike;
  agentInstructions?: Record<string, string>;
  options: RunOptions;
  onOptionsChange: (options: RunOptions) => void;
  webSearchConfig: WebSearchConfig | null;
  /** Modelo con visión para leer escaneos e imágenes */
  ocrConfig?: ResolvedModelConfig | null;
  /** Modelo de embeddings para búsqueda semántica en documentos */
  embeddingsConfig?: ResolvedModelConfig | null;
  onConnectionChange?: (connected: boolean) => void;
  onSelectPreset?: (agents: string[]) => void;
  /** Contenido sobre las tareas predefinidas (Mis equipos) */
  sidePanelHeader?: ReactNode;
}

const newConversationId = () => `conv_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

function toStoredPath(path: Turn[]) {
  return treeToMessages({ turns: Object.fromEntries(path.map((t) => [t.id, t])), leafId: path[path.length - 1]?.id ?? null });
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

function SourcesList({ sources }: { sources: Source[] }) {
  if (!sources.length) return null;
  return (
    <div className="mb-6 rounded-xl border border-border/60 bg-muted/10 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Fuentes</div>
      <div className="flex flex-wrap gap-1.5">
        {sources.map((s) =>
          s.kind === "web" && s.url ? (
            <a key={s.label} href={s.url} target="_blank" rel="noreferrer noopener"
              className="inline-flex items-center gap-1 max-w-xs px-2 py-1 rounded-md border border-border bg-background text-xs hover:border-primary hover:text-primary">
              <Globe className="h-3 w-3 shrink-0" /><b>[{s.label}]</b><span className="truncate">{s.title}</span>
            </a>
          ) : (
            <span key={s.label} className="inline-flex items-center gap-1 max-w-xs px-2 py-1 rounded-md border border-border bg-background text-xs">
              <FileText className="h-3 w-3 shrink-0" /><b>[{s.label}]</b><span className="truncate">{s.title}</span>
              {s.chunk && <span className="text-muted-foreground">· frag. {s.chunk}</span>}
            </span>
          ),
        )}
      </div>
    </div>
  );
}

export function Chat({
  selectedAgents,
  model,
  apiConfig,
  agentInstructions = {},
  options,
  onOptionsChange,
  webSearchConfig,
  ocrConfig = null,
  embeddingsConfig = null,
  onConnectionChange,
  onSelectPreset,
  sidePanelHeader,
}: ChatProps) {
  const [input, setInput] = useState("");
  const [tree, setTree] = useState<ConversationTree>(emptyTree);
  const [conversationId, setConversationId] = useState("");
  const [attachments, setAttachments] = useState<DocumentRef[]>([]);
  const [uploading, setUploading] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [live, setLive] = useState<Record<string, LiveAgent>>({});
  const [liveOrder, setLiveOrder] = useState<string[]>([]);
  const [synthesisLive, setSynthesisLive] = useState<string | null>(null);
  const [research, setResearch] = useState<{ queries: string[] } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ turnId: string; text: string } | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [showHistory, setShowHistory] = useState(true);
  const [showMobilePanel, setShowMobilePanel] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sseAbortRef = useRef<AbortController | null>(null);
  const pendingTurnRef = useRef<string | null>(null);
  const treeRef = useRef(tree);
  treeRef.current = tree;
  const liveRef = useRef<{ live: Record<string, LiveAgent>; synthesis: string | null }>({ live: {}, synthesis: null });
  liveRef.current = { live, synthesis: synthesisLive };

  const path = useMemo(() => activePath(tree), [tree]);
  const webReady = isWebSearchReady(webSearchConfig);

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

  const openConversation = useCallback(async (conversation: Conversation) => {
    let loaded = conversation.tree ?? messagesToTree(conversation.messages || []);
    if (!Object.keys(loaded.turns).length && hasSession()) {
      loaded = messagesToTree(await ConversationStorage.getServerConversationMessages(conversation.id));
    }
    setConversationId(conversation.id);
    setTree(loaded);
    setAttachments(conversation.documents || []);
    localStorage.setItem("nexo_current_conversation", conversation.id);
  }, []);

  useEffect(() => {
    const savedId = localStorage.getItem("nexo_current_conversation");
    const saved = savedId ? ConversationStorage.getConversation(savedId) : null;
    if (saved) openConversation(saved);
    else setConversationId(newConversationId());
  }, [openConversation]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [path.length, live, synthesisLive, research]);

  // ------------------------------------------------------------- persistencia
  const saveConversation = useCallback(() => {
    const current = treeRef.current;
    const currentPath = activePath(current);
    if (!conversationId || !currentPath.length) return;
    const existing = ConversationStorage.getConversation(conversationId);
    const title = existing?.title && !existing.title.startsWith("Nueva conversación")
      ? existing.title
      : currentPath[0].user.content.slice(0, 60);
    try {
      ConversationStorage.saveConversation({
        id: conversationId,
        title,
        messages: toStoredPath(currentPath),
        tree: current,
        documents: attachments,
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
    if (hasSession()) {
      saveServerConversation({
        conversation_id: conversationId, title, messages: treeToMessages(current), model, agents: selectedAgents,
      }).catch(() => { /* sin conexión: queda el guardado local */ });
    }
  }, [conversationId, attachments, model, selectedAgents]);

  // Guarda al terminar cada ejecución y al cambiar de rama (nunca durante el streaming)
  useEffect(() => {
    if (isProcessing || !Object.keys(tree.turns).length) return;
    const timer = setTimeout(saveConversation, 500);
    return () => clearTimeout(timer);
  }, [isProcessing, tree, attachments, saveConversation]);

  // ----------------------------------------------------------------- eventos
  // Solo usan setters y refs: identidad estable
  const appendAnswer = useCallback((message: ChatMessage) => {
    const turnId = pendingTurnRef.current;
    if (turnId) setTree((t) => updateTurn(t, turnId, (turn) => ({ ...turn, answers: [...turn.answers, message] })));
  }, []);

  const resetLive = useCallback(() => {
    setLive({});
    setLiveOrder([]);
    setSynthesisLive(null);
    setResearch(null);
  }, []);

  const finishRun = useCallback(() => {
    resetLive();
    setIsProcessing(false);
    pendingTurnRef.current = null;
  }, [resetLive]);

  /** Pasa a la respuesta lo que se alcanzó a generar (al detener o perder conexión). */
  const flushLiveAsInterrupted = useCallback(() => {
    const { live: current, synthesis } = liveRef.current;
    const partial: ChatMessage[] = Object.values(current)
      .filter((a) => a.text.trim())
      .map((a) => ({ role: "agent", content: a.text, timestamp: new Date(), agentName: a.name, agentEmoji: a.emoji, interrupted: true }));
    if (synthesis?.trim()) {
      partial.push({ role: "assistant", content: synthesis, timestamp: new Date(), isSynthesis: true, interrupted: true });
    }
    const turnId = pendingTurnRef.current;
    if (turnId && partial.length) {
      setTree((t) => updateTurn(t, turnId, (turn) => ({ ...turn, answers: [...turn.answers, ...partial] })));
    }
    finishRun();
  }, [finishRun]);

  const handleEvent = useCallback((data: AgentSocketEvent) => {
    const turnId = pendingTurnRef.current;
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
      case "research_start":
        setResearch({ queries: [] });
        break;
      case "research_queries":
        setResearch({ queries: data.queries || [] });
        break;
      case "context_ready":
        setResearch(null);
        if (turnId) setTree((t) => updateTurn(t, turnId, (turn) => ({ ...turn, sources: data.sources || [] })));
        break;
      case "tool_call":
        setLive((prev) => {
          const agent = prev[data.agent_id];
          if (!agent) return prev;
          return { ...prev, [data.agent_id]: { ...agent, tools: [...(agent.tools || []), { tool: data.tool, query: data.query }] } };
        });
        break;
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
        appendAnswer({
          role: "agent", content: response.raw_content || response.summary || "", timestamp: new Date(),
          agentResponse: response, agentName: response.agent_name, agentEmoji: response.agent_emoji,
        });
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
        appendAnswer({
          role: "agent", content: `⚠️ ${data.error}`, timestamp: new Date(),
          agentName: liveRef.current.live[data.agent_id]?.name || data.agent, agentEmoji: "⚠️",
        });
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
        appendAnswer({ role: "assistant", content: data.content, timestamp: new Date(), isSynthesis: true });
        setSynthesisLive(null);
        break;
      case "pipeline_complete": {
        const summary = data.data || {};
        if (turnId) {
          setTree((t) => updateTurn(t, turnId, (turn) => ({
            ...turn,
            sources: summary.sources?.length ? summary.sources : turn.sources,
            stats: {
              elapsedMs: summary.processing_time_ms || 0,
              totalTokens: summary.usage?.total_tokens || 0,
              agents: summary.agents_count || 0,
              failed: (summary.failed || []).length,
            },
          })));
        }
        finishRun();
        break;
      }
      case "pipeline_cancelled":
        flushLiveAsInterrupted();
        setNotice("Generación detenida");
        break;
      case "warning":
        setNotice(data.message);
        break;
      case "error":
        setError(data.message || "Error inesperado");
        finishRun();
        break;
    }
  }, [flushLiveAsInterrupted, appendAnswer, finishRun]);

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

  /** Crea un turno hijo de `parentId` y ejecuta los agentes sobre él. */
  const runQuery = useCallback(async (text: string, parentId: string | null) => {
    setError(null);
    setNotice(null);
    if (!apiReady) {
      setError("Configura tu API key en Ajustes para usar los agentes");
      return;
    }
    if (selectedAgents.length === 0) {
      setError("Selecciona al menos un agente (o usa ✨ Sugerir)");
      return;
    }
    const turn: Turn = {
      id: newTurnId(),
      parentId,
      user: { role: "user", content: text, timestamp: new Date() },
      answers: [],
      createdAt: new Date().toISOString(),
    };
    const history = buildHistory(activePath(treeRef.current, parentId));
    setTree((t) => addTurn(t, turn));
    pendingTurnRef.current = turn.id;
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
      history,
      agentInstructions,
      documents: attachments.map((d) => d.id),
      webSearch: options.webSearch && webReady ? webSearchConfig : null,
      embeddings: attachments.length ? embeddingsConfig : null,
      toolMode: options.toolMode,
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
        finishRun();
      }
    } finally {
      sseAbortRef.current = null;
      setIsProcessing(false);
    }
  }, [apiReady, selectedAgents, model, apiConfig, conversationId, options, agentInstructions, attachments,
      webReady, webSearchConfig, embeddingsConfig, send, handleEvent, flushLiveAsInterrupted, finishRun]);

  const sendMessage = () => {
    const text = input.trim();
    if (!text || isProcessing) return;
    setInput("");
    runQuery(text.slice(0, MAX_INPUT), tree.leafId);
  };

  const stop = () => {
    if (sseAbortRef.current) sseAbortRef.current.abort();
    else send({ action: "cancel" });
  };

  const regenerate = () => {
    const last = path[path.length - 1];
    if (last && !isProcessing) runQuery(last.user.content, last.parentId);
  };

  const submitEdit = () => {
    if (!editing || isProcessing) return;
    const turn = tree.turns[editing.turnId];
    const text = editing.text.trim();
    setEditing(null);
    if (turn && text) runQuery(text.slice(0, MAX_INPUT), turn.parentId);
  };

  const switchBranch = (turn: Turn, direction: -1 | 1) => {
    if (isProcessing) return;
    const siblings = siblingsOf(tree, turn);
    const target = siblings[siblings.findIndex((s) => s.id === turn.id) + direction];
    if (target) setTree((t) => ({ ...t, leafId: latestLeaf(t, target.id) }));
  };

  const addFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).slice(0, Math.max(0, MAX_DOCUMENTS_PER_CHAT - attachments.length));
    if (!list.length) {
      setNotice(`Máximo ${MAX_DOCUMENTS_PER_CHAT} documentos por conversación`);
      return;
    }
    setError(null);
    setUploading((n) => n + list.length);
    await Promise.all(list.map(async (file) => {
      try {
        const doc = await uploadDocument(file, ocrConfig, getCurrentLanguage());
        setAttachments((prev) => [...prev, doc]);
      } catch (e: any) {
        setError(e?.message || `No se pudo subir ${file.name}`);
      } finally {
        setUploading((n) => n - 1);
      }
    }));
  };

  const removeAttachment = (doc: DocumentRef) => {
    setAttachments((prev) => prev.filter((d) => d.id !== doc.id));
    deleteDocument(doc.id);
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
    if (!path.length) return;
    const title = path[0].user.content.slice(0, 60) || "Conversación Nexo";
    downloadText(`nexo-${slugify(title)}.md`, conversationToMarkdown(title, path));
  };

  const newConversation = () => {
    if (isProcessing) stop();
    setConversationId(newConversationId());
    setTree(emptyTree());
    setAttachments([]);
    setError(null);
    setNotice(null);
    setEditing(null);
    resetLive();
  };

  const selectConversation = (conversation: Conversation) => {
    if (isProcessing) return;
    setEditing(null);
    openConversation(conversation);
  };

  const deleteConversation = (id: string) => {
    if (id === conversationId) newConversation();
  };

  // ------------------------------------------------------------------ render
  const renderAnswer = (message: ChatMessage, key: string, collapse: boolean) => {
    if (message.isSynthesis) {
      return (
        <div key={key} className="mb-6 rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/10 via-background to-cyan-500/5 p-5 shadow-lg shadow-primary/10">
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
        <div key={key} className="mb-4">
          <SpecializedAgentResponse
            response={{
              ...message.agentResponse,
              agent_name: message.agentName || message.agentResponse.agent_name,
              agent_emoji: message.agentEmoji || message.agentResponse.agent_emoji,
              raw_content: message.content || message.agentResponse.raw_content,
            }}
            conversationId={conversationId}
            isExpanded={!collapse}
          />
        </div>
      );
    }
    return (
      <div key={key} className="mb-4 rounded-xl border border-primary/20 bg-muted/20 p-4">
        <div className="flex items-center gap-2 mb-2 text-sm font-semibold">
          <span className="text-xl">{message.agentEmoji || "🤖"}</span>
          {message.agentName || "Agente"}
          {message.interrupted && <Badge variant="outline" className="text-[10px]">interrumpido</Badge>}
        </div>
        <Markdown>{message.content}</Markdown>
      </div>
    );
  };

  const renderTurn = (turn: Turn, index: number) => {
    const siblings = siblingsOf(tree, turn);
    const position = siblings.findIndex((s) => s.id === turn.id);
    const isLast = index === path.length - 1;
    const isPending = pendingTurnRef.current === turn.id;
    const hasSynthesis = turn.answers.some((a) => a.isSynthesis);
    const isEditing = editing?.turnId === turn.id;

    return (
      <div key={turn.id}>
        <div className="group flex gap-3 mb-6 justify-end animate-in fade-in-0 slide-in-from-bottom-2">
          <div className="flex flex-col items-end max-w-[85%] w-full">
            {isEditing ? (
              <div className="w-full rounded-2xl border border-primary/40 bg-background p-3">
                <textarea
                  autoFocus
                  value={editing.text}
                  maxLength={MAX_INPUT}
                  onChange={(e) => setEditing({ turnId: turn.id, text: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitEdit(); }
                    if (e.key === "Escape") setEditing(null);
                  }}
                  className="w-full min-h-[80px] bg-transparent text-sm resize-y focus:outline-none"
                />
                <div className="flex justify-end gap-2 mt-2">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
                  <Button size="sm" onClick={submitEdit} disabled={!editing.text.trim()}>Enviar como nueva rama</Button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl px-4 py-3 shadow-sm bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                <p className="text-sm whitespace-pre-wrap">{turn.user.content}</p>
              </div>
            )}
            {!isEditing && (
              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                {siblings.length > 1 && (
                  <span className="inline-flex items-center gap-0.5 mr-1" title="Versiones de esta pregunta">
                    <button onClick={() => switchBranch(turn, -1)} disabled={position <= 0 || isProcessing} className="p-0.5 disabled:opacity-30"><ChevronLeft className="h-3.5 w-3.5" /></button>
                    <span className="font-mono">{position + 1}/{siblings.length}</span>
                    <button onClick={() => switchBranch(turn, 1)} disabled={position >= siblings.length - 1 || isProcessing} className="p-0.5 disabled:opacity-30"><ChevronRight className="h-3.5 w-3.5" /></button>
                  </span>
                )}
                {!isProcessing && (
                  <button onClick={() => setEditing({ turnId: turn.id, text: turn.user.content })} title="Editar y crear una rama"
                    className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded hover:text-primary">
                    <Pencil className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
            <User className="h-4 w-4 text-blue-400" />
          </div>
        </div>

        {turn.answers.map((a, i) => renderAnswer(a, `${turn.id}-${i}`, hasSynthesis && !a.isSynthesis))}

        {isPending && (
          <>
            {research && (
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-3 text-sm">
                <Search className="h-4 w-4 text-cyan-400 mt-0.5 animate-pulse" />
                <div>
                  <div className="font-semibold text-cyan-400">Buscando en la web…</div>
                  {research.queries.length > 0 && (
                    <div className="text-xs text-muted-foreground mt-0.5">{research.queries.map((q) => `“${q}”`).join(" · ")}</div>
                  )}
                </div>
              </div>
            )}
            {liveOrder.map((id) => live[id]).filter(Boolean).map((agent) => (
              <div key={agent.id} className="mb-4 rounded-xl border border-primary/20 bg-muted/20 p-4">
                <div className="flex items-center gap-2 mb-2 text-sm font-semibold">
                  <span className="text-xl">{agent.emoji}</span>{agent.name}
                  <Loader2 className={cn("h-3.5 w-3.5 animate-spin text-primary", agent.status === "waiting" && "opacity-40")} />
                  <span className="text-xs font-normal text-muted-foreground">{agent.status === "waiting" ? "en cola" : "escribiendo…"}</span>
                </div>
                {agent.tools?.map((t, i) => (
                  <div key={i} className="flex items-center gap-1.5 mb-1 text-xs text-cyan-400">
                    {t.tool === "buscar_web" ? <Globe className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                    {t.tool === "buscar_web" ? "Buscó en la web:" : "Buscó en los documentos:"} <span className="italic">“{t.query}”</span>
                  </div>
                ))}
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
          </>
        )}

        {turn.sources && <SourcesList sources={turn.sources} />}

        {!isPending && (turn.stats || isLast) && (
          <div className="flex flex-wrap items-center justify-center gap-3 mb-8 text-xs text-muted-foreground">
            {turn.stats && (
              <span>
                ✅ {turn.stats.agents} agente{turn.stats.agents === 1 ? "" : "s"}
                {turn.stats.failed > 0 && ` · ⚠️ ${turn.stats.failed} con error`}
                {" · "}⏱️ {(turn.stats.elapsedMs / 1000).toFixed(1)} s
                {turn.stats.totalTokens > 0 && ` · ${turn.stats.totalTokens.toLocaleString()} tokens`}
              </span>
            )}
            {isLast && !isProcessing && (
              <button onClick={regenerate} className="inline-flex items-center gap-1 hover:text-primary transition-colors" title="Crear otra versión de esta respuesta">
                <RotateCcw className="h-3 w-3" />Regenerar
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

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

  const setMode = (mode: RunMode) => onOptionsChange({ ...options, mode });

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
              <Button size="sm" variant="ghost" onClick={saveConversation} disabled={!path.length} className="h-8 px-2 text-xs">
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
                <Button variant="ghost" size="sm" onClick={exportMarkdown} disabled={!path.length} title="Exportar a Markdown" className="text-xs gap-1">
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

              {path.length === 0 ? (
                <div className="h-full min-h-[50vh] flex items-center justify-center p-8">
                  <div className="flex flex-col items-center text-center max-w-md">
                    <div className="bg-gradient-to-br from-primary/20 to-cyan-500/20 rounded-full p-8 mb-8 ring-1 ring-primary/30">
                      <Brain className="h-16 w-16 text-primary" />
                    </div>
                    <h3 className="text-2xl font-black mb-3 bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">Nexo</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Arma un equipo de especialistas —o pulsa
                      <span className="inline-flex items-center gap-1 mx-1 font-semibold text-primary"><Wand2 className="h-3 w-3" />Sugerir</span>—,
                      adjunta documentos <Paperclip className="inline h-3 w-3" /> o activa la búsqueda web <Globe className="inline h-3 w-3" />.
                      Los agentes trabajan a la vez y un Coordinador integra sus aportes con fuentes citadas.
                    </p>
                  </div>
                </div>
              ) : (
                path.map(renderTurn)
              )}
            </div>
          </div>

          <div
            className={cn("p-4 border-t border-primary/10 bg-background/95 backdrop-blur transition-colors", dragOver && "bg-primary/10")}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); }}
          >
            <div className="max-w-5xl mx-auto">
              {notice && (
                <div className="flex items-start gap-2 mb-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/15 text-xs text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" /><span className="flex-1">{notice}</span>
                  <button onClick={() => setNotice(null)}><X className="h-3 w-3" /></button>
                </div>
              )}

              {(attachments.length > 0 || uploading > 0 || (options.webSearch && webReady)) && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {attachments.map((doc) => (
                    <span key={doc.id} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-muted/30 text-xs max-w-xs">
                      <FileText className="h-3 w-3 text-primary shrink-0" />
                      <span className="truncate">{doc.name}</span>
                      {doc.ocr && <span className="px-1 rounded bg-primary/15 text-[10px] text-primary" title="Texto leído por OCR">OCR</span>}
                      <span className="text-muted-foreground">{formatBytes(doc.size)}</span>
                      <button onClick={() => removeAttachment(doc)} disabled={isProcessing} title="Quitar"><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                  {uploading > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-dashed border-border text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />Procesando {uploading}…
                    </span>
                  )}
                  {options.webSearch && webReady && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-cyan-500/30 bg-cyan-500/5 text-xs text-cyan-400">
                      <Globe className="h-3 w-3" />Búsqueda web activa
                    </span>
                  )}
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
                    placeholder={isProcessing ? "Los agentes están trabajando…" : "Describe tu tarea… (Enter envía · arrastra archivos aquí)"}
                    className="w-full min-h-[60px] max-h-[200px] p-4 pr-24 rounded-xl bg-background border border-primary/20 focus:border-primary focus:ring-1 focus:ring-primary/50 resize-none text-sm"
                    disabled={isProcessing}
                  />
                  <div className="absolute right-3 bottom-3 flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground font-mono">{input.length}/{MAX_INPUT}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1">
                  <input ref={fileInputRef} type="file" multiple accept={ACCEPTED_DOCUMENTS} className="hidden"
                    onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ""; }} />
                  <Button variant="outline" size="sm" className="h-[28px] w-[34px] px-0" title={ocrConfig ? "Adjuntar documentos o imágenes (PDF, DOCX, TXT, PNG, JPG…)" : "Adjuntar documentos (PDF, DOCX, TXT, MD, CSV…)"}
                    onClick={() => fileInputRef.current?.click()} disabled={isProcessing || attachments.length >= MAX_DOCUMENTS_PER_CHAT}>
                    <Paperclip className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="sm" title={webReady ? "Buscar en la web" : "Configura un buscador en Ajustes → Búsqueda web"}
                    className={cn("h-[28px] w-[34px] px-0", options.webSearch && webReady && "border-cyan-500/60 text-cyan-400 bg-cyan-500/10")}
                    onClick={() => (webReady ? onOptionsChange({ ...options, webSearch: !options.webSearch }) : setNotice("Configura un buscador en Ajustes → Búsqueda web"))}>
                    <Globe className="h-3.5 w-3.5" />
                  </Button>
                  <div className="relative">
                    <Button variant="outline" size="sm" className="h-[28px] w-[34px] px-0" onClick={() => setShowOptions(!showOptions)} title="Opciones de ejecución">
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
                                <input type="radio" checked={options.mode === mode} onChange={() => setMode(mode)} className="mt-0.5" />
                                <span>
                                  <b>{mode === "parallel" ? "Paralelo" : "Secuencial"}</b>
                                  <span className="block text-muted-foreground">
                                    {mode === "parallel" ? "Todos a la vez: más rápido." : "Cada agente ve lo que dijeron los anteriores."}
                                  </span>
                                </span>
                              </label>
                            ))}
                          </div>
                          <div className="border-t border-border pt-2">
                            <div className="font-semibold mb-1">Fuentes (documentos y web)</div>
                            {(["prefetch", "native"] as const).map((toolMode) => (
                              <label key={toolMode} className="flex items-start gap-2 py-1 cursor-pointer">
                                <input type="radio" checked={options.toolMode === toolMode} onChange={() => onOptionsChange({ ...options, toolMode })} className="mt-0.5" />
                                <span>
                                  <b>{toolMode === "prefetch" ? "Búsqueda previa" : "Herramientas nativas"}</b>
                                  <span className="block text-muted-foreground">
                                    {toolMode === "prefetch"
                                      ? "Se busca una vez y todos reciben las mismas fuentes. Funciona con cualquier modelo."
                                      : "Cada agente decide qué y cuándo buscar. Requiere un modelo con function calling."}
                                  </span>
                                </span>
                              </label>
                            ))}
                          </div>
                          <label className="flex items-start gap-2 cursor-pointer border-t border-border pt-2">
                            <input type="checkbox" checked={options.synthesize} onChange={(e) => onOptionsChange({ ...options, synthesize: e.target.checked })} className="mt-0.5" />
                            <span><b>Respuesta integrada</b><span className="block text-muted-foreground">Un Coordinador une los aportes en una sola respuesta.</span></span>
                          </label>
                        </div>
                      </>
                    )}
                  </div>
                  <Button variant="outline" size="sm" className="h-[28px] w-[34px] px-0 text-primary" onClick={suggest}
                    disabled={suggesting || isProcessing} title="Sugerir agentes para esta consulta">
                    {suggesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                  </Button>
                </div>

                {isProcessing ? (
                  <Button onClick={stop} title="Detener" className="h-[60px] w-[60px] rounded-xl bg-red-500/90 hover:bg-red-500 text-white">
                    <Square className="h-5 w-5 fill-current" />
                  </Button>
                ) : (
                  <Button onClick={sendMessage} disabled={!input.trim() || uploading > 0} title="Enviar"
                    className="h-[60px] w-[60px] rounded-xl shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground">
                    <Send className="h-6 w-6 ml-0.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {!isMobile && (
          <TaskSelector onSelect={(agents) => onSelectPreset?.(agents)} className="h-full shrink-0" header={sidePanelHeader} />
        )}

        {!isMobile && showHistory && (
          <div className={cn("border-l border-primary/10 h-full flex-shrink-0 bg-card overflow-hidden", isTablet ? "w-60" : "w-72")}>
            {history}
          </div>
        )}
      </div>
    </div>
  );
}

export default Chat;
