# Usa Node.js completo (Debian-based per migliore compatibilità)
FROM node:18-bullseye

# Installa dipendenze di sistema PRIMA di tutto
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    sqlite3 \
    libsqlite3-dev \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copia package files per cache layer (esplicitamente)
COPY backend/package.json backend/package-lock.json ./backend/
COPY frontend/package.json frontend/package-lock.json ./frontend/

# Installa dipendenze backend con rebuild forzato per native modules
WORKDIR /app/backend
RUN npm ci --production --prefer-offline --no-audit || \
    (npm cache clean --force && npm install --production)

# Installa dipendenze frontend
WORKDIR /app/frontend
RUN npm ci --prefer-offline --no-audit || \
    (npm cache clean --force && npm install)

# Copia tutto il codice sorgente
WORKDIR /app
COPY backend ./backend
COPY frontend ./frontend

# Build frontend
WORKDIR /app/frontend
RUN npm run build

# Torna alla root
WORKDIR /app

# Crea directory per dati
RUN mkdir -p /app/data/bills /app/data/reports

# Esponi porta
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Avvia il server
CMD ["node", "/app/backend/server.js"]
