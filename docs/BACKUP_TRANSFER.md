# Backup e Trasferimento Dati

Guida completa per il backup e trasferimento dell'applicazione su altro NAS o server.

## Struttura Dati

Tutti i dati dell'applicazione sono contenuti in:
```
Gestione_Condominio/
└── data/
    ├── condominio.db          ← Database SQLite (TUTTO è qui)
    ├── bills/                 ← PDF bollette caricate
    │   └── *.pdf
    └── reports/               ← PDF report generati
        └── *.pdf
```

## Backup Manuale

### Backup Completo (Consigliato)

```bash
# Via SSH su NAS
cd /share/Container
tar -czf condominio-backup-$(date +%Y%m%d).tar.gz \
    Gestione_Condominio/data/

# Scarica il file .tar.gz sul tuo PC
```

### Backup Solo Database

```bash
# Il database contiene TUTTI i dati (letture, bollette, calcoli)
cp /share/Container/Gestione_Condominio/data/condominio.db \
   ~/condominio-backup-$(date +%Y%m%d).db
```

### Via File Station (UI)

1. Apri **File Station**
2. Naviga in `Container/Gestione_Condominio/data`
3. Seleziona `condominio.db` e cartelle `bills`, `reports`
4. Clicca **Download**
5. Salva in locale (PC, cloud, ecc.)

## Backup Automatico

### Script Backup Giornaliero

Crea script su NAS:

```bash
# File: /share/Container/backup-condominio.sh

#!/bin/bash

# Configurazione
SOURCE_DIR="/share/Container/Gestione_Condominio/data"
BACKUP_DIR="/share/Backups/Condominio"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Crea directory backup se non esiste
mkdir -p "$BACKUP_DIR"

# Backup database
echo "Backup database..."
cp "$SOURCE_DIR/condominio.db" "$BACKUP_DIR/condominio_$DATE.db"

# Backup completo (ogni domenica)
if [ $(date +%u) -eq 7 ]; then
    echo "Backup completo settimanale..."
    tar -czf "$BACKUP_DIR/full_backup_$DATE.tar.gz" \
        -C /share/Container Gestione_Condominio/data
fi

# Pulizia backup vecchi
echo "Pulizia backup vecchi..."
find "$BACKUP_DIR" -name "condominio_*.db" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -name "full_backup_*.tar.gz" -mtime +90 -delete

echo "Backup completato: $DATE"
```

Rendi eseguibile:
```bash
chmod +x /share/Container/backup-condominio.sh
```

### Configura Cron Job

**Via Control Panel:**
1. **Control Panel** → **System** → **Hardware & Power**
2. Tab: **General**
3. Abilita **Advanced Options**
4. Clicca su **Edit crontab**

Aggiungi:
```cron
# Backup giornaliero alle 2:00 AM
0 2 * * * /share/Container/backup-condominio.sh >> /var/log/backup-condominio.log 2>&1
```

**Via SSH:**
```bash
crontab -e
```
Aggiungi la stessa riga.

## Backup su Cloud

### Google Drive (via rclone)

1. Installa **rclone** su NAS
2. Configura Google Drive:
```bash
rclone config
```

3. Script backup cloud:
```bash
#!/bin/bash
# Backup su Google Drive

BACKUP_FILE="/share/Backups/Condominio/condominio_$(date +%Y%m%d).db"
GDRIVE_PATH="remote:Backups/Condominio/"

# Crea backup locale
/share/Container/backup-condominio.sh

# Upload su Google Drive
rclone copy "$BACKUP_FILE" "$GDRIVE_PATH"

echo "Backup caricato su Google Drive"
```

## Ripristino da Backup

### Ripristino Database

```bash
# Stop container
docker-compose down

# Ripristina database
cp ~/condominio-backup-20250115.db \
   /share/Container/Gestione_Condominio/data/condominio.db

# Restart container
docker-compose up -d
```

### Ripristino Completo

```bash
# Stop container
docker-compose down

# Estrai backup
cd /share/Container
tar -xzf condominio-backup-20250115.tar.gz

# Restart container
cd Gestione_Condominio
docker-compose up -d
```

## Trasferimento su Nuovo NAS

### Scenario: Migrazione NAS → NAS

**Sul vecchio NAS:**
```bash
# 1. Crea backup completo
cd /share/Container
tar -czf condominio-full-backup.tar.gz Gestione_Condominio/

# 2. Scarica il file sul tuo PC
```

**Sul nuovo NAS:**
```bash
# 1. Carica il file backup sul nuovo NAS
# 2. Estrai
cd /share/Container
tar -xzf condominio-full-backup.tar.gz

# 3. Avvia container
cd Gestione_Condominio
docker-compose up -d

# 4. Configura port forwarding (se necessario)
# Vedi: FRITZBOX_PORTFORWARD.md
```

### Scenario: NAS → VPS Cloud

**Esporta dati:**
```bash
# Sul NAS
cd /share/Container/Gestione_Condominio
tar -czf ~/condominio-export.tar.gz data/
```

**Importa su VPS:**
```bash
# Sul VPS (es: Ubuntu/Debian)
# 1. Installa Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# 2. Clona repository
git clone https://github.com/gianfrocca/Gestione_Condominio.git
cd Gestione_Condominio

# 3. Carica ed estrai backup
scp user@nas-ip:~/condominio-export.tar.gz .
tar -xzf condominio-export.tar.gz

# 4. Avvia container
docker-compose up -d

# 5. Accedi via IP VPS
http://VPS_IP:5173
```

## Esportazione Dati (per altre applicazioni)

### Esporta Database in CSV

```bash
# Connetti al container
docker exec -it gestione-condominio sh

# Esporta tabella in CSV
sqlite3 /app/data/condominio.db << 'EOF'
.headers on
.mode csv
.output /app/data/units.csv
SELECT * FROM units;
.output /app/data/readings.csv
SELECT * FROM readings;
.output /app/data/bills.csv
SELECT * FROM bills;
.quit
EOF
```

I file CSV saranno in `data/`:
- `units.csv` - Unità
- `readings.csv` - Letture
- `bills.csv` - Bollette

### Esporta Database in SQL

```bash
sqlite3 /app/data/condominio.db .dump > condominio-export.sql
```

## Verifica Integrità Backup

```bash
# Verifica database non corrotto
sqlite3 /path/to/backup.db "PRAGMA integrity_check;"

# Output atteso: "ok"
```

## Disaster Recovery

### Piano di Emergenza

1. **Backup Regolari**: Giornalieri automatici
2. **Backup Offsite**: Settimanali su cloud
3. **Test Ripristino**: Mensile su ambiente di test

### Procedura Ripristino Completo

1. Nuovo NAS/Server
2. Installa Docker
3. Clona repository
4. Ripristina backup più recente
5. Verifica integrità database
6. Avvia container
7. Test accesso e funzionalità

## Checklist Backup Mensile

- [ ] Verifica backup automatici funzionanti
- [ ] Test ripristino su ambiente di test
- [ ] Controlla spazio disco backup
- [ ] Verifica backup cloud (se configurato)
- [ ] Documenta modifiche configurazione

## Supporto

Per problemi con backup/ripristino:
- GitHub Issues: https://github.com/gianfrocca/Gestione_Condominio/issues
- Documentazione SQLite: https://www.sqlite.org/backup.html
