# Usa Node.js completo (più stabile di Alpine)
FROM node:18

WORKDIR /app

# Installa dipendenze di sistema per SQLite e PDF
RUN apt-get update && apt-get install -y \
    sqlite3 \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

# Copia tutto il progetto
COPY . .

# Installa dipendenze backend (con cache npm)
WORKDIR /app/backend
RUN npm ci --production --prefer-offline --no-audit

# Installa dipendenze frontend e builda
WORKDIR /app/frontend
RUN npm ci --prefer-offline --no-audit && npm run build

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
