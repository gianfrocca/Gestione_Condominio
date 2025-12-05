# Stage 1: Build Frontend
FROM node:22-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package*.json ./

RUN npm ci

COPY frontend .

RUN npm run build

# Stage 2: Build Backend & Runtime
FROM node:22-alpine

# Installa curl per healthcheck e wget per compatibilità
RUN apk add --no-cache curl wget

WORKDIR /app

# Copia package.json del backend
COPY package*.json ./

# Installa dipendenze backend
RUN npm ci --omit=dev

# Copia il backend
COPY backend ./backend

# Copia il frontend buildato dallo stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Crea directory per i dati
RUN mkdir -p data/storage data/backups data/bills data/reports

# Espone porta
EXPOSE 3000

# Variabili di ambiente di default
ENV STORAGE_TYPE=file
ENV NODE_ENV=production

# Avvia il server
CMD ["npm", "start"]
