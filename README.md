# Nexo - Equipos de agentes IA

Plataforma de IA multi-agente: elegís un equipo de especialistas (o dejás que el sistema lo arme), los agentes trabajan **en paralelo** sobre tu consulta con **streaming token a token** y un **Coordinador** integra sus aportes en una respuesta final accionable.

- **500 agentes** en **50 categorías**, definidos como datos (YAML), no como código.
- **100 tareas predefinidas** que combinan agentes de distintas categorías.
- **Trae tu propia API key**: Groq, OpenAI, Anthropic, Google, OpenRouter u Ollama/LM Studio local (todo vía API compatible con OpenAI).

---

## Funciones

| | |
|---|---|
| ⚡ Streaming real | Cada agente escribe en vivo; se puede **detener** a mitad de generación. |
| 🧭 Respuesta integrada | Un Coordinador sintetiza los aportes, resuelve contradicciones y arma un plan de acción (desactivable). |
| 🔀 Modos | **Paralelo** (todos a la vez) o **secuencial** (cada agente ve un resumen de los anteriores). |
| 🪄 Sugerir agentes | Describe la tarea y el sistema propone el equipo (prefiltro léxico + LLM). |
| 💬 Contexto | Las preguntas de seguimiento incluyen el historial reciente; con cuenta, también la memoria persistente. |
| ✍️ Instrucciones por agente | Tono, formato o restricciones propias para cada agente (botón ⓘ en la barra lateral). |
| 🔁 Regenerar / 📄 Exportar | Repite la última consulta o descarga la conversación en Markdown. |
| 📊 Uso | Tiempo y tokens consumidos por ejecución. |
| 👤 Cuentas (opcional) | Registro/login JWT, historial y memoria en PostgreSQL, sincronización del historial local. |

---

## Arquitectura

```
Navegador ──HTTP /api/*──▶ Next.js (proxy) ──▶ FastAPI ──▶ Proveedor LLM del usuario
    │                                             │
    └──────────── WebSocket /ws/{id} ────────────▶│──▶ PostgreSQL (cuentas, historial, memoria)
                  (SSE /api/chat-stream fallback) └──▶ Redis (rate limit, usuarios online) [opcional]
```

```
backend/
  app/
    agents/catalog/*.yaml     # 50 archivos: los 500 agentes (prompt, emoji, especialidad…)
    agents/catalog.py         # carga y valida el catálogo
    services/orchestrator.py  # ejecución paralela/secuencial + síntesis + eventos en vivo
    services/llm_client.py    # AsyncOpenAI cacheado, streaming, uso de tokens, errores claros
    services/agent_router.py  # sugerencia automática de agentes
    routes/                   # auth, historial, memoria, admin
    main.py                   # catálogo, WebSocket, SSE
    config.py                 # configuración centralizada (.env.nexo)
  tests/                      # pytest con LLM falso: no requiere DB, Redis ni API keys
frontend/
  src/app/page.tsx            # layout principal
  src/components/StreamingChatV2.tsx
  src/hooks/useAgentSocket.ts # WebSocket con reconexión exponencial
  src/lib/chat.ts             # historial, exportación, cliente SSE
```

### Agregar o editar un agente

Editá el YAML de su categoría en `backend/app/agents/catalog/`. Campos: `id`, `name`, `emoji`, `description`, `short_description`, `specialization`, `complexity`, `capabilities`, `backstory`, `system_prompt`. El backend valida ids duplicados y campos obligatorios al arrancar (y en los tests).

---

## Desarrollo local (sin Docker)

Requisitos: Python 3.12+, Node 20+. PostgreSQL y Redis son **opcionales**: sin ellos la app funciona como invitado (historial en el navegador) y el rate limiting queda en memoria.

```bash
# 1. Variables de entorno
cp .env.nexo.example .env.nexo        # y completar los secretos (ver comentario en el archivo)

# 2. Backend
cd backend
python -m venv venv
venv\Scripts\activate               # Windows  (Linux/macOS: source venv/bin/activate)
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8001

# 3. Frontend (otra terminal)
cd frontend
cp .env.local.example .env.local    # BACKEND_URL y NEXT_PUBLIC_WS_URL apuntando a :8001
npm install
npm run dev                          # http://localhost:3000
```

Luego, en la app: **Ajustes → APIs & Modelos**, agregá tu proveedor, pegá la API key y sincronizá modelos.

### Tests

```bash
cd backend && python -m pytest -q          # 44 tests, ~9 s
cd frontend && npx tsc --noEmit && npx next lint && npx next build
```

## Con Docker

```bash
docker compose -f docker-compose.yml --env-file .env.nexo up -d --build
# Frontend http://localhost:3002 · Backend http://localhost:8002/api/health
# Solo infraestructura:  ... up -d nexo-postgres nexo-redis
```

Los puertos se publican solo en `127.0.0.1`. Para exponer la app usá un proxy inverso con TLS que enrute `/` al frontend y `/ws` + `/api` al backend, y configurá `ENVIRONMENT=production`, `FRONTEND_URL` y `CORS_ORIGINS`.

---

## Seguridad

- Secretos solo en `.env.nexo` (ignorado por git). En producción el backend no arranca sin ellos.
- La API key del usuario viaja por mensaje y nunca se persiste en el servidor.
- WebSocket: verificación de `Origin`, token en el cuerpo del mensaje (no en la URL), límite de ejecuciones por conexión.
- Historial y memoria verifican que el recurso pertenezca al usuario del token.
- Protección SSRF en las URLs de proveedores (bloquea IPs privadas/metadata salvo `ALLOW_PRIVATE_LLM_URLS`).
- Contraseñas PBKDF2-SHA256 (600k iteraciones) con comparación en tiempo constante.

## Licencia

MIT — ver [LICENSE](LICENSE).
