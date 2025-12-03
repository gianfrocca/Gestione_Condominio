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
FROM node:18

WORKDIR /app

# Copia solo i file necessari dal builder
COPY --from=builder /app/backend ./backend
COPY --from=builder /app/frontend/dist ./frontend/dist
COPY --from=builder /app/package.json ./package.json

# Installa solo le production dependencies nel runtime
WORKDIR /app/backend
RUN npm install --omit=dev

WORKDIR /app

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

CMD ["node", "backend/server.js"]
