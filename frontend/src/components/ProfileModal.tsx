"use client";

import { useEffect, useState, useCallback } from "react";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    Loader2, Activity, Zap, Shield, Crown, Brain, Settings,
    Plus, Trash2, Save, User, Sparkles, Tag, ChevronDown
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { fetchWithAuth } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface UserUsage {
    queries_used: number;
    queries_limit: number;
    queries_remaining: number;
    plan: string;
    max_agents: number;
    tokens_consumed?: number;
}

interface MemoryItem {
    id: string;
    key: string;
    value: string;
    category: string;
    importance: number;
    created_at: string;
    updated_at: string;
}

type TabType = "profile" | "memory" | "preferences";

const MEMORY_CATEGORIES = [
    { value: "general", label: "General", icon: "📌" },
    { value: "context", label: "Contexto Personal", icon: "👤" },
    { value: "preference", label: "Preferencia", icon: "⚙️" },
    { value: "instruction", label: "Instrucción para IA", icon: "🤖" },
];

export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
    const { user, logout } = useAuth();
    const [activeTab, setActiveTab] = useState<TabType>("profile");
    const [usage, setUsage] = useState<UserUsage | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Memory state
    const [memories, setMemories] = useState<MemoryItem[]>([]);
    const [newKey, setNewKey] = useState("");
    const [newValue, setNewValue] = useState("");
    const [newCategory, setNewCategory] = useState("general");
    const [newImportance, setNewImportance] = useState(5);
    const [isSaving, setIsSaving] = useState(false);
    const [memoryFilter, setMemoryFilter] = useState<string>("all");

    // Preferences state
    const [customInstructions, setCustomInstructions] = useState("");
    const [prefLanguage, setPrefLanguage] = useState("es");
    const [prefTheme, setPrefTheme] = useState("dark");
    const [autoSave, setAutoSave] = useState(true);
    const [showThinking, setShowThinking] = useState(false);
    const [prefsSaved, setPrefsSaved] = useState(false);

    useEffect(() => {
        if (isOpen && user) {
            loadUsage();
            loadMemories();
            loadPreferences();
        }
    }, [isOpen, user]);

    const loadUsage = async () => {
        setIsLoading(true);
        try {
            const res = await fetchWithAuth("/api/auth/usage");
            if (res.ok) {
                setUsage(await res.json());
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const loadMemories = async () => {
        try {
            const res = await fetchWithAuth("/api/memory/");
            if (res.ok) {
                const data = await res.json();
                setMemories(data.memories || []);
            }
        } catch (error) {
            console.error("Error loading memories:", error);
        }
    };

    const loadPreferences = async () => {
        try {
            const res = await fetchWithAuth("/api/auth/me");
            if (res.ok) {
                const data = await res.json();
                setPrefLanguage(data.preferred_language || "es");
            }
        } catch {}
    };

    const saveMemory = async () => {
        if (!newKey.trim() || !newValue.trim()) return;
        setIsSaving(true);
        try {
            const res = await fetchWithAuth("/api/memory/", {
                method: "POST",
                body: JSON.stringify({
                    key: newKey.trim(),
                    value: newValue.trim(),
                    category: newCategory,
                    importance: newImportance,
                }),
            });
            if (res.ok) {
                setNewKey("");
                setNewValue("");
                setNewCategory("general");
                setNewImportance(5);
                await loadMemories();
            }
        } catch (error) {
            console.error("Error saving memory:", error);
        } finally {
            setIsSaving(false);
        }
    };

    const deleteMemory = async (key: string) => {
        try {
            const res = await fetchWithAuth(`/api/memory/${encodeURIComponent(key)}`, { method: "DELETE" });
            if (res.ok) {
                setMemories(prev => prev.filter(m => m.key !== key));
            }
        } catch (error) {
            console.error("Error deleting memory:", error);
        }
    };

    const savePreferences = async () => {
        try {
            setPrefsSaved(false);
            // Save custom instructions as a memory item
            if (customInstructions.trim()) {
                await fetchWithAuth("/api/memory/", {
                    method: "POST",
                    body: JSON.stringify({
                        key: "custom_instructions",
                        value: customInstructions.trim(),
                        category: "instruction",
                        importance: 10,
                    }),
                });
            }
            setPrefsSaved(true);
            setTimeout(() => setPrefsSaved(false), 2000);
        } catch (error) {
            console.error("Error saving preferences:", error);
        }
    };

    if (!isOpen || !user) return null;

    const percentageUsed = usage
        ? Math.min(100, Math.round((usage.queries_used / usage.queries_limit) * 100))
        : 0;

    const filteredMemories = memoryFilter === "all"
        ? memories
        : memories.filter(m => m.category === memoryFilter);

    const tabs: { key: TabType; label: string; icon: React.ReactNode }[] = [
        { key: "profile", label: "Perfil", icon: <User className="h-4 w-4" /> },
        { key: "memory", label: "Memoria", icon: <Brain className="h-4 w-4" /> },
        { key: "preferences", label: "Preferencias", icon: <Settings className="h-4 w-4" /> },
    ];

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-lg bg-card border-primary/20 max-h-[85vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
                            <span className="font-bold text-primary">{user.username?.[0]?.toUpperCase() || "U"}</span>
                        </div>
                        <span className="text-xl font-bold">{user.username}</span>
                        <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">{user.user_code}</span>
                    </DialogTitle>
                </DialogHeader>

                {/* Tabs */}
                <div className="flex gap-1 border-b border-border pb-0">
                    {tabs.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-[1px]",
                                activeTab === tab.key
                                    ? "border-primary text-primary bg-primary/5"
                                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
                            )}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto py-3 space-y-4 min-h-0">

                    {/* ===== PROFILE TAB ===== */}
                    {activeTab === "profile" && (
                        <>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-muted/40 p-3 rounded-xl border border-border">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-1">Rol</p>
                                    <div className="flex items-center gap-2">
                                        <Shield className="h-4 w-4 text-primary" />
                                        <span className="font-medium text-sm capitalize">{user.role}</span>
                                    </div>
                                </div>
                                <div className="bg-muted/40 p-3 rounded-xl border border-border">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-1">Memorias</p>
                                    <div className="flex items-center gap-2">
                                        <Brain className="h-4 w-4 text-purple-400" />
                                        <span className="font-medium text-sm">{memories.length} guardadas</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gradient-to-br from-primary/5 via-card to-card p-4 rounded-xl border border-primary/10">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <Activity className="h-5 w-5 text-primary" />
                                        <h3 className="font-bold text-sm">Uso Mensual</h3>
                                    </div>
                                    {usage?.plan === "admin" && (
                                        <span className="flex items-center gap-1 text-[10px] font-bold bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full border border-amber-500/20">
                                            <Crown className="h-3 w-3" /> ADMIN
                                        </span>
                                    )}
                                </div>

                                {isLoading ? (
                                    <div className="h-16 flex items-center justify-center">
                                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                    </div>
                                ) : usage ? (
                                    <div className="space-y-3">
                                        <div>
                                            <div className="flex justify-between text-xs mb-1">
                                                <span className="text-muted-foreground">Consultas</span>
                                                <span className="font-mono font-bold">
                                                    {usage.queries_used} / {usage.queries_limit === -1 ? "∞" : usage.queries_limit}
                                                </span>
                                            </div>
                                            {usage.queries_limit !== -1 && (
                                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                    <div className="h-full bg-gradient-to-r from-primary to-purple-500 transition-all" style={{ width: `${percentageUsed}%` }} />
                                                </div>
                                            )}
                                        </div>
                                        {usage.queries_remaining < 5 && usage.queries_limit !== -1 && (
                                            <div className="text-xs text-amber-500 bg-amber-500/10 p-2 rounded border border-amber-500/20 flex items-center gap-2">
                                                <Zap className="h-3 w-3" /> Quedan pocas consultas este mes.
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-xs text-muted-foreground">Información de uso no disponible.</p>
                                )}
                            </div>

                            <div className="flex justify-between items-center pt-1">
                                <Button variant="outline" size="sm" className="text-xs" onClick={onClose}>Cerrar</Button>
                                <Button variant="destructive" size="sm" className="text-xs" onClick={() => { logout(); onClose(); }}>
                                    Cerrar Sesión
                                </Button>
                            </div>
                        </>
                    )}

                    {/* ===== MEMORY TAB ===== */}
                    {activeTab === "memory" && (
                        <>
                            <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 p-3 rounded-xl border border-purple-500/20">
                                <div className="flex items-center gap-2 mb-1">
                                    <Sparkles className="h-4 w-4 text-purple-400" />
                                    <span className="text-sm font-semibold">Memoria Persistente</span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Los datos guardados aquí se inyectan como contexto en cada conversación con los agentes IA.
                                </p>
                            </div>

                            {/* Add new memory */}
                            <div className="bg-muted/30 p-3 rounded-xl border border-border space-y-2">
                                <h4 className="text-sm font-semibold flex items-center gap-1.5">
                                    <Plus className="h-4 w-4 text-primary" /> Agregar Memoria
                                </h4>
                                <input
                                    type="text"
                                    placeholder="Clave (ej: nombre, empresa, stack)"
                                    value={newKey}
                                    onChange={e => setNewKey(e.target.value)}
                                    className="w-full p-2 text-sm bg-background border border-border rounded-lg focus:border-primary focus:outline-none"
                                />
                                <textarea
                                    placeholder="Valor (ej: Me llamo Carlos, trabajo en startup fintech)"
                                    value={newValue}
                                    onChange={e => setNewValue(e.target.value)}
                                    rows={2}
                                    className="w-full p-2 text-sm bg-background border border-border rounded-lg resize-none focus:border-primary focus:outline-none"
                                />
                                <div className="flex gap-2">
                                    <select
                                        value={newCategory}
                                        onChange={e => setNewCategory(e.target.value)}
                                        className="flex-1 p-2 text-xs bg-background border border-border rounded-lg focus:border-primary focus:outline-none"
                                    >
                                        {MEMORY_CATEGORIES.map(cat => (
                                            <option key={cat.value} value={cat.value}>{cat.icon} {cat.label}</option>
                                        ))}
                                    </select>
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <Tag className="h-3 w-3" />
                                        <input
                                            type="range" min={1} max={10}
                                            value={newImportance}
                                            onChange={e => setNewImportance(Number(e.target.value))}
                                            className="w-16 h-1 accent-primary"
                                        />
                                        <span className="font-mono w-4">{newImportance}</span>
                                    </div>
                                </div>
                                <Button
                                    onClick={saveMemory}
                                    disabled={!newKey.trim() || !newValue.trim() || isSaving}
                                    className="w-full text-xs h-8"
                                    size="sm"
                                >
                                    {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                                    Guardar Memoria
                                </Button>
                            </div>

                            {/* Filter */}
                            <div className="flex gap-1 flex-wrap">
                                <button
                                    onClick={() => setMemoryFilter("all")}
                                    className={cn("text-[11px] px-2 py-1 rounded-full border transition-colors",
                                        memoryFilter === "all" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"
                                    )}
                                >
                                    Todas ({memories.length})
                                </button>
                                {MEMORY_CATEGORIES.map(cat => {
                                    const count = memories.filter(m => m.category === cat.value).length;
                                    if (count === 0) return null;
                                    return (
                                        <button
                                            key={cat.value}
                                            onClick={() => setMemoryFilter(cat.value)}
                                            className={cn("text-[11px] px-2 py-1 rounded-full border transition-colors",
                                                memoryFilter === cat.value ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"
                                            )}
                                        >
                                            {cat.icon} {cat.label} ({count})
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Memory list */}
                            <div className="space-y-2">
                                {filteredMemories.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <Brain className="h-10 w-10 mx-auto mb-2 opacity-30" />
                                        <p className="text-sm">Sin memorias guardadas</p>
                                        <p className="text-xs mt-1">Agrega información que quieras que los agentes recuerden</p>
                                    </div>
                                ) : (
                                    filteredMemories.map(mem => (
                                        <div key={mem.id} className="group p-3 bg-muted/30 rounded-lg border border-border/60 hover:border-primary/30 transition-colors">
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-xs font-mono font-bold text-primary truncate">{mem.key}</span>
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary/70 shrink-0">
                                                            {MEMORY_CATEGORIES.find(c => c.value === mem.category)?.icon || "📌"} {mem.category}
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground shrink-0">⭐{mem.importance}</span>
                                                    </div>
                                                    <p className="text-sm text-foreground/80 leading-snug">{mem.value}</p>
                                                </div>
                                                <button
                                                    onClick={() => deleteMemory(mem.key)}
                                                    className="p-1 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 shrink-0 ml-2"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </>
                    )}

                    {/* ===== PREFERENCES TAB ===== */}
                    {activeTab === "preferences" && (
                        <>
                            <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 p-3 rounded-xl border border-blue-500/20">
                                <div className="flex items-center gap-2 mb-1">
                                    <Settings className="h-4 w-4 text-blue-400" />
                                    <span className="text-sm font-semibold">Instrucciones Personalizadas</span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Define cómo quieres que los agentes se comporten contigo. Se aplica a todas las conversaciones.
                                </p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">
                                        Instrucciones para la IA
                                    </label>
                                    <textarea
                                        value={customInstructions}
                                        onChange={e => setCustomInstructions(e.target.value)}
                                        placeholder="Ej: Siempre responde en español. Usa ejemplos de código en Python. Soy desarrollador senior, no necesito explicaciones básicas."
                                        rows={4}
                                        className="w-full p-3 text-sm bg-background border border-border rounded-xl resize-none focus:border-primary focus:outline-none"
                                    />
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                        Se inyecta como contexto en cada conversación con agentes.
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Idioma</label>
                                        <select
                                            value={prefLanguage}
                                            onChange={e => setPrefLanguage(e.target.value)}
                                            className="w-full p-2 text-sm bg-background border border-border rounded-lg focus:border-primary focus:outline-none"
                                        >
                                            <option value="es">🇪🇸 Español</option>
                                            <option value="en">🇺🇸 English</option>
                                            <option value="pt">🇧🇷 Português</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Tema</label>
                                        <select
                                            value={prefTheme}
                                            onChange={e => setPrefTheme(e.target.value)}
                                            className="w-full p-2 text-sm bg-background border border-border rounded-lg focus:border-primary focus:outline-none"
                                        >
                                            <option value="dark">🌙 Oscuro</option>
                                            <option value="light">☀️ Claro</option>
                                            <option value="system">💻 Sistema</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={autoSave}
                                            onChange={e => setAutoSave(e.target.checked)}
                                            className="rounded accent-primary"
                                        />
                                        <div>
                                            <span className="text-sm font-medium">Auto-guardar conversaciones</span>
                                            <p className="text-[11px] text-muted-foreground">Guarda automáticamente en PostgreSQL</p>
                                        </div>
                                    </label>
                                    <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={showThinking}
                                            onChange={e => setShowThinking(e.target.checked)}
                                            className="rounded accent-primary"
                                        />
                                        <div>
                                            <span className="text-sm font-medium">Mostrar pensamiento del agente</span>
                                            <p className="text-[11px] text-muted-foreground">Ver el proceso de razonamiento</p>
                                        </div>
                                    </label>
                                </div>

                                <Button onClick={savePreferences} className="w-full text-xs h-9" size="sm">
                                    {prefsSaved ? (
                                        <><Sparkles className="h-3 w-3 mr-1" /> Guardado</>
                                    ) : (
                                        <><Save className="h-3 w-3 mr-1" /> Guardar Preferencias</>
                                    )}
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
