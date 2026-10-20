/**
 * SpecializedAgentResponse
 * ================================
 * Componente que renderiza respuestas de agentes según su tipo/categoría
 * con formatos especializados y visualización profesional.
 */

'use client';

import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock, MermaidDiagram } from '@/components/Markdown';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
    Copy,
    Check,
    Download,
    Bookmark,
    ChevronDown,
    ChevronUp,
    Code2,
    FileText,
    BarChart3,
    Palette,
    Target,
    GraduationCap,
    ShoppingCart,
    Settings,
    Users,
    Handshake,
    Clock,
    Sparkles,
    ExternalLink,
} from 'lucide-react';

// ============================================================================
// TIPOS Y CONSTANTES
// ============================================================================

type ResponseType =
    | 'code'
    | 'document'
    | 'analysis'
    | 'creative'
    | 'strategic'
    | 'educational'
    | 'marketplace'
    | 'operational'
    | 'hr'
    | 'sales';

interface AgentResponse {
    agent_id: string;
    agent_name: string;
    agent_emoji?: string;
    level?: number;
    specialty?: string;
    category?: string;
    format_type?: string;
    raw_content?: string;
    summary?: string;
    sections?: Array<{
        type: string;
        title?: string;
        content?: string;
        items?: string[];
    }>;
    timestamp: string;
}

interface SpecializedAgentResponseProps {
    response: AgentResponse;
    conversationId?: string;
    messageId?: string;
    onSaveResponse?: (data: {
        agentId: string;
        agentName: string;
        content: string;
        conversationId?: string;
        messageId?: string;
    }) => void;
    isSaved?: boolean;
    isExpanded?: boolean;
}

// Mapeo de categorías a tipos de formato
const CATEGORY_FORMAT_MAP: Record<string, ResponseType> = {
    software_development: 'code',
    marketing: 'creative',
    finance: 'analysis',
    legal: 'document',
    human_resources: 'hr',
    sales: 'sales',
    operations: 'operational',
    education: 'educational',
    creative: 'creative',
    project_management: 'strategic',
    mercadolibre: 'marketplace',
    youtube: 'marketplace',
};

