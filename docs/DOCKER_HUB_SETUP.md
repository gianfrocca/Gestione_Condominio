# Setup Docker Hub - Immagine Pre-Compilata

Questa guida spiega come configurare la pubblicazione automatica su Docker Hub per avere un'immagine già pronta.

## 🎯 Vantaggi

**Senza Docker Hub:**
- ❌ Build sul NAS richiede 10-15 minuti
- ❌ Consuma molta RAM e CPU
- ❌ Può causare timeout

**Con Docker Hub:**
- ✅ Download immagine: 2-3 minuti
- ✅ Zero compilazione sul NAS
- ✅ Sempre funzionante

---

## 📝 Setup Docker Hub Account

### 1. Crea Account Docker Hub

1. Vai su https://hub.docker.com
2. **Sign Up** (gratuito)
3. Username: `gianfrocca` (o quello che preferisci)
4. Conferma email

### 2. Crea Access Token

1. Login su Docker Hub
2. **Account Settings** → **Security**
3. **New Access Token**
4. Description: `GitHub Actions`
5. Access: **Read, Write, Delete**
6. **Generate**
7. **COPIA IL TOKEN** (lo vedi solo una volta!)

---

## 🔧 Setup GitHub Secrets

### 1. Vai sul Tuo Repository GitHub

```
https://github.com/gianfrocca/Gestione_Condominio
```

### 2. Aggiungi Secrets

1. **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret**

**Aggiungi questi 2 secrets:**

**Secret 1:**
- Name: `DOCKERHUB_USERNAME`
- Value: `gianfrocca` (il tuo username Docker Hub)

**Secret 2:**
- Name: `DOCKERHUB_TOKEN`
- Value: `<il token che hai copiato prima>`

---

## 🚀 Trigger Build Automatico

Una volta configurato, **ogni push su GitHub** farà il build automatico!

### Test Manuale (Opzionale)

1. Vai su GitHub repo
2. **Actions** tab
3. **Build and Push Docker Image**
4. **Run workflow** → **Run workflow**
5. Attendi 10-15 minuti
6. L'immagine sarà su Docker Hub!

Puoi vedere il progresso su:
```
https://hub.docker.com/r/gianfrocca/gestione-condominio
```

---

## 🐳 Usa Immagine Pre-Compilata sul NAS

Ora che l'immagine è su Docker Hub, sul NAS è **FACILISSIMO**:

### Via SSH

```bash
# Connetti al NAS
ssh admin@IP_NAS

# Vai nella directory
cd /share/Container/Gestione_Condominio

# Usa il docker-compose semplificato
DOCKER_CMD=$(find /share -name "docker" -type f 2>/dev/null | grep container-station | head -1)

# Pull dell'immagine (2-3 minuti invece di 15!)
$DOCKER_CMD pull gianfrocca/gestione-condominio:latest

# Avvia con docker-compose prebuilt
$DOCKER_CMD compose -f docker-compose.prebuilt.yml up -d

# Fatto! Accedi a http://IP_NAS:3000
```

### Via Container Station UI

1. **Container Station** → **Create** → **Create Container**
2. **Image:** `gianfrocca/gestione-condominio:latest`
3. **Port:** `3000:3000`
4. **Volume:** `/share/Container/Gestione_Condominio/data` → `/app/data`
5. **Create**
6. Fatto in 2 minuti! ✅

---

## 🔄 Aggiornamenti Futuri

Quando modifichi il codice:

1. **Fai push su GitHub** (come sempre)
2. **GitHub Action** fa il build automatico
3. **Sul NAS**, aggiorna l'immagine:

```bash
# Pull nuova versione
$DOCKER_CMD pull gianfrocca/gestione-condominio:latest

# Riavvia container
$DOCKER_CMD compose -f docker-compose.prebuilt.yml down
$DOCKER_CMD compose -f docker-compose.prebuilt.yml up -d
```

---

## 📊 Confronto

| Metodo | Tempo Setup | RAM Richiesta | Successo |
|--------|-------------|---------------|----------|
| Build sul NAS | 15-20 min | 2+ GB | ⚠️ 50% |
| Immagine Pre-compilata | 2-3 min | 500 MB | ✅ 99% |

---

## 🎉 Risultato

Ora hai:
- ✅ Immagine Docker sempre aggiornata
- ✅ Deploy sul NAS in 2-3 minuti
- ✅ Zero problemi di compilazione
- ✅ Aggiornamenti automatici da GitHub

---

## 🐛 Troubleshooting

### Build fallisce su GitHub Actions

Controlla:
- Secrets configurati correttamente
- Token Docker Hub valido
- Username Docker Hub corretto

### Non riesco a fare pull sul NAS

```bash
# Login Docker Hub dal NAS
$DOCKER_CMD login
# Username: gianfrocca
# Password: <il tuo token>

# Poi riprova il pull
$DOCKER_CMD pull gianfrocca/gestione-condominio:latest
```

### Immagine troppo grande

L'immagine è ~1.5 GB, normale per Node.js + dependencies. Il download richiede 2-5 minuti a seconda della connessione.
