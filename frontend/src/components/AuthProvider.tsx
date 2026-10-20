"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { ConversationStorage } from "@/lib/conversationStorage";

interface User {
    id: number;
    username: string;
    email: string;
    role: string;
    user_code: string;
}

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    login: (token: string, userData: User) => Promise<void>;
    logout: () => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        checkAuth();

        const handleLogoutEvent = () => logout();
        window.addEventListener("auth:logout", handleLogoutEvent);

        return () => {
            window.removeEventListener("auth:logout", handleLogoutEvent);
        };
    }, []);

    const checkAuth = async () => {
        try {
            const token = localStorage.getItem("nexo_token");
            if (!token) {
                setIsLoading(false);
                return;
            }

            // Verify token with backend
            const res = await fetch(`${API_URL}/api/auth/me`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (res.ok) {
                const userData = await res.json();
                setUser(userData);
            } else {
                // Token invalid/expired
                localStorage.removeItem("nexo_token");
                setUser(null);
            }
        } catch (error) {
            console.error("Auth check failed:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (token: string, userData: User) => {
        localStorage.setItem("nexo_token", token);
        setUser(userData);

        // Sync logic: Pull remote history
        await syncRemoteHistory(token);
    };

    const logout = () => {
        localStorage.removeItem("nexo_token");
        localStorage.removeItem("nexo_ws_token");
        setUser(null);
    };

    const syncRemoteHistory = async (token: string) => {
        // 1. Push local first (already done in AuthModal, but good to double check or delegate there)
        // 2. Pull remote
        try {
            const res = await fetch(`${API_URL}/api/history?limit=50`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.ok) {
                const remoteConversations = await res.json();
                // Merge strategy: Overwrite local or Merge?
                // Simple strategy: Save remote ones to local if not exist
                const local = ConversationStorage.getAllConversations();

                // Map remote format to local format
                const formattedRemote = await Promise.all(remoteConversations.map(async (rc: any) => {
                    // We might need to fetch full details for each conversation if the list summary is not enough
                    // But typically list endpoint returns summaries.
                    // Let's assume we need full details for storage.
                    const detailRes = await fetch(`${API_URL}/api/history/${rc.conversation_id}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    if (detailRes.ok) {
                        const detail = await detailRes.json();
                        return {
                            id: detail.conversation_id,
                            title: detail.title,
                            messages: (detail.messages || []).map((m: any) => ({
                                role: m.role === "assistant" && m.agent_id && m.agent_id !== "coordinator" ? "agent" : m.role,
                                content: m.content,
                                timestamp: m.created_at,
                                agent_id: m.agent_id,
                                metadata: { isSynthesis: m.agent_id === "coordinator" },
                            })),
                            createdAt: detail.created_at,
                            updatedAt: detail.updated_at,
                            model: detail.model,
                            agents: detail.agents
                        };
                    }
                    return null;
                }));

                const validRemote = formattedRemote.filter(c => c !== null);

                // Merge: Add remote ones that don't exist locally
                validRemote.forEach((rc: any) => {
                    if (!local.find(lc => lc.id === rc.id)) {
                        ConversationStorage.saveConversation(rc);
                    }
                });

                // Trigger storage event for UI update
                window.dispatchEvent(new Event("storage"));
            }
        } catch (e) {
            console.error("Sync pull failed:", e);
        }
    };

    return (
        <AuthContext.Provider value={{
            user,
            isLoading,
            login,
            logout,
            isAuthenticated: !!user
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
