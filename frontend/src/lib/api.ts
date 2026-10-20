"use client";


// ============================================================================
// TIPOS Nexo v2.0.0 - 500 Agentes en 50 Categorías
// ============================================================================

export interface Agent {
    id: string;
    name: string;
    category: string;
    description: string;
    emoji: string;
    capabilities: string[];
    specialization: string;
    complexity: string;
}

export interface Category {
    id: string;
    name: string;
    emoji: string;
    description: string;
    color: string;
    agents_count: number;
    agents?: Agent[];
}

export interface AgentsResponse {
    agents: Agent[];
    total: number;
}

export interface CategoriesResponse {
    categories: Category[];
    total: number;
}

/**
 * Fetch wrapper handling Authentication headers and 401 Expiration
 */
export const fetchWithAuth = async (endpoint: string, options: RequestInit = {}) => {
    const token = localStorage.getItem("nexo_token");

    const headers = {
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        ...options.headers,
    };

    // Usar rutas relativas - Next.js proxy manejará el reenvío al backend
    const response = await fetch(endpoint, {
        ...options,
        headers,
    });

    if (response.status === 401) {
        window.dispatchEvent(new Event("auth:logout"));
        throw new Error("Session expired");
    }

    return response;
};

// ============================================================================
// API FUNCTIONS - Nexo v0.5.0
// ============================================================================

/**
 * Get all 120 agents, optionally filtered by category
 */
export const getAgents = async (category?: string): Promise<AgentsResponse> => {
    const url = category ? `/api/agents?category=${category}` : "/api/agents";
    const response = await fetchWithAuth(url);
    return response.json();
};

/**
 * Get all 12 categories
 */
export const getCategories = async (): Promise<CategoriesResponse> => {
    const response = await fetchWithAuth("/api/categories");
    return response.json();
};

/**
 * Get a specific category with its agents
 */
export const getCategory = async (categoryId: string): Promise<Category> => {
    const response = await fetchWithAuth(`/api/categories/${categoryId}`);
    return response.json();
};

/**
 * Get a specific agent
 */
export const getAgent = async (agentId: string): Promise<Agent> => {
    const response = await fetchWithAuth(`/api/agents/${agentId}`);
    return response.json();
};

// ============================================================================
// HISTORIAL EN SERVIDOR (requiere sesión iniciada)
// ============================================================================

export interface ServerConversation {
    conversation_id: string;
    title: string;
    created_at: string;
    updated_at: string;
    message_count: number;
    model?: string | null;
    agents?: string[] | null;
    is_pinned: boolean;
    is_archived: boolean;
}

export interface ServerMessage {
    role: "user" | "assistant";
    content: string;
    agent_id?: string | null;
    model?: string | null;
    created_at: string;
}

export interface ServerConversationDetail extends ServerConversation {
    messages: ServerMessage[];
}

export const hasSession = () => typeof window !== "undefined" && !!localStorage.getItem("nexo_token");

export const listServerConversations = async (limit = 50, offset = 0): Promise<ServerConversation[]> => {
    const response = await fetchWithAuth(`/api/history?limit=${limit}&offset=${offset}`);
    return response.ok ? response.json() : [];
};

export const getServerConversation = async (conversationId: string): Promise<ServerConversationDetail | null> => {
    const response = await fetchWithAuth(`/api/history/${encodeURIComponent(conversationId)}`);
    return response.ok ? response.json() : null;
};

export const deleteServerConversation = async (conversationId: string): Promise<boolean> => {
    const response = await fetchWithAuth(`/api/history/${encodeURIComponent(conversationId)}`, { method: "DELETE" });
    return response.ok;
};

// ============================================================================
// SUGERENCIA DE AGENTES
// ============================================================================

export interface AgentSuggestion {
    agents: Agent[];
    reason: string;
}

export const suggestAgents = async (
    message: string,
    apiConfig?: { type: string; apiKey: string; baseUrl?: string } | null,
    model?: string,
    language = "es",
): Promise<AgentSuggestion> => {
    const response = await fetch("/api/agents/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, apiConfig: apiConfig?.apiKey || apiConfig?.type === "local" ? apiConfig : null, model, language }),
    });
    if (!response.ok) throw new Error("No se pudieron sugerir agentes");
    return response.json();
};

// ============================================================================
// WEBSOCKET
// ============================================================================

/** URL del WebSocket. NEXT_PUBLIC_WS_URL (ej. ws://localhost:8001/ws) o mismo host detrás de un proxy. */
export const getWebSocketUrl = (clientId: string): string => {
    const base = process.env.NEXT_PUBLIC_WS_URL;
    if (base) return `${base.replace(/\/$/, "")}/${clientId}`;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}/ws/${clientId}`;
};
