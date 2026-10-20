"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { SecureStorage } from "@/lib/encryption";
import { ThemeSelector } from "./ThemeSelector";
import { LanguageSelector } from "./LanguageSelector";
import { WebSearchSettings } from "./WebSearchSettings";
import { DocumentSettings } from "./DocumentSettings";
import {
    Key,
    Plus,
    Trash2,
    Check,
    X,
    Eye,
    EyeOff,
    Settings,
    Zap,
    AlertCircle,
    ChevronDown,
    Save,
    Loader2,
    RefreshCw,
    Shield,
    Lock,
    Palette,
    Languages,
    Monitor,
    Info,
    Cpu,
    BookOpen,
    Users,
    ExternalLink,
    Globe,
    FileText
} from "lucide-react";

export interface ApiProvider {
    id: string;
    name: string;
    type: "groq" | "openai" | "anthropic" | "google" | "local" | "custom";
    apiKey: string;
    baseUrl?: string;
    models: string[];
    enabledModels?: string[];
    isActive: boolean;
}

const DEFAULT_PROVIDERS: Omit<ApiProvider, "apiKey" | "isActive">[] = [
    {
        id: "groq",
        name: "Groq",
        type: "groq",
        baseUrl: "https://api.groq.com/openai/v1",
        models: [],
    },
    {
        id: "openai",
        name: "OpenAI",
        type: "openai",
        baseUrl: "https://api.openai.com/v1",
        models: [],
    },
    {
        id: "anthropic",
        name: "Anthropic",
        type: "anthropic",
        baseUrl: "https://api.anthropic.com/v1",
        models: [],
    },
    {
        id: "google",
        name: "Google AI",
        type: "google",
        baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
        models: [],
    },
    {
        id: "local",
        name: "Local (Ollama/LM Studio)",
        type: "local",
        baseUrl: "http://localhost:11434/v1",
        models: [],
    },
];

interface AppSettingsProps {
    isOpen: boolean;
    onClose: () => void;
    onProvidersChange: (providers: ApiProvider[]) => void;
}

