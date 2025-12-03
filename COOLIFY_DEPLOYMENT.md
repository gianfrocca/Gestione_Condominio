# 🚀 Deployment su Coolify con PostgreSQL

Guida completa per deployare **Gestione Condominio** su VPS con Coolify e database PostgreSQL esterno.

---

## 📋 Prerequisiti

- ✅ VPS con Coolify installato
- ✅ Accesso a Coolify Dashboard
- ✅ Dominio (opzionale, per produzione)
- ✅ Repository GitHub pubblico o privato
- ✅ Token GitHub (se repo privato)

---

## 🎯 Step-by-Step Deployment

### STEP 1: Crea il Database PostgreSQL su Coolify

1. **Accedi a Coolify Dashboard**
   - Apri `https://tuo-vps.com:3000` (o dove è Coolify)

2. **Crea nuovo Service → Database**
   - Clicca su **"New Service"** → **"Database"** → **"PostgreSQL"**
   - Nome: `condominio-db`
   - Version: `15` (o latest)
   - Clicca **"Save & Deploy"**

3. **Attendi il completamento**
   - Ci vorranno 1-2 minuti
   - Vedrai uno stato verde quando sarà pronto

4. **Copia le credenziali database**
   - Nella pagina del service, vedrai:
     - **Database Name**: `condominio_db`
     - **Username**: `condominio_user`
     - **Password**: (generata automaticamente)
     - **Host**: `condominio-db` (nome interno Coolify)
     - **Port**: `5432`
   - Salva questi valori in un file sicuro

---

### STEP 2: Crea il Progetto Applicativo su Coolify

1. **Crea nuovo Service → Application**
   - Clicca **"New Service"** → **"Application"**
   - Nome: `condominio-app`

2. **Configura Source**
   - **Source Type**: GitHub
   - **Repository**: `https://github.com/TUO_USERNAME/Gestione_Condominio`
   - **Branch**: `main` (o il tuo branch di default)
   - Se repo privato: aggiungi token GitHub
   - Clicca **"Continue"**

3. **Configura Build**
   - **Dockerfile**: seleziona il `Dockerfile` dalla repo
   - **Docker Registry**: `Docker Hub` (default)
   - Clicca **"Continue"**

4. **Configura Deploy**
   - **Ports**:
     - Container Port: `3000`
     - Exposed Port: `80` (o `443` per HTTPS)
   - **Auto Deploy**: ✅ Attiva (per deploy automatico su push)
   - Clicca **"Save"**

---

### STEP 3: Configura Variabili d'Ambiente

1. **Nel Service `condominio-app` → Environment**
   - Aggiungi le seguenti variabili:

   ```env
   NODE_ENV=production
   PORT=3000

   # Database PostgreSQL
   DB_HOST=condominio-db
   DB_PORT=5432
   DB_NAME=condominio_db
   DB_USER=condominio_user
   DB_PASSWORD=<PASSWORD_DA_STEP_1>
   DB_SSL=true

   # JWT (genera con: openssl rand -base64 32)
   JWT_SECRET=<GENERA_STRINGA_CASUALE_LUNGA>

   # Email (opzionale)
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   ```

2. **Salva e Deploy**
   - Clicca **"Save"** e poi **"Deploy"**

---

### STEP 4: Attendi il Build

- Il build Docker inizierà automaticamente
- Vedrai i log di build in tempo reale
- Attendi finché non vedi: `✅ Server in ascolto su porta 3000`

---

### STEP 5: Configura SSL/HTTPS (Opzionale ma Consigliato)

