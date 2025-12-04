# Guida Build Automatico Frontend - Coolify

## 🎯 Come Funziona Adesso

Con il nuovo **Dockerfile multi-stage**, Coolify farà tutto automaticamente:

### 1. **Build Frontend**
   - Installa dipendenze React
   - Esegue `npm run build`
   - Genera cartella `frontend/dist` ottimizzata

### 2. **Build Backend**
   - Installa dipendenze Node.js
   - Copia il frontend buildato nella cartella giusta
   - Configura tutto per il deployment

### 3. **Avvio Applicazione**
   - Il backend serve sia l'API che il frontend statico
   - Frontend + Backend in un'unica immagine Docker

---

## 📋 Configurazione su Coolify

### Step 1: Connetti il Repository
```
1. Vai su Coolify Dashboard
2. Crea una nuova "Application"
3. Seleziona il repository GitHub
4. Seleziona il branch: claude/plan-vps-deployment-01PYe385JZGp832XcgUUeFh8
```

### Step 2: Configura Build
```
Build Type: Dockerfile
Dockerfile Location: ./Dockerfile
Build Context: . (root)
```

### Step 3: Configura Variabili Ambiente
```
STORAGE_TYPE=file
JWT_SECRET=<genera-una-stringa-casuale-di-32-caratteri>
NODE_ENV=production
```

### Step 4: Configura Port
```
Port: 3000
Exposed: Sì
```

### Step 5: Deploy
```
Clicca "Deploy" e Coolify farà tutto da solo!
```

---

## 🔍 Cosa Succede Durante il Build

### Build Phase (Automatico)
```
1. Stage 1 - Frontend Builder
   ✓ npm ci (installa dipendenze)
   ✓ npm run build (builda React)
   ✓ Output: frontend/dist/

2. Stage 2 - Backend & Runtime
   ✓ npm ci --omit=dev (solo produzione)
   ✓ Copia backend code
   ✓ Copia frontend buildato da stage 1
   ✓ Crea directory data/
   ✓ Espone porta 3000
```

### Runtime (Applicazione in Esecuzione)
```
✓ Backend Express server avvia
✓ Legge STORAGE_TYPE=file
✓ Crea database.json automaticamente
✓ Crea backup automatico
✓ Serve sia API che Frontend su http://localhost:3000
```

---

## ✅ Come Verificare su Coolify

### 1. Controlla i Log
```
Vai su: Logs della Application
Cerca: ✅ Storage layer inizializzato: file
        ✅ Backup programmati inizializzati
        ✅ Server in ascolto su porta 3000
```

### 2. Testa l'API
```
curl https://condominio.projectbook.it/api

Dovresti ricevere:
{
  "message": "API Gestione Condominio",
  "version": "2.0.0",
  "endpoints": {...}
}
```

### 3. Accedi all'Interfaccia
```
Vai su: https://condominio.projectbook.it/
Dovresti vedere il frontend React
Login: superadmin / admin123
```

---

## 🔑 Importante

### ⚠️ Genera JWT_SECRET Sicuro
```bash
# Su qualsiasi terminale:
openssl rand -base64 32

# Copia il risultato e impostalo su Coolify
# Esempio: X7hK9mL2pQ5vR8sT3uW6yZ9aB4cD7eF0gH1iJ2kL3mN4oP5
```

### 🗝️ Cambia Password Admin
```
1. Accedi con: superadmin / admin123
2. Vai a: Utenti o Impostazioni
3. Cambia la password subito!
```

---

## 🐳 Test Locale (Prima di Deploy)

Se vuoi testare localmente prima di spingere su Coolify:

```bash
# Build locale
docker-compose build

# Avvia
docker-compose up

# Accedi
http://localhost:3000

# Controlla i log
docker-compose logs -f app
```

---

## 🔄 Se Hai Bisogno di PostgreSQL Futura

Se in futuro vorrai PostgreSQL anzichè file storage:

```bash
# Avvia con PostgreSQL:
STORAGE_TYPE=postgresql \
DB_HOST=postgres \
DB_USER=condominio_user \
DB_PASSWORD=secure_pwd_123 \
docker-compose --profile postgres up

# Nel dockerfile-compose.yml il servizio postgres è opzionale (profile: postgres)
```

---

## 📦 Struttura Finale Deployment

```
Container Docker:
├── Node.js 22
├── Frontend React (builded in dist/)
├── Backend Express
├── Storage: /app/data/
│   ├── storage/database.json
│   ├── backups/
│   ├── bills/
│   └── reports/
└── API su porta 3000
```

---

## ✨ Vantaggi Questo Setup

✅ **Build Automatico** - Coolify compila il frontend automaticamente
✅ **Una sola immagine** - Frontend + Backend insieme
✅ **Zero configuration** - Funziona subito dopo il deployment
✅ **Scalabile** - Facile passare a PostgreSQL dopo
✅ **Storage flessibile** - File storage o database
✅ **Backup automatici** - Protezione dati giornaliera

---

Pronto! Coolify farà tutto il resto 🚀
