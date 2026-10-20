"use client";

import { useEffect, useState } from "react";
import { Check, Eye, FileSearch, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApiProvider } from "@/components/AppSettings";
import {
  DocSettings, EMBEDDING_SUGGESTIONS, ModelChoice, VISION_SUGGESTIONS, loadDocSettings, providersWithoutEmbeddings,
  saveDocSettings,
} from "@/lib/docSettings";

interface Props {
  providers: ApiProvider[];
}

function ModelPicker({
  title, help, icon, providers, value, suggestions, disabledReason, onChange,
}: {
  title: string;
  help: string;
  icon: React.ReactNode;
  providers: ApiProvider[];
  value: ModelChoice | null;
  suggestions: (type: string) => string[];
  disabledReason?: (p: ApiProvider) => string | null;
  onChange: (v: ModelChoice | null) => void;
}) {
  const usable = providers.filter((p) => p.apiKey || p.type === "local");
  const providerId = value?.providerId || usable[0]?.id || "";
  const provider = usable.find((p) => p.id === providerId);
  const reason = provider && disabledReason ? disabledReason(provider) : null;
  const listId = `models-${title.replace(/\W/g, "")}`;
  const options = provider ? Array.from(new Set([...suggestions(provider.type), ...(provider.enabledModels || [])])) : [];

  return (
    <section className="rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/10 text-primary">{icon}</div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">{title}</h3>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={!!value} disabled={!usable.length}
                onChange={(e) => onChange(e.target.checked ? { providerId, model: options[0] || "" } : null)} />
              Activado
            </label>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{help}</p>
        </div>
      </div>

      {!usable.length && <p className="text-xs text-amber-500">Primero configura un proveedor en “APIs & Modelos”.</p>}

      {value && usable.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs">
            <span className="font-semibold">Proveedor</span>
            <select value={providerId} onChange={(e) => onChange({ providerId: e.target.value, model: "" })}
              className="mt-1 w-full px-2 py-1.5 rounded-lg border border-border bg-background text-sm">
              {usable.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="text-xs">
            <span className="font-semibold">Modelo</span>
            <input list={listId} value={value.model} onChange={(e) => onChange({ providerId, model: e.target.value })}
              placeholder={options[0] || "nombre del modelo"}
              className={cn("mt-1 w-full px-2 py-1.5 rounded-lg border bg-background text-sm font-mono", reason ? "border-amber-500" : "border-border")} />
            <datalist id={listId}>{options.map((m) => <option key={m} value={m} />)}</datalist>
          </label>
          {reason && <p className="col-span-2 text-xs text-amber-500">{reason}</p>}
        </div>
      )}
    </section>
  );
}

export function DocumentSettings({ providers }: Props) {
  const [settings, setSettings] = useState<DocSettings>({ ocr: null, embeddings: null });
  const [saved, setSaved] = useState(false);

  useEffect(() => setSettings(loadDocSettings()), []);

  const update = (next: DocSettings) => {
    setSettings(next);
    saveDocSettings(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/15">
        <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground leading-relaxed">
          Ambas opciones usan la API key de un proveedor que ya configuraste. Sin ellas, Nexo igual lee PDF, DOCX y texto
          y busca por palabras clave.
        </p>
      </div>

      <ModelPicker
        title="Leer escaneos e imágenes (OCR)"
        help="Para PDFs escaneados y fotos (PNG/JPG): un modelo con visión transcribe cada página."
        icon={<Eye className="h-4 w-4" />}
        providers={providers}
        value={settings.ocr}
        suggestions={(type) => VISION_SUGGESTIONS[type] || []}
        onChange={(ocr) => update({ ...settings, ocr })}
      />

      <ModelPicker
        title="Búsqueda semántica"
        help="Encuentra fragmentos por significado (“días libres” ↔ “vacaciones”), combinada con la búsqueda por palabras."
        icon={<FileSearch className="h-4 w-4" />}
        providers={providers}
        value={settings.embeddings}
        suggestions={(type) => EMBEDDING_SUGGESTIONS[type] || []}
        disabledReason={(p) => (providersWithoutEmbeddings.has(p.type) ? `${p.name} no ofrece embeddings; elige OpenAI, Google u Ollama.` : null)}
        onChange={(embeddings) => update({ ...settings, embeddings })}
      />

      <div className={cn("text-xs text-green-500 flex items-center gap-1 transition-opacity", saved ? "opacity-100" : "opacity-0")}>
        <Check className="h-3.5 w-3.5" />Guardado
      </div>
    </div>
  );
}
