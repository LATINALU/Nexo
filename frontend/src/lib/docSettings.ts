/**
 * Ajustes de documentos (tipos y utilidades): modelo con visión para OCR y modelo de
 * embeddings. Ambos usan la API key de un proveedor ya configurado. Se persisten en stores/settings.
 */

import type { ApiProvider } from "@/components/AppSettings";

export interface ModelChoice {
  providerId: string;
  model: string;
}

export interface DocSettings {
  ocr: ModelChoice | null;
  embeddings: ModelChoice | null;
}

/** Configuración lista para enviar al backend: {type, apiKey, baseUrl, model}. */
export interface ResolvedModelConfig {
  type: string;
  apiKey: string;
  baseUrl?: string;
  model: string;
}

export const VISION_SUGGESTIONS: Record<string, string[]> = {
  openai: ["gpt-4o-mini", "gpt-4o"],
  anthropic: ["claude-3-5-haiku-latest", "claude-3-5-sonnet-latest"],
  google: ["gemini-2.0-flash", "gemini-1.5-flash"],
  groq: ["meta-llama/llama-4-scout-17b-16e-instruct", "meta-llama/llama-4-maverick-17b-128e-instruct"],
  local: ["llama3.2-vision", "llava"],
  custom: [],
};

export const EMBEDDING_SUGGESTIONS: Record<string, string[]> = {
  openai: ["text-embedding-3-small", "text-embedding-3-large"],
  google: ["text-embedding-004", "gemini-embedding-001"],
  local: ["nomic-embed-text", "mxbai-embed-large"],
  custom: [],
};

export const providersWithoutEmbeddings = new Set(["groq", "anthropic"]);

export function resolveChoice(choice: ModelChoice | null, providers: ApiProvider[]): ResolvedModelConfig | null {
  if (!choice?.model) return null;
  const provider = providers.find((p) => p.id === choice.providerId);
  if (!provider || (!provider.apiKey && provider.type !== "local")) return null;
  return { type: provider.type, apiKey: provider.apiKey, baseUrl: provider.baseUrl, model: choice.model };
}
