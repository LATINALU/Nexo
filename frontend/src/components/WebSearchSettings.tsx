"use client";

import { useEffect, useState } from "react";
import { Check, ExternalLink, Globe, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  WEB_SEARCH_PROVIDERS, WebSearchConfig, WebSearchProvider,
  loadWebSearchConfig, saveWebSearchConfig, testWebSearch,
} from "@/lib/webSearch";

export function WebSearchSettings() {
  const [provider, setProvider] = useState<WebSearchProvider>("tavily");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState<WebSearchConfig | null>(null);

  useEffect(() => {
    const cfg = loadWebSearchConfig();
    setSaved(cfg);
    if (cfg) {
      setProvider(cfg.provider);
      setApiKey(cfg.apiKey || "");
      setBaseUrl(cfg.baseUrl || "");
    }
  }, []);

  const info = WEB_SEARCH_PROVIDERS.find((p) => p.id === provider)!;
  const config: WebSearchConfig = { provider, apiKey: apiKey.trim(), baseUrl: baseUrl.trim() || undefined };
  const complete = info.needsKey ? !!config.apiKey : !!config.baseUrl;

  const testAndSave = async () => {
    setTesting(true);
    setStatus(null);
    try {
      const result = await testWebSearch(config);
      if (result.success) {
        saveWebSearchConfig(config);
        setSaved(config);
        setStatus({ ok: true, text: `Funciona (${result.results} resultados de prueba). Guardado.` });
      } else {
        setStatus({ ok: false, text: result.error || "No funcionó" });
      }
    } catch {
      setStatus({ ok: false, text: "No se pudo contactar al servidor" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/15">
        <Globe className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground leading-relaxed">
          Con un buscador configurado, podés activar <b>Buscar en la web</b> en las opciones del chat: antes de
          responder, Nexo genera consultas, busca información actual y los agentes citan las fuentes como [W1].
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {WEB_SEARCH_PROVIDERS.map((p) => (
          <button
            key={p.id}
            onClick={() => { setProvider(p.id); setStatus(null); }}
            className={cn(
              "p-3 rounded-xl border text-left transition-all",
              provider === p.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/50",
            )}
          >
            <div className="font-semibold text-sm">{p.name}</div>
            <div className="text-[10px] text-muted-foreground">{p.needsKey ? "Requiere API key" : "Autoalojado"}</div>
          </button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        {info.help}{" "}
        <a href={info.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-primary hover:underline">
          Sitio <ExternalLink className="h-3 w-3" />
        </a>
      </p>

      {info.needsKey ? (
        <label className="block">
          <span className="text-xs font-semibold">API key</span>
          <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} autoComplete="off"
            placeholder={provider === "tavily" ? "tvly-..." : "BSA..."}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono" />
        </label>
      ) : (
        <label className="block">
          <span className="text-xs font-semibold">URL de tu instancia</span>
          <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="http://localhost:8888"
            className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono" />
        </label>
      )}

      {status && (
        <div className={cn("text-xs px-3 py-2 rounded-lg border", status.ok ? "text-green-500 border-green-500/30 bg-green-500/5" : "text-red-400 border-red-400/30 bg-red-400/5")}>
          {status.text}
        </div>
      )}

      <div className="flex items-center justify-between">
        {saved ? (
          <button onClick={() => { saveWebSearchConfig(null); setSaved(null); setApiKey(""); setBaseUrl(""); setStatus(null); }}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-red-400">
            <Trash2 className="h-3.5 w-3.5" />Quitar buscador
          </button>
        ) : <span />}
        <button onClick={testAndSave} disabled={!complete || testing}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
          {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Probar y guardar
        </button>
      </div>
    </div>
  );
}
