# Dockerfile ultra-semplice per Railway
FROM node:18

WORKDIR /app

# Copia tutto
COPY . .

# Installa backend
WORKDIR /app/backend
RUN npm install --production

# Installa e builda frontend
WORKDIR /app/frontend
RUN npm install && npm run build

# Torna alla root
WORKDIR /app

# Esponi porta
EXPOSE 3000

# Avvia
CMD ["node", "backend/server.js"]