// Configuración visual por tipo de formato
// Paletas inspiradas en Radix Colors y Catppuccin Mocha
const FORMAT_CONFIG: Record<ResponseType, {
    icon: React.ElementType;
    label: string;
    bgGradient: string;
    borderColor: string;
    accentColor: string;
    textColor: string;
    headerBg: string;
}> = {
    code: {
        icon: Code2,
        label: 'Desarrollo',
        bgGradient: 'from-sky-500/15 via-sky-400/8 to-transparent',
        borderColor: 'border-l-sky-400',
        accentColor: 'text-sky-400',
        textColor: 'text-sky-300',
        headerBg: 'bg-sky-500/15',
    },
    document: {
        icon: FileText,
        label: 'Documento Legal',
        bgGradient: 'from-violet-500/15 via-violet-400/8 to-transparent',
        borderColor: 'border-l-violet-400',
        accentColor: 'text-violet-400',
        textColor: 'text-violet-300',
        headerBg: 'bg-violet-500/15',
    },
    analysis: {
        icon: BarChart3,
        label: 'Análisis',
        bgGradient: 'from-green-500/15 via-green-400/8 to-transparent',
        borderColor: 'border-l-green-400',
        accentColor: 'text-green-400',
        textColor: 'text-green-300',
        headerBg: 'bg-green-500/15',
    },
    creative: {
        icon: Palette,
        label: 'Creativo',
        bgGradient: 'from-fuchsia-500/15 via-fuchsia-400/8 to-transparent',
        borderColor: 'border-l-fuchsia-400',
        accentColor: 'text-fuchsia-400',
        textColor: 'text-fuchsia-300',
        headerBg: 'bg-fuchsia-500/15',
    },
    strategic: {
        icon: Target,
        label: 'Estratégico',
        bgGradient: 'from-indigo-500/15 via-indigo-400/8 to-transparent',
        borderColor: 'border-l-indigo-400',
        accentColor: 'text-indigo-400',
        textColor: 'text-indigo-300',
        headerBg: 'bg-indigo-500/15',
    },
    educational: {
        icon: GraduationCap,
        label: 'Educativo',
        bgGradient: 'from-teal-500/15 via-teal-400/8 to-transparent',
        borderColor: 'border-l-teal-400',
        accentColor: 'text-teal-400',
        textColor: 'text-teal-300',
        headerBg: 'bg-teal-500/15',
    },
    marketplace: {
        icon: ShoppingCart,
        label: 'Marketplace',
        bgGradient: 'from-amber-500/15 via-amber-400/8 to-transparent',
        borderColor: 'border-l-amber-400',
        accentColor: 'text-amber-400',
        textColor: 'text-amber-300',
        headerBg: 'bg-amber-500/15',
    },
    operational: {
        icon: Settings,
        label: 'Operaciones',
        bgGradient: 'from-slate-500/15 via-slate-400/8 to-transparent',
        borderColor: 'border-l-slate-400',
        accentColor: 'text-slate-400',
        textColor: 'text-slate-300',
        headerBg: 'bg-slate-500/15',
    },
    hr: {
        icon: Users,
        label: 'Recursos Humanos',
        bgGradient: 'from-orange-500/15 via-orange-400/8 to-transparent',
        borderColor: 'border-l-orange-400',
        accentColor: 'text-orange-400',
        textColor: 'text-orange-300',
        headerBg: 'bg-orange-500/15',
    },
    sales: {
        icon: Handshake,
        label: 'Ventas',
        bgGradient: 'from-rose-500/15 via-rose-400/8 to-transparent',
        borderColor: 'border-l-rose-400',
        accentColor: 'text-rose-400',
        textColor: 'text-rose-300',
        headerBg: 'bg-rose-500/15',
    },
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export function SpecializedAgentResponse({
    response,
    conversationId,
    messageId,
    onSaveResponse,
    isSaved = false,
    isExpanded: initialExpanded = true,
}: SpecializedAgentResponseProps) {
    const [copied, setCopied] = useState(false);
    const [expanded, setExpanded] = useState(initialExpanded);
    const [saved, setSaved] = useState(isSaved);

    // Determinar el tipo de formato basado en la categoría
    const formatType: ResponseType = useMemo(() => {
        if (response.format_type && response.format_type in FORMAT_CONFIG) {
            return response.format_type as ResponseType;
        }
        const category = response.category || 'analysis';
        return CATEGORY_FORMAT_MAP[category] || 'analysis';
    }, [response.format_type, response.category]);

    const config = FORMAT_CONFIG[formatType];
    const Icon = config.icon;

    // Obtener contenido principal
    const mainContent = useMemo(() => {
        if (response.raw_content) return response.raw_content;
        if (response.summary) return response.summary;
        if (response.sections?.length) {
            return response.sections
                .map(s => s.content || s.items?.join('\n'))
                .filter(Boolean)
                .join('\n\n');
        }
        return 'Sin contenido disponible.';
    }, [response]);

    // Contar palabras
    const wordCount = useMemo(() => {
        return mainContent.split(/\s+/).filter(Boolean).length;
    }, [mainContent]);

    // Handlers
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(mainContent);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Error copying:', error);
        }
    };

    const handleExport = () => {
        const blob = new Blob([mainContent], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${response.agent_name}_${new Date().toISOString().slice(0, 10)}.md`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleSave = () => {
        if (onSaveResponse && !saved) {
            onSaveResponse({
                agentId: response.agent_id,
                agentName: response.agent_name,
                content: mainContent,
                conversationId,
                messageId,
            });
            setSaved(true);
        }
    };

    return (
        <div
            className={cn(
                "group relative rounded-xl overflow-hidden transition-all duration-300",
                "border-l-4 bg-gradient-to-r",
                config.borderColor,
                config.bgGradient,
                "hover:shadow-xl hover:shadow-black/20",
                "animate-in fade-in-0 slide-in-from-left-2"
            )}
        >
            {/* ====== HEADER ====== */}
            <div
                className={cn(
                    "flex items-center justify-between px-4 py-3",
                    "border-b border-white/10",
                    config.headerBg
                )}
            >
                <div className="flex items-center gap-3">
                    {/* Icon & Emoji */}
                    <div
                        className={cn(
                            "relative p-2.5 rounded-xl border",
                            config.headerBg,
                            "border-current/20"
                        )}
                    >
                        <span className="text-2xl">{response.agent_emoji || '🤖'}</span>
                        <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-card border border-border">
                            <Icon className={cn("h-3 w-3", config.accentColor)} />
                        </div>
                    </div>

                    {/* Agent Info */}
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <span className={cn("font-bold text-base", config.accentColor)}>
                                {response.agent_name}
                            </span>
                            {response.level && (
                                <Badge
                                    variant="outline"
                                    className={cn("text-xs", config.textColor, "border-current/40")}
                                >
                                    N{response.level}
                                </Badge>
                            )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="secondary" className="text-xs px-2 py-0.5">
                                {config.label}
                            </Badge>
                            {response.specialty && (
                                <span className="italic">{response.specialty}</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5">
                    {/* Word Count */}
                    <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md bg-muted/50 text-xs text-muted-foreground">
                        <Sparkles className="h-3 w-3" />
                        <span>{wordCount} palabras</span>
                    </div>

                    {/* Copy */}
                    <button
                        onClick={handleCopy}
                        className={cn(
                            "p-2 rounded-lg transition-all",
                            copied
                                ? "bg-green-500/20 text-green-400"
                                : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                        )}
                        title="Copiar contenido"
                    >
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </button>

                    {/* Export */}
                    <button
                        onClick={handleExport}
                        className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-all"
                        title="Exportar como Markdown"
                    >
                        <Download className="h-4 w-4" />
                    </button>

                    {/* Save */}
                    <button
                        onClick={handleSave}
                        disabled={saved}
                        className={cn(
                            "p-2 rounded-lg transition-all",
                            saved
                                ? "bg-green-500/20 text-green-400"
                                : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                        )}
                        title={saved ? "Guardado" : "Guardar respuesta"}
                    >
                        <Bookmark className={cn("h-4 w-4", saved && "fill-current")} />
                    </button>

                    {/* Expand/Collapse */}
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-all"
                        title={expanded ? "Colapsar" : "Expandir"}
                    >
                        {expanded ? (
                            <ChevronUp className="h-4 w-4" />
                        ) : (
                            <ChevronDown className="h-4 w-4" />
                        )}
                    </button>
                </div>
            </div>

            {/* ====== CONTENT ====== */}
            {expanded && (
                <div className="px-5 py-4">
                    <div
                        className={cn(
                            "prose prose-sm max-w-none",
                            "prose-headings:font-bold prose-headings:tracking-tight",
                            "prose-h1:text-xl prose-h1:mb-4 prose-h1:mt-2",
                            "prose-h2:text-lg prose-h2:mb-3 prose-h2:mt-6 prose-h2:pb-2 prose-h2:border-b prose-h2:border-border/50",
                            "prose-h3:text-base prose-h3:mb-2 prose-h3:mt-4",
                            "prose-p:text-foreground/90 prose-p:leading-relaxed prose-p:mb-3",
                            "prose-ul:my-2 prose-ol:my-2",
                            "prose-li:text-foreground/85 prose-li:my-0.5",
                            "prose-strong:font-semibold",
                            "prose-code:text-primary prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:before:content-none prose-code:after:content-none",
                            "prose-pre:bg-black/40 prose-pre:border prose-pre:border-border/50 prose-pre:rounded-lg prose-pre:my-3",
                            "prose-blockquote:border-l-4 prose-blockquote:border-primary/50 prose-blockquote:bg-primary/5 prose-blockquote:px-4 prose-blockquote:py-2 prose-blockquote:rounded-r-lg prose-blockquote:italic prose-blockquote:text-foreground/80",
                            "prose-table:border prose-table:border-border/50 prose-table:rounded-lg prose-table:overflow-hidden",
                            "prose-th:bg-muted/50 prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:font-semibold prose-th:border-b prose-th:border-border/50",
                            "prose-td:px-3 prose-td:py-2 prose-td:border-b prose-td:border-border/30",
                            "prose-hr:border-border/50 prose-hr:my-4",
                            config.accentColor.replace('text-', 'prose-headings:text-'),
                            "dark:prose-invert"
                        )}
                    >
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                h1: ({ children }) => (
                                    <h1 className={cn("text-xl font-bold mb-4 mt-2 flex items-center gap-2", config.accentColor)}>
                                        {children}
                                    </h1>
                                ),
                                h2: ({ children }) => (
                                    <h2 className={cn("text-lg font-semibold mb-3 mt-6 pb-2 border-b border-border/50", config.accentColor)}>
                                        {children}
                                    </h2>
                                ),
                                h3: ({ children }) => (
                                    <h3 className={cn("text-base font-medium mb-2 mt-4", config.textColor)}>
                                        {children}
                                    </h3>
                                ),
                                p: ({ children }) => (
                                    <p className="text-foreground/90 leading-relaxed mb-3">{children}</p>
                                ),
                                ul: ({ children }) => (
                                    <ul className="list-disc list-inside space-y-1 mb-3 ml-2">{children}</ul>
                                ),
                                ol: ({ children }) => (
                                    <ol className="list-decimal list-inside space-y-1 mb-3 ml-2">{children}</ol>
                                ),
                                li: ({ children }) => (
                                    <li className="text-foreground/85">{children}</li>
                                ),
                                code: ({ children, className }) => {
                                    const language = /language-([\w-]+)/.exec(className || "")?.[1];
                                    const text = String(children ?? "").replace(/\n$/, "");
                                    if (!language && !text.includes("\n")) {
                                        return (
                                            <code className={cn("px-1.5 py-0.5 rounded text-sm font-mono", config.headerBg, config.accentColor)}>
                                                {children}
                                            </code>
                                        );
                                    }
                                    if (language === "mermaid") return <MermaidDiagram code={text} />;
                                    return <CodeBlock language={language} code={text} />;
                                },
                                pre: ({ children }) => <>{children}</>,
                                blockquote: ({ children }) => (
                                    <blockquote className={cn("border-l-4 px-4 py-2 my-3 rounded-r-lg italic", `border-l-${config.accentColor.replace('text-', '')}`, config.headerBg)}>
                                        {children}
                                    </blockquote>
                                ),
                                table: ({ children }) => (
                                    <div className="overflow-x-auto my-4 border border-border/50 rounded-lg">
                                        <table className="w-full text-sm">{children}</table>
                                    </div>
                                ),
                                th: ({ children }) => (
                                    <th className={cn("px-3 py-2 text-left font-semibold border-b border-border/50", config.headerBg, config.accentColor)}>
                                        {children}
                                    </th>
                                ),
                                td: ({ children }) => (
                                    <td className="px-3 py-2 border-b border-border/30">{children}</td>
                                ),
                                strong: ({ children }) => (
                                    <strong className={cn("font-semibold", config.accentColor)}>{children}</strong>
                                ),
                                a: ({ children, href }) => (
                                    <a
                                        href={href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={cn("underline inline-flex items-center gap-1", config.accentColor, "hover:opacity-80")}
                                    >
                                        {children}
                                        <ExternalLink className="h-3 w-3" />
                                    </a>
                                ),
                                hr: () => <hr className="border-border/50 my-4" />,
                            }}
                        >
                            {mainContent}
                        </ReactMarkdown>
                    </div>

                    {/* Sections adicionales si existen */}
                    {response.sections?.map((section, idx) =>
                        section.type === 'code' && section.content ? (
                            <div key={idx} className="mt-4">
                                <div className={cn("text-sm font-medium mb-2", config.accentColor)}>
                                    💻 {section.title || 'Código'}
                                </div>
                                <pre className="bg-black/40 p-4 rounded-lg overflow-x-auto border border-border/50">
                                    <code className="text-green-400 text-sm font-mono">{section.content}</code>
                                </pre>
                            </div>
                        ) : null
                    )}
                </div>
            )}

            {/* ====== FOOTER ====== */}
            <div
                className={cn(
                    "flex items-center justify-between px-4 py-2",
                    "border-t border-white/5",
                    "bg-black/20"
                )}
            >
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>
                        {new Date(response.timestamp).toLocaleTimeString('es-ES', {
                            hour: '2-digit',
                            minute: '2-digit',
                        })}
                    </span>
                    <span className="opacity-50">•</span>
                    <span className="font-mono">@{response.agent_id}</span>
                </div>

                <div className="flex items-center gap-2">
                    {saved && (
                        <Badge variant="outline" className="text-xs text-green-400 border-green-400/40">
                            ✓ Guardado
                        </Badge>
                    )}
                </div>
            </div>
        </div>
    );
}


export default SpecializedAgentResponse;
