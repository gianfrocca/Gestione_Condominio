# Build stage
FROM node:18 AS builder

WORKDIR /app

COPY . .

# Installa tutte le dipendenze (incluse devDependencies per build)
WORKDIR /app/backend
RUN npm install

WORKDIR /app/frontend
RUN npm install && npm run build

# Runtime stage
FROM node:18-slim

WORKDIR /app

# Copia i file compilati dal builder
COPY --from=builder /app/backend ./backend
COPY --from=builder /app/frontend/dist ./frontend/dist
COPY --from=builder /app/package.json ./package.json

# Rimuovi i devDependencies dai node_modules già copiati
WORKDIR /app/backend
RUN npm prune --omit=dev

WORKDIR /app

EXPOSE 3000

CMD ["node", "backend/server.js"]