export function AppSettings({ isOpen, onClose, onProvidersChange }: AppSettingsProps) {
    const [activeTab, setActiveTab] = useState<"apis" | "web" | "docs" | "interface" | "guide" | "about">("apis");
    const [providers, setProviders] = useState<ApiProvider[]>([]);
    const [originalProviders, setOriginalProviders] = useState<ApiProvider[]>([]);
    const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
    const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
    const [showAddCustom, setShowAddCustom] = useState(false);
    const [loadingModels, setLoadingModels] = useState<string | null>(null);
    const [modelError, setModelError] = useState<string | null>(null);
    const [saveToStorage, setSaveToStorage] = useState(true);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        const loadSavedProviders = async () => {
            try {
                const saved = await SecureStorage.getItem("api-providers");
                if (saved) {
                    setProviders(saved);
                    setOriginalProviders(saved);
                    onProvidersChange(saved);
                }
            } catch (e) {
                console.error("Error loading providers:", e);
            }
        };

        const savePreference = localStorage.getItem("nexo-save-apis");
        setSaveToStorage(savePreference === "true");
        loadSavedProviders();
    }, []);

    const saveProviders = (newProviders: ApiProvider[]) => {
        setProviders(newProviders);
        const changes = JSON.stringify(newProviders) !== JSON.stringify(originalProviders);
        setHasChanges(changes);
    };

    const applyChanges = async () => {
        if (saveToStorage) {
            try {
                await SecureStorage.setItem("api-providers", providers);
            } catch (e) {
                localStorage.setItem("nexo-api-providers", JSON.stringify(providers));
            }
        }
        setOriginalProviders(providers);
        onProvidersChange(providers);
        setHasChanges(false);
        if (activeTab === "apis") onClose();
    };

    const RECOMMENDED_MODELS: Record<string, string[]> = {
        groq: ["openai/gpt-oss-120b", "llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
        openai: ["gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"],
        anthropic: ["claude-3-5-sonnet-20241022", "claude-3-opus-20240229"],
        google: ["gemini-1.5-pro", "gemini-1.5-flash"],
    };

    const handleAddProvider = (defaultProvider: any) => {
        if (providers.some(p => p.id === defaultProvider.id)) {
            setExpandedProvider(defaultProvider.id);
            return;
        }
        const newProvider: ApiProvider = {
            ...defaultProvider,
            apiKey: "",
            isActive: false,
            enabledModels: [] // Initialize empty
        };
        saveProviders([...providers, newProvider]);
        setExpandedProvider(defaultProvider.id);
    };

    const handleUpdateProvider = (id: string, updates: Partial<ApiProvider>) => {
        const newProviders = providers.map(p => p.id === id ? { ...p, ...updates } : p);
        saveProviders(newProviders);
    };

    const toggleModel = (providerId: string, modelId: string) => {
        const provider = providers.find(p => p.id === providerId);
        if (!provider) return;

        const currentEnabled = provider.enabledModels || provider.models; // If undefined, assume all were enabled
        const isEnabled = currentEnabled.includes(modelId);

        let newEnabled;
        if (isEnabled) {
            newEnabled = currentEnabled.filter(m => m !== modelId);
        } else {
            newEnabled = [...currentEnabled, modelId];
        }

        handleUpdateProvider(providerId, { enabledModels: newEnabled });
    };

    const fetchModelsForProvider = async (providerId: string) => {
        const provider = providers.find(p => p.id === providerId);
        if (!provider) return;

        // For local providers, API key is optional
        if (provider.type !== "local" && !provider.apiKey) {
            setModelError("Ingresa una API Key primero");
            return;
        }

        setLoadingModels(providerId);
        setModelError(null);

        try {
            const response = await fetch("/api/fetch-models", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    api_type: provider.type,
                    api_key: provider.apiKey,
                    base_url: provider.baseUrl || null
                }),
            });
            const data = await response.json();

            if (data.success && data.models.length > 0) {
                const modelIds = data.models.map((m: any) => m.id);
                handleUpdateProvider(providerId, {
                    models: modelIds,
                    enabledModels: modelIds, // Enable all fetched models by default
                    isActive: true
                });
                setModelError(null);
            } else if (data.error) {
                setModelError(data.error);
            } else {
                setModelError("No se encontraron modelos disponibles");
            }
        } catch (err: any) {
            console.error("Error fetching models:", err);
            setModelError(err.message || "Error al conectar con el proveedor");
        } finally {
            setLoadingModels(null);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />

            <div className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border bg-muted/30">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                            <Settings className="h-6 w-6 animate-spin-slow" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-foreground">Ajustes de Nexo</h2>
                            <p className="text-sm text-muted-foreground">Configura tu experiencia Equipos de agentes IA</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
                        <X className="h-6 w-6 text-muted-foreground" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-border bg-muted/10 px-4">
                    <TabButton active={activeTab === "apis"} onClick={() => setActiveTab("apis")} icon={<Key size={18} />} label="APIs & Modelos" />
                    <TabButton active={activeTab === "web"} onClick={() => setActiveTab("web")} icon={<Globe size={18} />} label="Búsqueda web" />
                    <TabButton active={activeTab === "docs"} onClick={() => setActiveTab("docs")} icon={<FileText size={18} />} label="Documentos" />
                    <TabButton active={activeTab === "interface"} onClick={() => setActiveTab("interface")} icon={<Monitor size={18} />} label="Interfaz" />
                    <TabButton active={activeTab === "guide"} onClick={() => setActiveTab("guide")} icon={<BookOpen size={18} />} label="Cómo Usar" />
                    <TabButton active={activeTab === "about"} onClick={() => setActiveTab("about")} icon={<Info size={18} />} label="Información" />
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {activeTab === "apis" && (
                        <div className="space-y-6">
                            <section>
                                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Proveedores de Inteligencia</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {DEFAULT_PROVIDERS.map(p => (
                                        <button key={p.id} onClick={() => handleAddProvider(p)} className={cn(
                                            "flex items-center justify-between p-4 rounded-xl border transition-all text-left group",
                                            providers.some(pr => pr.id === p.id) ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/50 hover:bg-muted/50"
                                        )}>
                                            <div className="flex items-center gap-3">
                                                <Zap size={20} className={providers.some(pr => pr.id === p.id) ? "text-primary" : "text-muted-foreground"} />
                                                <span className="font-medium">{p.name}</span>
                                            </div>
                                            <ChevronDown size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
                                        </button>
                                    ))}
                                </div>
                            </section>

                            {providers.length > 0 && (
                                <section className="space-y-3">
                                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Mis Conexiones</h3>
                                    {providers.map(provider => (
                                        <div key={provider.id} className="border border-border rounded-xl overflow-hidden bg-muted/20">
                                            <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setExpandedProvider(expandedProvider === provider.id ? null : provider.id)}>
                                                <div className="flex items-center gap-3">
                                                    <div className={cn("w-2.5 h-2.5 rounded-full shadow-[0_0_8px]", provider.isActive && provider.apiKey ? "bg-green-500 shadow-green-500/50" : "bg-muted-foreground")} />
                                                    <span className="font-semibold">{provider.name}</span>
                                                </div>
                                                <ChevronDown className={cn("transition-transform duration-300", expandedProvider === provider.id && "rotate-180")} />
                                            </div>

                                            {expandedProvider === provider.id && (
                                                <div className="p-4 bg-background border-t border-border space-y-4 animate-in fade-in slide-in-from-top-2">
                                                    {/* API Key Input - Hide for local providers that don't need it */}
                                                    {provider.type !== "local" && (
                                                        <div>
                                                            <label className="text-xs font-bold text-muted-foreground uppercase mb-1.5 block">API Key</label>
                                                            <div className="relative">
                                                                <input
                                                                    type={showKeys[provider.id] ? "text" : "password"}
                                                                    value={provider.apiKey}
                                                                    onChange={(e) => handleUpdateProvider(provider.id, { apiKey: e.target.value, isActive: e.target.value.length > 0 })}
                                                                    className="w-full bg-muted/30 border border-border rounded-lg px-4 py-2.5 pr-12 focus:ring-2 focus:ring-primary/40 outline-none"
                                                                    placeholder={`Enter ${provider.name} key...`}
                                                                />
                                                                <button onClick={() => setShowKeys({ ...showKeys, [provider.id]: !showKeys[provider.id] })} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground">
                                                                    {showKeys[provider.id] ? <EyeOff size={18} /> : <Eye size={18} />}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Base URL for local/custom providers */}
                                                    {(provider.type === "local" || provider.type === "custom") && (
                                                        <div>
                                                            <label className="text-xs font-bold text-muted-foreground uppercase mb-1.5 block">URL del Servidor</label>
                                                            <input
                                                                type="text"
                                                                value={provider.baseUrl || ""}
                                                                onChange={(e) => handleUpdateProvider(provider.id, { baseUrl: e.target.value })}
                                                                className="w-full bg-muted/30 border border-border rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary/40 outline-none"
                                                                placeholder={provider.type === "local" ? "http://localhost:11434" : "https://api.example.com/v1"}
                                                            />
                                                        </div>
                                                    )}

                                                    {/* Sync Models Button */}
                                                    <button
                                                        onClick={() => fetchModelsForProvider(provider.id)}
                                                        disabled={(provider.type !== "local" && !provider.apiKey) || loadingModels === provider.id}
                                                        className="w-full bg-primary/10 text-primary border border-primary/20 py-2.5 rounded-lg font-medium hover:bg-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {loadingModels === provider.id ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
                                                        Sincronizar Modelos
                                                    </button>

                                                    {/* Error Message */}
                                                    {modelError && expandedProvider === provider.id && (
                                                        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                                                            <AlertCircle size={16} />
                                                            {modelError}
                                                        </div>
                                                    )}

                                                    {/* Models List */}
                                                    {provider.models.length > 0 && (
                                                        <div className="space-y-2">
                                                            <div className="flex items-center justify-between">
                                                                <label className="text-xs font-bold text-muted-foreground uppercase">
                                                                    Modelos Disponibles
                                                                </label>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[10px] text-primary font-mono">
                                                                        {(provider.enabledModels || provider.models).length}/{provider.models.length} activos
                                                                    </span>
                                                                    <button
                                                                        onClick={() => handleUpdateProvider(provider.id, { enabledModels: provider.models })}
                                                                        className="text-[10px] text-primary hover:underline"
                                                                    >
                                                                        Todos
                                                                    </button>
                                                                    <span className="text-muted-foreground">|</span>
                                                                    <button
                                                                        onClick={() => handleUpdateProvider(provider.id, { enabledModels: [] })}
                                                                        className="text-[10px] text-muted-foreground hover:underline"
                                                                    >
                                                                        Ninguno
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <div className="max-h-48 overflow-y-auto space-y-1 p-2 bg-muted/20 rounded-lg border border-border custom-scrollbar">
                                                                {provider.models.map((model) => {
                                                                    const isEnabled = (provider.enabledModels || provider.models).includes(model);
                                                                    const isRecommended = RECOMMENDED_MODELS[provider.type]?.includes(model);

                                                                    return (
                                                                        <button
                                                                            key={model}
                                                                            onClick={() => toggleModel(provider.id, model)}
                                                                            className={cn(
                                                                                "w-full flex items-center gap-2 px-2 py-1.5 rounded-md transition-all text-left group",
                                                                                isEnabled
                                                                                    ? "bg-primary/10 hover:bg-primary/20 border border-primary/20"
                                                                                    : "hover:bg-muted/50 border border-transparent"
                                                                            )}
                                                                        >
                                                                            {/* Checkbox */}
                                                                            <div className={cn(
                                                                                "w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all",
                                                                                isEnabled
                                                                                    ? "bg-primary border-primary"
                                                                                    : "border-muted-foreground/30 group-hover:border-primary/50"
                                                                            )}>
                                                                                {isEnabled && <Check size={12} className="text-primary-foreground" />}
                                                                            </div>

                                                                            {/* Model Name */}
                                                                            <span className={cn(
                                                                                "flex-1 truncate text-xs font-mono transition-colors",
                                                                                isEnabled ? "text-foreground font-medium" : "text-muted-foreground"
                                                                            )}>
                                                                                {model}
                                                                            </span>

                                                                            {/* Recommended Badge */}
                                                                            {isRecommended && (
                                                                                <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-primary/20 text-primary border border-primary/30 shrink-0">
                                                                                    ⚡ FREE
                                                                                </span>
                                                                            )}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="flex justify-end">
                                                        <button onClick={() => saveProviders(providers.filter(p => p.id !== provider.id))} className="text-xs text-destructive hover:font-bold transition-all px-2 py-1">Desconectar Proveedor</button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </section>
                            )}
                        </div>
                    )}

                    {activeTab === "web" && <WebSearchSettings />}

                    {activeTab === "docs" && <DocumentSettings providers={providers} />}

                    {activeTab === "interface" && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                            <section>
                                <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                                    <Palette size={18} className="text-primary" /> Apariencia Visual
                                </h3>
                                <div className="p-4 bg-muted/20 border border-border rounded-2xl">
                                    <ThemeSelector />
                                </div>
                            </section>

                            <section>
                                <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                                    <Languages size={18} className="text-primary" /> Idioma del Sistema
                                </h3>
                                <div className="p-4 bg-muted/20 border border-border rounded-2xl">
                                    <LanguageSelector />
                                </div>
                            </section>

                            <section>
                                <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                                    <Shield size={18} className="text-primary" /> Privacidad
                                </h3>
                                <div className="flex items-center justify-between p-4 bg-muted/20 border border-border rounded-2xl">
                                    <span className="text-sm font-medium">Encriptar datos en el navegador</span>
                                    <button
                                        onClick={() => { setSaveToStorage(!saveToStorage); localStorage.setItem("nexo-save-apis", String(!saveToStorage)); }}
                                        className={cn("w-12 h-6 rounded-full transition-all relative", saveToStorage ? "bg-primary" : "bg-muted-foreground/30")}
                                    >
                                        <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full transition-all", saveToStorage ? "right-1" : "left-1")} />
                                    </button>
                                </div>
                            </section>
                        </div>
                    )}

                    {activeTab === "guide" && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                            {/* Sección 1: Obtener API Key */}
                            <section className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-2xl border border-blue-200 dark:border-blue-800">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
                                        <Key size={20} className="text-white" />
                                    </div>
                                    <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100">1. Obtener tu API Key GRATIS</h3>
                                </div>

                                <div className="space-y-4">
                                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-blue-200 dark:border-blue-700">
                                        <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-3 flex items-center gap-2">
                                            <Zap size={16} className="text-yellow-500" />
                                            Groq - La Opción GRATIS Recomendada
                                        </h4>
                                        <ol className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                                            <li className="flex gap-2">
                                                <span className="w-6 h-6 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-xs font-bold text-blue-600 dark:text-blue-300 flex-shrink-0">1</span>
                                                <span>Visita <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">console.groq.com/keys</a></span>
                                            </li>
                                            <li className="flex gap-2">
                                                <span className="w-6 h-6 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-xs font-bold text-blue-600 dark:text-blue-300 flex-shrink-0">2</span>
                                                <span>Regístrate con tu email (es gratis)</span>
                                            </li>
                                            <li className="flex gap-2">
                                                <span className="w-6 h-6 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-xs font-bold text-blue-600 dark:text-blue-300 flex-shrink-0">3</span>
                                                <span>Crea una nueva API Key</span>
                                            </li>
                                            <li className="flex gap-2">
                                                <span className="w-6 h-6 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-xs font-bold text-blue-600 dark:text-blue-300 flex-shrink-0">4</span>
                                                <span>Copia la key y pégala aquí abajo</span>
                                            </li>
                                        </ol>
                                        <div className="mt-3 p-2 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                                            <p className="text-xs text-green-700 dark:text-green-300 font-medium">
                                                💰 <strong>Gratis:</strong> $0.50 USD en créditos mensuales + uso libre durante beta
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Sección 2: Configurar la App */}
                            <section className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 rounded-2xl border border-green-200 dark:border-green-800">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center">
                                        <Settings size={20} className="text-white" />
                                    </div>
                                    <h3 className="text-lg font-bold text-green-900 dark:text-green-100">2. Configurar Nexo Platform</h3>
                                </div>

                                <div className="space-y-4">
                                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-green-200 dark:border-green-700">
                                        <ol className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                                            <li className="flex gap-2">
                                                <span className="w-6 h-6 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center text-xs font-bold text-green-600 dark:text-green-300 flex-shrink-0">1</span>
                                                <span>Ve a <strong>Ajustes</strong> (ícono ⚙️)</span>
                                            </li>
                                            <li className="flex gap-2">
                                                <span className="w-6 h-6 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center text-xs font-bold text-green-600 dark:text-green-300 flex-shrink-0">2</span>
                                                <span>En la pestaña <strong>“APIs & Modelos”</strong></span>
                                            </li>
                                            <li className="flex gap-2">
                                                <span className="w-6 h-6 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center text-xs font-bold text-green-600 dark:text-green-300 flex-shrink-0">3</span>
                                                <span>Selecciona <strong>Groq</strong> y haz clic en <strong>“Añadir Proveedor”</strong></span>
                                            </li>
                                            <li className="flex gap-2">
                                                <span className="w-6 h-6 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center text-xs font-bold text-green-600 dark:text-green-300 flex-shrink-0">4</span>
                                                <span>Pega tu API Key en el campo correspondiente</span>
                                            </li>
                                            <li className="flex gap-2">
                                                <span className="w-6 h-6 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center text-xs font-bold text-green-600 dark:text-green-300 flex-shrink-0">5</span>
                                                <span>Click en <strong>“Sincronizar Modelos”</strong></span>
                                            </li>
                                            <li className="flex gap-2">
                                                <span className="w-6 h-6 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center text-xs font-bold text-green-600 dark:text-green-300 flex-shrink-0">6</span>
                                                <span>Selecciona <strong>“llama-3.3-70b-versatile”</strong> (modelo gratuito)</span>
                                            </li>
                                            <li className="flex gap-2">
                                                <span className="w-6 h-6 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center text-xs font-bold text-green-600 dark:text-green-300 flex-shrink-0">7</span>
                                                <span>Guarda la configuración</span>
                                            </li>
                                        </ol>
                                    </div>
                                </div>
                            </section>

                            {/* Sección 3: Usar la App */}
                            <section className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 rounded-2xl border border-purple-200 dark:border-purple-800">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 bg-purple-500 rounded-xl flex items-center justify-center">
                                        <Cpu size={20} className="text-white" />
                                    </div>
                                    <h3 className="text-lg font-bold text-purple-900 dark:text-purple-100">3. Usar Nexo Platform</h3>
                                </div>

                                <div className="space-y-4">
                                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-purple-200 dark:border-purple-700">
                                        <div className="grid md:grid-cols-2 gap-4">
                                            <div>
                                                <h4 className="font-semibold text-purple-800 dark:text-purple-200 mb-3 flex items-center gap-2">
                                                    <Monitor size={16} />
                                                    Versión PC/Desktop
                                                </h4>
                                                <ol className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                                                    <li className="flex gap-2">
                                                        <span className="w-6 h-6 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center text-xs font-bold text-purple-600 dark:text-purple-300 flex-shrink-0">1</span>
                                                        <span>Selecciona agentes en el panel izquierdo</span>
                                                    </li>
                                                    <li className="flex gap-2">
                                                        <span className="w-6 h-6 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center text-xs font-bold text-purple-600 dark:text-purple-300 flex-shrink-0">2</span>
                                                        <span>Escribe tu pregunta en el chat</span>
                                                    </li>
                                                    <li className="flex gap-2">
                                                        <span className="w-6 h-6 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center text-xs font-bold text-purple-600 dark:text-purple-300 flex-shrink-0">3</span>
                                                        <span>Los agentes procesan tu solicitud</span>
                                                    </li>
                                                    <li className="flex gap-2">
                                                        <span className="w-6 h-6 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center text-xs font-bold text-purple-600 dark:text-purple-300 flex-shrink-0">4</span>
                                                        <span>Recibe respuestas multi-agente</span>
                                                    </li>
                                                </ol>
                                            </div>

                                            <div>
                                                <h4 className="font-semibold text-purple-800 dark:text-purple-200 mb-3 flex items-center gap-2">
                                                    <Users size={16} />
                                                    Versión Móvil
                                                </h4>
                                                <ol className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                                                    <li className="flex gap-2">
                                                        <span className="w-6 h-6 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center text-xs font-bold text-purple-600 dark:text-purple-300 flex-shrink-0">1</span>
                                                        <span>Botón <strong>👥 Agentes</strong> para seleccionar</span>
                                                    </li>
                                                    <li className="flex gap-2">
                                                        <span className="w-6 h-6 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center text-xs font-bold text-purple-600 dark:text-purple-300 flex-shrink-0">2</span>
                                                        <span>Botón <strong>✅ Tareas</strong> para plantillas</span>
                                                    </li>
                                                    <li className="flex gap-2">
                                                        <span className="w-6 h-6 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center text-xs font-bold text-purple-600 dark:text-purple-300 flex-shrink-0">3</span>
                                                        <span>Escribe en el chat principal</span>
                                                    </li>
                                                    <li className="flex gap-2">
                                                        <span className="w-6 h-6 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center text-xs font-bold text-purple-600 dark:text-purple-300 flex-shrink-0">4</span>
                                                        <span>Memoria se guarda automáticamente</span>
                                                    </li>
                                                </ol>
                                            </div>
                                        </div>

                                        <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                                            <p className="text-xs text-yellow-700 dark:text-yellow-300 font-medium">
                                                💡 <strong>Tip:</strong> Usa múltiples agentes para mejores resultados (ej: reasoning + synthesis + coding)
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Sección 4: Características */}
                            <section className="p-6 bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20 rounded-2xl border border-orange-200 dark:border-orange-800">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
                                        <Zap size={20} className="text-white" />
                                    </div>
                                    <h3 className="text-lg font-bold text-orange-900 dark:text-orange-100">Características de Nexo Platform</h3>
                                </div>

                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-orange-200 dark:border-orange-700">
                                        <h4 className="font-semibold text-orange-800 dark:text-orange-200 mb-2">✅ Gratis & Privado</h4>
                                        <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                                            <li>• Sin registro requerido</li>
                                            <li>• Datos 100% locales</li>
                                            <li>• API Key gratuita disponible</li>
                                            <li>• Sin servidores externos</li>
                                        </ul>
                                    </div>

                                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-orange-200 dark:border-orange-700">
                                        <h4 className="font-semibold text-orange-800 dark:text-orange-200 mb-2">🤖 Multi-Agente</h4>
                                        <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                                            <li>• 30 agentes especializados</li>
                                            <li>• Procesamiento paralelo</li>
                                            <li>• Respuestas integradas</li>
                                            <li>• Niveles 1-5 de experiencia</li>
                                        </ul>
                                    </div>

                                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-orange-200 dark:border-orange-700">
                                        <h4 className="font-semibold text-orange-800 dark:text-orange-200 mb-2">📱 Multi-Plataforma</h4>
                                        <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                                            <li>• Desktop y móvil</li>
                                            <li>• Diseño responsivo</li>
                                            <li>• Temas claro/oscuro</li>
                                            <li>• Idiomas múltiples</li>
                                        </ul>
                                    </div>

                                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-orange-200 dark:border-orange-700">
                                        <h4 className="font-semibold text-orange-800 dark:text-orange-200 mb-2">🧠 Memoria Inteligente</h4>
                                        <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                                            <li>• Auto-guardado cada 2s</li>
                                            <li>• Persistencia local</li>
                                            <li>• Historial completo</li>
                                            <li>• Conversaciones organizadas</li>
                                        </ul>
                                    </div>
                                </div>
                            </section>

                            {/* Botón directo a Groq */}
                            <div className="text-center">
                                <a
                                    href="https://console.groq.com/keys"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-8 py-4 rounded-2xl font-bold hover:scale-105 active:scale-95 transition-all shadow-lg shadow-blue-500/25"
                                >
                                    <Zap size={20} />
                                    Obtener API Key GRATIS en Groq
                                    <ExternalLink size={16} />
                                </a>
                                <p className="text-xs text-muted-foreground mt-2">
                                    Abre en nueva ventana → console.groq.com/keys
                                </p>
                            </div>
                        </div>
                    )}

                    {activeTab === "about" && (
                        <div className="space-y-6 text-center py-8 animate-in zoom-in-95 duration-300">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/favicon.svg" alt="" className="w-24 h-24 rounded-3xl mx-auto mb-4 shadow-xl shadow-primary/30" />
                            <h2 className="text-3xl font-black bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                                Nexo
                            </h2>
                            <p className="text-muted-foreground max-w-md mx-auto">
                                Equipos de <strong>500 agentes de IA</strong> en 50 categorías que trabajan en paralelo,
                                leen tus documentos, buscan en la web y entregan una respuesta integrada con fuentes citadas.
                            </p>
                            <div className="pt-6 grid grid-cols-3 gap-3 max-w-sm mx-auto text-xs font-mono">
                                <div className="p-3 border border-blue-500/30 rounded-xl bg-blue-500/5 text-blue-500">
                                    <div className="text-2xl font-black">500</div>
                                    <div className="text-[10px]">AGENTES</div>
                                </div>
                                <div className="p-3 border border-purple-500/30 rounded-xl bg-purple-500/5 text-purple-500">
                                    <div className="text-2xl font-black">50</div>
                                    <div className="text-[10px]">CATEGORÍAS</div>
                                </div>
                                <div className="p-3 border border-pink-500/30 rounded-xl bg-pink-500/5 text-pink-500">
                                    <div className="text-2xl font-black">100</div>
                                    <div className="text-[10px]">TAREAS</div>
                                </div>
                            </div>
                            <div className="pt-4 text-xs text-muted-foreground">
                                <p>Versión {process.env.NEXT_PUBLIC_VERSION || "1.0.0"} • Open source (MIT)</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-border bg-muted/30 flex items-center justify-between">
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Lock size={12} className="text-primary" /> Datos encriptados localmente
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-5 py-2 rounded-xl text-sm font-semibold hover:bg-muted transition-colors">Cerrar</button>
                        {hasChanges && (
                            <button
                                onClick={applyChanges}
                                className="bg-primary text-primary-foreground px-6 py-2 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                            >
                                <Save size={18} /> Guardar Configuración
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex items-center gap-2 px-6 py-4 text-sm font-bold transition-all relative border-b-2",
                active ? "text-primary border-primary bg-primary/5" : "text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/30"
            )}
        >
            {icon}
            <span>{label}</span>
        </button>
    );
}
