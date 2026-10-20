"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getWebSocketUrl } from "@/lib/api";

export type SocketStatus = "connecting" | "open" | "closed";

export interface AgentSocketEvent {
  type: string;
  [key: string]: any;
}

const MAX_BACKOFF_MS = 30_000;
const PING_INTERVAL_MS = 25_000;

function newClientId(): string {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  return `client_${random}`;
}

/**
 * WebSocket con el backend de agentes.
 * - Reconexión con backoff exponencial + jitter; se detiene al desmontar.
 * - El token de sesión NUNCA va en la URL: se adjunta a cada mensaje.
 * - `onEvent` se lee de una ref, así el handler siempre ve el estado actual.
 */
export function useAgentSocket(onEvent: (event: AgentSocketEvent) => void) {
  const [status, setStatus] = useState<SocketStatus>("connecting");
  const wsRef = useRef<WebSocket | null>(null);
  const handlerRef = useRef(onEvent);
  const attemptRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aliveRef = useRef(true);

  handlerRef.current = onEvent;

  const connect = useCallback(() => {
    if (!aliveRef.current) return;
    setStatus("connecting");
    let ws: WebSocket;
    try {
      ws = new WebSocket(getWebSocketUrl(newClientId()));
    } catch {
      setStatus("closed");
      return;
    }
    wsRef.current = ws;
    let ping: ReturnType<typeof setInterval> | null = null;

    ws.onopen = () => {
      attemptRef.current = 0;
      setStatus("open");
      ping = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send('{"action":"ping"}'), PING_INTERVAL_MS);
    };
    ws.onmessage = (message) => {
      try {
        const data = JSON.parse(message.data);
        if (data?.type && data.type !== "pong") handlerRef.current(data);
      } catch {
        /* mensaje no-JSON: ignorar */
      }
    };
    ws.onclose = () => {
      if (ping) clearInterval(ping);
      if (wsRef.current === ws) wsRef.current = null;
      setStatus("closed");
      if (!aliveRef.current) return;
      const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attemptRef.current) * (0.75 + Math.random() * 0.5);
      attemptRef.current += 1;
      timerRef.current = setTimeout(connect, delay);
    };
    ws.onerror = () => ws.close();
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    connect();
    return () => {
      aliveRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  /** Envía una acción. Devuelve false si el socket no está abierto. */
  const send = useCallback((payload: Record<string, unknown>): boolean => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    // Siempre se envía (vacío al cerrar sesión) para que el servidor des-autentique la conexión
    ws.send(JSON.stringify({ ...payload, token: localStorage.getItem("nexo_token") || "" }));
    return true;
  }, []);

  /** Reintenta ya mismo (sin esperar el backoff). */
  const reconnect = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    attemptRef.current = 0;
    if (!wsRef.current) connect();
  }, [connect]);

  return { status, send, reconnect };
}
