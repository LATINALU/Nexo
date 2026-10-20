/** Documentos adjuntos: subida y borrado contra /api/documents. */

export interface DocumentRef {
  id: string;
  name: string;
  size: number;
  chunks: number;
  chars?: number;
  /** true si el texto se obtuvo por OCR */
  ocr?: boolean;
}

export const ACCEPTED_DOCUMENTS = ".pdf,.docx,.txt,.md,.markdown,.csv,.json,.html,.htm,.log,.png,.jpg,.jpeg,.webp";
export const MAX_DOCUMENT_MB = 10;
export const MAX_DOCUMENTS_PER_CHAT = 5;

function authHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("nexo_token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** `ocr`: modelo con visión para escaneos/imágenes ({type, apiKey, baseUrl, model}). */
export async function uploadDocument(file: File, ocr?: object | null, language = "es"): Promise<DocumentRef> {
  if (file.size > MAX_DOCUMENT_MB * 1024 * 1024) {
    throw new Error(`"${file.name}" supera ${MAX_DOCUMENT_MB} MB`);
  }
  const form = new FormData();
  form.append("file", file);
  form.append("language", language);
  if (ocr) form.append("ocr", JSON.stringify(ocr));
  const response = await fetch("/api/documents", { method: "POST", body: form, headers: authHeaders() });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.detail || `No se pudo subir "${file.name}"`);
  return data as DocumentRef;
}

export async function deleteDocument(id: string): Promise<void> {
  await fetch(`/api/documents/${encodeURIComponent(id)}`, { method: "DELETE", headers: authHeaders() }).catch(() => {});
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
