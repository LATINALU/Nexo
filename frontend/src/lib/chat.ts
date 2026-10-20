/**
 * Modelo de datos del chat multi-agente y utilidades puras
 * (historial para contexto, exportación, streaming SSE).
 */

export interface AgentResponseData {
  agent_id: string;
  agent_name: string;
  agent_emoji?: string;
  level?: number;
  specialty?: string;
  category?: string;
  format_type?: string;
  raw_content?: string;
  summary?: string;
  sections?: Array<{ type: string; title?: string; content?: string; items?: string[] }>;
  elapsed_ms?: number;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  timestamp: string;
}

export type ChatRole = "user" | "agent" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
  timestamp: Date;
  agentResponse?: AgentResponseData;
  agentName?: string;
  agentEmoji?: string;
  /** true para la respuesta integrada del Coordinador */
  isSynthesis?: boolean;
  /** true si el usuario detuvo la generación a mitad */
  interrupted?: boolean;
}

export interface LiveAgent {
  id: string;
  name: string;
  emoji: string;
  text: string;
  status: "waiting" | "streaming" | "error";
  error?: string;
}

export interface RunStats {
  elapsedMs: number;
  totalTokens: number;
  agents: number;
  failed: number;
}

export type RunMode = "parallel" | "sequential";

export const SYNTHESIS_ID = "coordinator";

const HISTORY_TURNS = 4;
const HISTORY_AGENT_CHARS = 700;

/**
 * Historial compacto para que los agentes entiendan preguntas de seguimiento:
 * por cada turno, el mensaje del usuario + la síntesis (o un extracto de cada agente).
 */
export function buildHistory(messages: ChatMessage[]): Array<{ role: "user" | "assistant"; content: string }> {
  const turns: Array<{ user: string; answers: ChatMessage[] }> = [];
  for (const msg of messages) {
    if (msg.role === "user") turns.push({ user: msg.content, answers: [] });
    else if (turns.length) turns[turns.length - 1].answers.push(msg);
  }
  const history: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const turn of turns.slice(-HISTORY_TURNS)) {
    const synthesis = turn.answers.find((m) => m.isSynthesis);
    const answer = synthesis
      ? synthesis.content
      : turn.answers
          .filter((m) => m.content)
          .map((m) => `[${m.agentName || "Agente"}] ${m.content.slice(0, HISTORY_AGENT_CHARS)}`)
          .join("\n\n");
    if (!answer) continue;
    history.push({ role: "user", content: turn.user }, { role: "assistant", content: answer });
  }
  return history;
}

/** Conversación completa en Markdown, lista para descargar. */
export function conversationToMarkdown(title: string, messages: ChatMessage[]): string {
  const lines = [`# ${title}`, "", `_Exportado desde Nexo el ${new Date().toLocaleString()}_`, ""];
  for (const msg of messages) {
    if (msg.role === "user") {
      lines.push("---", "", "## 🧑 Consulta", "", msg.content, "");
    } else {
      const who = msg.isSynthesis ? "🧭 Respuesta integrada" : `${msg.agentEmoji || "🤖"} ${msg.agentName || "Agente"}`;
      lines.push(`### ${who}${msg.interrupted ? " _(interrumpido)_" : ""}`, "", msg.content, "");
    }
  }
  return lines.join("\n");
}

export function downloadText(filename: string, content: string, mime = "text/markdown") {
  const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function slugify(text: string, max = 40): string {
  return (
    text
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, max) || "conversacion"
  );
}

/**
 * Fallback cuando no hay WebSocket: POST /api/chat-stream y emite cada evento SSE.
 * Acumula en buffer porque un evento puede llegar partido entre chunks.
 */
export async function streamViaSSE(
  body: Record<string, unknown>,
  onEvent: (event: any) => void,
  signal?: AbortSignal,
): Promise<void> {
  const token = localStorage.getItem("nexo_token");
  const response = await fetch("/api/chat-stream", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok || !response.body) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.detail || `Error ${response.status}`);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const data = block
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trimStart())
        .join("\n");
      if (data) {
        try {
          onEvent(JSON.parse(data));
        } catch {
          /* evento malformado */
        }
      }
    }
  }
}
