# Setup su QNAP TS-453E

Guida completa per installare e configurare Gestione Condominio sul NAS QNAP TS-453E.

## Prerequisiti

- QNAP TS-453E con QTS installato
- Container Station installato sul NAS
- Accesso SSH al NAS (opzionale ma consigliato)
- Git installato sul NAS o accesso via browser

## Opzione 1: Setup via Container Station (UI) - CONSIGLIATO

### 1. Installa Container Station

1. Apri **App Center** sul NAS
2. Cerca **Container Station**
3. Clicca **Install**
4. Attendi il completamento

### 2. Clona il Repository

**Via SSH:**
```bash
# Connetti al NAS
ssh admin@192.168.1.X  # Sostituisci con IP del tuo NAS

# Naviga nella directory docker
cd /share/Container

# Clona il repository
git clone https://github.com/gianfrocca/Gestione_Condominio.git

# Entra nella directory
cd Gestione_Condominio
```

**Via File Station:**
1. Apri **File Station**
2. Naviga in `Container`
3. Scarica il repository come ZIP da GitHub
4. Estrai nella cartella `Container/Gestione_Condominio`

### 3. Avvia il Container

**Via Container Station UI:**

1. Apri **Container Station**
2. Vai su **Create** → **Create Application**
3. Seleziona **Docker Compose**
4. Incolla il seguente contenuto o seleziona il file `docker-compose.yml`:

```yaml
version: '3.8'

services:
  condominio:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: gestione-condominio
    restart: unless-stopped
    ports:
      - "5173:5173"
      - "3000:3000"
    volumes:
      - ./data:/app/data
    environment:
      - NODE_ENV=production
      - PORT=3000
```

5. Clicca **Validate**
6. Clicca **Create**
7. Attendi il completamento (5-10 minuti per il primo build)

**Via SSH:**
```bash
cd /share/Container/Gestione_Condominio
docker-compose up -d
```

### 4. Verifica Installazione

1. Apri browser e vai a: `http://192.168.1.X:5173` (IP del NAS)
2. Dovresti vedere la dashboard dell'applicazione

## Opzione 2: Setup via SSH

### 1. Installa Git (se non presente)

```bash
# Connetti al NAS
ssh admin@192.168.1.X

# Installa Entware (se non già installato)
# Segui: https://github.com/Entware/Entware/wiki/Install-on-QNAP-NAS

# Installa Git
opkg install git git-http
```

### 2. Clona e Avvia

```bash
cd /share/Container
git clone https://github.com/gianfrocca/Gestione_Condominio.git
cd Gestione_Condominio
docker-compose up -d
```

## Configurazione Avanzata

### Port Forwarding per Accesso Esterno

Vedi [FRITZBOX_PORTFORWARD.md](./FRITZBOX_PORTFORWARD.md)

### Backup Automatico

```bash
# Crea script backup
cat > /share/Container/backup-condominio.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/share/Backups/Condominio"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR
cp /share/Container/Gestione_Condominio/data/condominio.db \
   $BACKUP_DIR/condominio_$DATE.db

# Mantieni solo gli ultimi 30 backup
ls -t $BACKUP_DIR/condominio_*.db | tail -n +31 | xargs rm -f

echo "Backup completato: $BACKUP_DIR/condominio_$DATE.db"
EOF

chmod +x /share/Container/backup-condominio.sh
```

### Configura Backup Automatico (Cron)

1. Accedi a **Control Panel** → **System** → **Hardware & Power**
2. Abilita **Advanced Options**
3. Configura cron job:

```bash
# Backup giornaliero alle 2:00 AM
0 2 * * * /share/Container/backup-condominio.sh
```

## Aggiornamento Applicazione

### Via SSH

```bash
cd /share/Container/Gestione_Condominio
git pull origin main
docker-compose down
docker-compose up -d --build
```

### Via Container Station

1. Stop container
2. Aggiorna codice (git pull o download nuovo ZIP)
3. Rebuild immagine
4. Start container

## Troubleshooting

### Container non si avvia

```bash
# Controlla log
docker-compose logs -f

# Verifica permessi
chmod -R 755 /share/Container/Gestione_Condominio
```

### Porta già in uso

```bash
# Cambia porta in docker-compose.yml
ports:
  - "8080:5173"  # Usa 8080 invece di 5173
  - "3001:3000"  # Usa 3001 invece di 3000
```

### Database corrotto

```bash
# Ripristina da backup
cp /share/Backups/Condominio/condominio_YYYYMMDD_HHMMSS.db \
   /share/Container/Gestione_Condominio/data/condominio.db

# Riavvia container
docker-compose restart
```

## Monitoraggio

### Verifica Stato Container

```bash
docker ps | grep condominio
```

### Visualizza Log

```bash
docker-compose logs -f
```

### Risorse Utilizzate

1. Apri **Resource Monitor** nel NAS
2. Vai su **Docker**
3. Controlla CPU e RAM del container

## Contatti e Supporto

Per problemi o domande, apri una issue su GitHub:
https://github.com/gianfrocca/Gestione_Condominio/issues
