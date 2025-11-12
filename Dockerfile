# Multi-stage build per ottimizzare dimensione immagine

# Stage 1: Build frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# Stage 2: Build backend
FROM node:18-alpine AS backend-builder

WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm ci --production

COPY backend/ ./

# Stage 3: Runtime
FROM node:18-alpine

WORKDIR /app

# Installa dipendenze di sistema necessarie per SQLite e PDF
RUN apk add --no-cache \
    sqlite \
    cairo \
    pango \
    giflib \
    pixman \
    python3 \
    make \
    g++

# Copia backend compilato
COPY --from=backend-builder /app/backend ./backend

# Copia frontend buildato
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Crea directory per dati persistenti
RUN mkdir -p /app/data/bills /app/data/reports

# Esponi porte
EXPOSE 3000 5173

# Crea script di avvio
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'cd /app/backend && node server.js &' >> /app/start.sh && \
    echo 'cd /app/frontend && npx vite preview --host 0.0.0.0 --port 5173' >> /app/start.sh && \
    chmod +x /app/start.sh

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Volume per dati persistenti
VOLUME ["/app/data"]

# Avvia entrambi i servizi
CMD ["/app/start.sh"]
