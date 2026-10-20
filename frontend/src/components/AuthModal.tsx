"use client";

import { useState } from "react";
import { User, Lock, Mail, ChevronRight, Loader2, ArrowRight, ShieldCheck, Github } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { ConversationStorage } from "@/lib/conversationStorage";
import { treeToMessages } from "@/lib/chat";

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLoginSuccess: (user: any) => void;
}

export function AuthModal({ isOpen, onClose, onLoginSuccess }: AuthModalProps) {
    const [isLogin, setIsLogin] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [email, setEmail] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const auth = useAuth();

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
            const body = isLogin
                ? { username: email, password } // Backend expects 'username' field, can be email too
                : { email, username, password };

            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });

            const data = await res.json();

            if (!res.ok) {
                const detail = Array.isArray(data.detail) ? data.detail[0]?.msg : data.detail;
                throw new Error(detail || "Error de autenticación");
            }

            // Subir el historial local y activar la sesión en toda la app
            await syncHistory(data.access_token);
            await auth.login(data.access_token, data.user);

            onLoginSuccess(data.user);
            onClose();

        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const syncHistory = async (token: string) => {
        try {
            const localConversations = ConversationStorage.getAllConversations();
            if (localConversations.length === 0) return;

            await fetch("/api/history/sync", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                // Se sube el árbol completo (todas las ramas), no solo el camino visible
                body: JSON.stringify(localConversations.map((c) => ({ ...c, messages: c.tree ? treeToMessages(c.tree) : c.messages })))
            });

            console.log("Historial sincronizado correctamente");
        } catch (e) {
            console.error("Error sincronizando historial:", e);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />

            <div className="relative w-full max-w-md bg-card border border-primary/20 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Decorative header */}
                <div className="h-32 bg-gradient-to-br from-primary/20 via-background to-background relative overflow-hidden">
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                        <div className="h-16 w-16 bg-primary/20 rounded-2xl mx-auto flex items-center justify-center backdrop-blur-sm border border-primary/30 mb-2 shadow-xl shadow-primary/10">
                            <ShieldCheck className="h-8 w-8 text-primary" />
                        </div>
                        <h2 className="text-lg font-bold text-foreground">Nexo Secure Auth</h2>
                    </div>
                </div>

                <div className="p-6 pt-8">
                    {/* Tabs */}
                    <div className="flex p-1 bg-muted/50 rounded-xl mb-6 sticky top-0">
                        <button
                            onClick={() => setIsLogin(true)}
                            className={cn(
                                "flex-1 py-2 text-sm font-medium rounded-lg transition-all",
                                isLogin ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            Iniciar Sesión
                        </button>
                        <button
                            onClick={() => setIsLogin(false)}
                            className={cn(
                                "flex-1 py-2 text-sm font-medium rounded-lg transition-all",
                                !isLogin ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            Registrarse
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {!isLogin && (
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-muted-foreground ml-1">Usuario</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="w-full bg-muted/30 border border-input rounded-xl px-10 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                                        placeholder="Nombre de usuario"
                                        required={!isLogin}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-muted-foreground ml-1">
                                {isLogin ? "Usuario o Email" : "Email"}
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-muted/30 border border-input rounded-xl px-10 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                                    placeholder={isLogin ? "usuario@ejemplo.com" : "tu@email.com"}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-muted-foreground ml-1">Contraseña</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-muted/30 border border-input rounded-xl px-10 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                            {!isLogin && (
                                <p className="text-[10px] text-muted-foreground ml-1">
                                    Mínimo 8 caracteres, 1 mayúscula, 1 número.
                                </p>
                            )}
                        </div>

                        {error && (
                            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive flex items-center gap-2">
                                <span className="h-1.5 w-1.5 rounded-full bg-destructive flex-shrink-0" />
                                {error}
                            </div>
                        )}

                        <Button
                            type="submit"
                            className="w-full h-11 bg-primary text-primary-foreground font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <span className="flex items-center gap-2">
                                    {isLogin ? "Entrar al Sistema" : "Crear Cuenta"}
                                    <ArrowRight className="h-4 w-4" />
                                </span>
                            )}
                        </Button>
                    </form>

                </div>
            </div>
        </div>
    );
}
