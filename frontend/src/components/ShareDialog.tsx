"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Link2, Loader2, Trash2, X } from "lucide-react";
import type { Turn } from "@/lib/chat";
import { MyShare, createShare, listMyShares, revokeShare, shareUrl } from "@/lib/shares";

interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  path: Turn[];
}

export function ShareDialog({ open, onClose, title, path }: ShareDialogProps) {
  const [current, setCurrent] = useState<MyShare | null>(null);
  const [shares, setShares] = useState<MyShare[]>([]);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setShares(listMyShares());
      setCurrent(null);
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const share = await createShare(title, path);
      setCurrent(share);
      setShares(listMyShares());
      await navigator.clipboard.writeText(shareUrl(share.id)).then(() => setCopied(true)).catch(() => {});
    } catch (e: any) {
      setError(e?.message || "No se pudo crear el link");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (share: MyShare) => {
    try {
      await revokeShare(share);
      setShares(listMyShares());
      if (current?.id === share.id) setCurrent(null);
    } catch (e: any) {
      setError(e?.message || "No se pudo revocar");
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-bold"><Link2 className="h-5 w-5 text-primary" />Compartir conversación</h2>
          <button onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <p className="text-sm text-muted-foreground">
          Crea un link de <b>solo lectura</b> con lo que se ve ahora ({path.length} pregunta{path.length === 1 ? "" : "s"}).
          Los mensajes que agregues después no aparecen. No incluye tus API keys ni tus documentos completos.
        </p>

        {current ? (
          <div className="flex items-center gap-2">
            <input readOnly value={shareUrl(current.id)} className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-xs font-mono" />
            <button
              onClick={() => navigator.clipboard.writeText(shareUrl(current.id)).then(() => setCopied(true))}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-border text-xs hover:border-primary"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? "Copiado" : "Copiar"}
            </button>
          </div>
        ) : (
          <button onClick={create} disabled={busy || !path.length}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}Crear link
          </button>
        )}

        {error && <p className="text-xs text-red-400">{error}</p>}

        {shares.length > 0 && (
          <div className="border-t border-border pt-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Mis links</div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {shares.map((s) => (
                <div key={s.id} className="flex items-center gap-2 text-xs">
                  <a href={shareUrl(s.id)} target="_blank" rel="noreferrer" className="flex-1 truncate hover:text-primary">{s.title}</a>
                  <span className="text-muted-foreground">{new Date(s.createdAt).toLocaleDateString()}</span>
                  <button onClick={() => revoke(s)} title="Revocar link" className="p-1 text-muted-foreground hover:text-red-400">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
