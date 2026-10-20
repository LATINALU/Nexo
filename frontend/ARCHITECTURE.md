# Frontend de Nexo — arquitectura

```
src/
├── core/                 Dominio puro, sin React
│   ├── protocol.ts       Eventos del orquestador como unión discriminada + parseServerEvent
│   └── runReducer.ts     reduceRun(state, event) -> { state, effects }
├── intelligence/         Ayuda a la persona, funciones puras y explicables
│   ├── queryCoach.ts     Analiza la consulta mientras se escribe y sugiere acciones
│   ├── estimator.ts      Llamadas/tokens/costo antes de enviar (se calibra con el historial)
│   └── teamInsights.ts   Tamaño, diversidad y redundancia del equipo
├── stores/               Estado compartido (Zustand)
│   ├── settings.ts       Preferencias persistentes (opciones, instrucciones, favoritos, documentos)
│   ├── workspace.ts      Proveedores/modelo, agentes seleccionados, catálogo, buscador web
│   └── StoreHydrator.tsx Rehidrata en el cliente (evita errores de hidratación SSR)
├── features/
│   ├── chat/
│   │   ├── useChatSession.ts   Toda la lógica de la sesión (árbol, red, persistencia, acciones)
│   │   ├── commands.ts         Bus de comandos (paleta Ctrl+K, atajos)
│   │   ├── Chat.tsx            Contenedor: compone sesión + componentes
│   │   └── components/         TurnView, AnswerCard, LiveRun, Composer, CoachBar, EstimateBadge…
│   └── shell/AppHeader.tsx
├── lib/                  Modelos y clientes: árbol de turnos (chat.ts), API, documentos, costos…
├── hooks/                useAgentSocket (WS con backoff), useDebounced
└── components/           Componentes de pantalla (ajustes, barra lateral, paleta, compartir…)
```

## Flujo de una consulta

```
Composer ──onSend──▶ useChatSession.runQuery
                       ├─ crea el Turn (árbol) y arma el payload desde los stores
                       └─ WebSocket (o SSE) ──eventos──▶ parseServerEvent ──▶ reduceRun
                                                                   │
                         RunState (en vivo) ◀──────────────────────┤
                         effects → turno: answer · sources · followups · complete · notice
```

- **El protocolo es tipado de punta a punta.** Si el backend agrega un evento, se suma a `ServerEvent` y TypeScript
  obliga a contemplarlo. `parseServerEvent` descarta eventos desconocidos o malformados.
- **`reduceRun` es puro.** Todo el comportamiento del streaming (tokens, herramientas, revisión, síntesis,
  cancelación, errores) se prueba sin React ni red (`core/runReducer.test.ts`).
- **Separación estado efímero / persistente.** El texto que se escribe en vivo vive en `RunState`; lo que queda
  (respuestas, fuentes, estadísticas) se aplica al árbol de turnos como *efectos* y se persiste al terminar.
- **Render eficiente.** El input vive en `Composer`: escribir no re-renderiza la conversación. `TurnView` está
  memoizado y los turnos pasados no se re-renderizan mientras otro hace streaming.

## Reglas para extender

1. Lógica nueva sin UI → `core/` o `intelligence/`, con test al lado (`*.test.ts`, Vitest).
2. Estado que comparten varios componentes → un store; nunca `localStorage` suelto ni eventos de `window`.
   (Excepción deliberada: la key del buscador web sigue la política "guardar APIs" de `lib/webSearch.ts`.)
3. Componentes de `features/*/components` reciben datos y callbacks; no hablan con la red.
4. Nuevo evento del servidor: tipo en `protocol.ts` → caso en `reduceRun` → test.

## Tests

```bash
npm test            # Vitest: protocolo, reducer, coach, estimador, equipo, stores, árbol, costos
npx tsc --noEmit
npx next build
```