1. **Nel Service `condominio-app` → Domains**
   - Clicca **"Add Domain"**
   - Inserisci il tuo dominio: `condominio.tuodominio.com`
   - **SSL**: ✅ Attiva (Let's Encrypt gratuito)
   - Clicca **"Save"**

2. **DNS Configuration**
   - Nel tuo provider DNS (GoDaddy, Cloudflare, etc.)
   - Crea un record `A`:
     - Nome: `condominio`
     - Tipo: `A`
     - Valore: `IP_DEL_TUO_VPS`

3. **Attendi propagazione DNS** (5-15 min)
   - Poi accedi a `https://condominio.tuodominio.com`

---

### STEP 6: Accedi all'Applicazione

1. **URL**:
   - Dev: `http://IP_VPS:PORT`
   - Produzione: `https://condominio.tuodominio.com`

2. **Login di Default**
   - **Username**: `superadmin`
   - **Password**: `admin123`
   - ⚠️ **CAMBIA SUBITO** al primo login!

---

## 🔄 Migrazione Dati da SQLite (Se Necessario)

Se hai un database SQLite locale e vuoi migrare i dati:

### Opzione A: Locale (Prima del Deploy)

```bash
# 1. Installa dipendenze aggiuntive
npm install better-sqlite3

# 2. Configura .env con credenziali PostgreSQL Coolify
# 3. Esegui migrazione
node backend/scripts/migrate-sqlite-to-postgres.js

# 4. Verifica i dati
# 5. Fai push su GitHub
# 6. Deploy su Coolify (vedi Step 2)
```

### Opzione B: Via PostgreSQL direttamente su Coolify

```bash
# 1. Scarica il backup del database SQLite locale
# 2. Crea un dump SQL da SQLite
sqlite3 data/condominio.db ".dump" > dump.sql

# 3. Accedi via SSH a Coolify e importa
psql -h condominio-db -U condominio_user -d condominio_db < dump.sql
```

---

## 🛡️ Configurazione Sicurezza

### Credenziali Forti

- **JWT_SECRET**: Genera con `openssl rand -base64 32`
- **DB_PASSWORD**: Minimo 16 caratteri, maiuscole/minuscole/numeri/simboli
- **Nomina gli admin**: Cambia password superadmin al primo login

### Backup Automatico PostgreSQL

1. **Nel Service Database → Backup**
   - ✅ Attiva backup automatico
   - Frequenza: Giornaliero
   - Retention: 30 giorni

2. **Scarica backup manualmente**
   - Vai su Database Service → Backups
   - Scarica il file .sql per archiviazione offline

### HTTPS Obbligatorio

- Usa Let's Encrypt (gratuito in Coolify)
- Redireziona HTTP → HTTPS
- Configura CORS per il tuo dominio

---

## 📊 Monitoraggio

### Logs Applicazione

1. Nel Service `condominio-app` → Logs
2. Vedi log in tempo reale
3. Utile per debug problemi

### Resource Usage

1. Nel Dashboard Coolify → Stats
2. Monitora CPU, RAM, Disk
3. Se alto, scala il VPS

---

## 🐛 Troubleshooting

### Errore: "Cannot connect to database"

**Causa**: Le variabili di ambiente non sono configurate correttamente.

**Soluzione**:
1. Verifica che il service Database sia in stato **GREEN**
2. Copia esattamente le credenziali dal step 1
3. Usa `DB_HOST=condominio-db` (non l'IP)
4. Redeploy l'applicazione

### Errore: "Database already exists"

**Causa**: Il database esiste già con un schema diverso.

**Soluzione**:
1. Nel Database Service: **Wipe Database** (cancellerà tutto!)
2. Oppure crea un nuovo database con nome diverso

### Errore: "JWT_SECRET not set"

**Causa**: Variabile d'ambiente non configurata.

**Soluzione**:
1. Genera secret: `openssl rand -base64 32`
2. Aggiungilo nelle env vars
3. Redeploy

### L'app non mostra il frontend

**Causa**: Il build non è completato o il frontend non è buildato.

**Soluzione**:
1. Vai a Logs e controlla errori di build
2. Verifica che ci sia `frontend/dist/index.html`
3. Riavvia il build (force deploy)

---

## 📈 Scaling & Performance

### Aumentare Risorse

1. Se l'app è lenta:
   - Nel Service → Resources
   - Aumenta CPU e RAM
   - Clicca **"Update"**

2. Oppure scala il VPS:
   - Presso il provider VPS
   - Upgrade RAM/CPU
   - Riavvia il VPS

### Load Balancing (Advanced)

Se hai più di 100 utenti simultanei:
- Usa Coolify **Load Balancer**
- Deploya più istanze dell'app
- Coolify distribuisce il traffico

---

## 🔑 Variabili di Ambiente Completo Spiegazione

| Variabile | Valore | Note |
|-----------|--------|-------|
| `NODE_ENV` | `production` | Modalità produzione |
| `PORT` | `3000` | Porta interna (Coolify lo expose) |
| `DB_HOST` | `condominio-db` | Nome service database Coolify |
| `DB_PORT` | `5432` | Porta PostgreSQL standard |
| `DB_NAME` | `condominio_db` | Nome database |
| `DB_USER` | `condominio_user` | Utente database |
| `DB_PASSWORD` | `<PASSWORD>` | Password database |
| `DB_SSL` | `true` | Connessione SSL |
| `JWT_SECRET` | `<CASUALE_32_CHARS>` | Per token autenticazione |
| `SMTP_HOST` | `smtp.gmail.com` | Per notifiche email |
| `SMTP_PORT` | `587` | Porta SMTP |
| `SMTP_USER` | `email@gmail.com` | Account email |
| `SMTP_PASS` | `password` | App password (non password account) |

---

## 🎯 Checklist Deploy Finale

- [ ] Database PostgreSQL creato e connesso
- [ ] Variabili d'ambiente tutte impostate
- [ ] Build Docker completato
- [ ] Frontend accessibile
- [ ] Login admin funzionante
- [ ] Dati migrati (se da SQLite)
- [ ] SSL configurato (se prod)
- [ ] Backup automatico abilitato
- [ ] JWT_SECRET è casuale e sicuro
- [ ] Admin password cambiata

---

## 📞 Support

Se hai problemi:
1. Leggi i log in Coolify (molto dettagliati!)
2. Controlla le variabili d'ambiente
3. Verifica connessione database
4. Riavvia il service

Buon deployment! 🚀
