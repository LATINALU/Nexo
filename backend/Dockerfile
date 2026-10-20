# ==============================================================================
# Nexo Backend
#   docker build -t nexo-backend .                      -> producción
#   docker build --target development -t nexo-dev .     -> hot-reload + tests
# ==============================================================================
FROM python:3.12-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONPATH=/app \
    HOST=0.0.0.0 \
    PORT=8001

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 1000 nexo && useradd --uid 1000 --gid nexo --create-home nexo

COPY requirements.txt .
RUN pip install -r requirements.txt

# ------------------------------------------------------------------------------
FROM base AS development
COPY requirements-dev.txt .
RUN pip install -r requirements-dev.txt
COPY --chown=nexo:nexo . .
USER nexo
EXPOSE 8001
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001", "--reload"]

# ------------------------------------------------------------------------------
# Producción (etapa final = target por defecto)
FROM base AS production
COPY --chown=nexo:nexo app ./app
USER nexo
EXPOSE 8001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://localhost:8001/api/health || exit 1
# Un solo worker: las conexiones WebSocket y los límites por conexión viven en memoria del proceso
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001", \
     "--workers", "1", "--proxy-headers", "--forwarded-allow-ips", "*"]
