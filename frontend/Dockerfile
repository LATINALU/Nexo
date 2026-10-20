# ==============================================================================
# Nexo Frontend - Multi-stage Dockerfile v0.9.0
# ==============================================================================
# Optimizado para:
# - Imágenes pequeñas (~100MB)
# - Next.js standalone output
# - Caché eficiente de dependencias
# - Seguridad (usuario non-root)
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Dependencies - Instala dependencias npm
# ------------------------------------------------------------------------------
FROM node:20-alpine AS deps

# libc6-compat necesario para algunas dependencias
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copiar archivos de dependencias
COPY package.json package-lock.json ./

# Instalar dependencias (con cache de npm)
RUN npm ci --prefer-offline

# Instalar dependencias de desarrollo necesarias para build
RUN npm install -D tailwindcss autoprefixer postcss

# ------------------------------------------------------------------------------
# Stage 2: Builder - Compila la aplicación
# ------------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar dependencias desde stage anterior
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Argumentos de build para configuración
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ARG NEXT_PUBLIC_APP_VERSION=0.9.0

# Variables de entorno para build
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL}
ENV NEXT_PUBLIC_APP_VERSION=${NEXT_PUBLIC_APP_VERSION}
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build de producción
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 3: Runner - Imagen final de producción
# ------------------------------------------------------------------------------
FROM node:20-alpine AS runner

LABEL maintainer="Nexo Team <team@nexo.dev>"
LABEL version="0.9.0"
LABEL description="Nexo Frontend - Next.js Application"

WORKDIR /app

# Instalar dumb-init para manejo correcto de señales
RUN apk add --no-cache dumb-init curl

# Variables de entorno de producción
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Crear usuario non-root
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copiar archivos públicos
COPY --from=builder /app/public ./public

# Crear directorio .next con permisos correctos
RUN mkdir .next && chown nextjs:nodejs .next

# Copiar standalone output de Next.js
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Cambiar a usuario non-root
USER nextjs

# Puerto de la aplicación
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || wget -q --spider http://localhost:3000 || exit 1

# Usar dumb-init como init system
ENTRYPOINT ["dumb-init", "--"]

# Comando para ejecutar Next.js standalone
CMD ["node", "server.js"]

# ------------------------------------------------------------------------------
# Stage 4: Development - Para desarrollo local
# ------------------------------------------------------------------------------
FROM node:20-alpine AS development

WORKDIR /app

# Instalar herramientas de desarrollo
RUN apk add --no-cache git curl

# Copiar archivos de dependencias
COPY package.json package-lock.json ./

# Instalar todas las dependencias (incluyendo devDependencies)
RUN npm install

# Copiar código fuente
COPY . .

# Variables de entorno de desarrollo
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

EXPOSE 3000

# Comando para desarrollo con hot-reload
CMD ["npm", "run", "dev"]
