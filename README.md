# 🏢 Gestione Condominio

Sistema completo per la gestione e ripartizione delle spese condominiali con web app moderna.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Docker](https://img.shields.io/badge/docker-ready-brightgreen.svg)
![Node](https://img.shields.io/badge/node-18+-green.svg)

## 📋 Caratteristiche

- ✅ **Ripartizione Automatica**: Calcolo automatico spese gas ed energia elettrica
- 📊 **Dashboard Intuitiva**: Visualizzazione chiara di consumi e costi
- 📱 **Responsive**: Funziona su desktop, tablet e smartphone
- 🐳 **Docker Ready**: Deploy facile su NAS QNAP o qualsiasi server
- 💾 **Database SQLite**: Leggero, veloce, nessuna configurazione
- 📄 **Report PDF**: Generazione automatica report mensili e annuali
- 🔒 **Dati Locali**: Tutti i dati rimangono sul tuo server
- 🌐 **Accesso Remoto**: Configurabile per accesso da internet

## 🎯 Caso d'Uso

Perfetto per:
- Condomini con 4-10 unità
- Impianto riscaldamento/raffrescamento comune
- Contabilizzatori di calore individuali
- Ripartizione secondo normativa UNI 10200

**Ripartisce:**
- ⚡ Energia Elettrica (pompa di calore, pompa acqua, luci)
- 🔥 Metano (integrazione caldaia)
- 💧 Acqua Calda Sanitaria (ACS)
- 🚿 Acqua Fredda (ACF)

## 🚀 Quick Start

### Requisiti

- Docker e Docker Compose
- QNAP NAS TS-453E (o compatibile) oppure VPS/Server Linux
- Git

### Installazione su QNAP NAS

```bash
# 1. Connetti al NAS via SSH
ssh admin@192.168.X.X

# 2. Clona il repository
cd /share/Container
git clone https://github.com/gianfrocca/Gestione_Condominio.git
cd Gestione_Condominio

# 3. Avvia con Docker Compose
docker-compose up -d

# 4. Accedi via browser
# http://192.168.X.X:5173
```

### Installazione su Server Linux (Ubuntu/Debian)

```bash
# 1. Installa Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# 2. Clona e avvia
git clone https://github.com/gianfrocca/Gestione_Condominio.git
cd Gestione_Condominio
docker-compose up -d

# 3. Accedi
# http://localhost:5173
```

## 📖 Documentazione

- 📘 [**Setup NAS QNAP TS-453E**](docs/SETUP_NAS_TS453E.md) - Guida installazione completa
- 🌐 [**Port Forwarding Fritz!Box**](docs/FRITZBOX_PORTFORWARD.md) - Accesso da internet
- 💾 [**Backup e Trasferimento**](docs/BACKUP_TRANSFER.md) - Sicurezza dati
- 👤 [**Guida Utente**](docs/GUIDA_UTENTE.md) - Come usare l'applicazione

## 🏗️ Architettura

```
┌─────────────────────────────────────────┐
│           Frontend (React)              │
│        Vite + Tailwind CSS              │
│            Port: 5173                   │
└─────────────────┬───────────────────────┘
                  │ REST API
┌─────────────────▼───────────────────────┐
│        Backend (Node.js + Express)      │
│             Port: 3000                  │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│         Database (SQLite)               │
│        File: data/condominio.db         │
└─────────────────────────────────────────┘
```

### Tech Stack

**Backend:**
- Node.js 18+
- Express.js
- SQLite3
- PDFKit (generazione PDF)

**Frontend:**
- React 18
- Vite
- Tailwind CSS
- Axios
- Lucide Icons

**Deployment:**
- Docker & Docker Compose
- Container ottimizzato per NAS QNAP

## 💡 Funzionalità Principali

### 1. Gestione Letture
- Inserimento letture mensili contabilizzatori
- Storico completo consumi
- Supporto riscaldamento, ACS, ACF

### 2. Gestione Bollette
- Upload bollette gas ed energia
- Allegati PDF
- Storico completo

### 3. Calcolo Ripartizione
- Algoritmo conforme normativa
- Quota fissa (30%) e variabile (70%)
- Gestione stagionale (estate/inverno)
- Gestione unità commerciali
- Gestione appartamenti non abitati

### 4. Report
- PDF mensili dettagliati
- Report annuali riepilogativi
- Esportazione dati

### 5. Configurazione
- Parametri modificabili
- Configurazione unità
- Costi fissi personalizzabili

## 🔧 Configurazione Avanzata

### Variabili Ambiente

Crea file `.env` nella root:

```env
# Backend
PORT=3000
NODE_ENV=production

# Frontend (per build)
VITE_API_URL=http://localhost:3000/api
```

### Personalizza Porte

Modifica `docker-compose.yml`:

```yaml
ports:
  - "8080:5173"  # Frontend su porta 8080
  - "3001:3000"  # Backend su porta 3001
```

## 🛡️ Backup

### Backup Manuale

```bash
# Backup database
cp data/condominio.db ~/backup-$(date +%Y%m%d).db

# Backup completo
tar -czf backup-$(date +%Y%m%d).tar.gz data/
```

### Backup Automatico

Configura cron job (vedi [BACKUP_TRANSFER.md](docs/BACKUP_TRANSFER.md))

## 🐛 Troubleshooting

### Container non si avvia

```bash
# Controlla log
docker-compose logs -f

# Riavvia
docker-compose restart
```

### Porta già in uso

```bash
# Verifica porte occupate
netstat -tuln | grep 5173

# Cambia porta in docker-compose.yml
```

### Database corrotto

```bash
# Ripristina da backup
docker-compose down
cp backup.db data/condominio.db
docker-compose up -d
```

## 🤝 Contribuire

Contributi benvenuti! Per favore:

1. Fork del repository
2. Crea feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit modifiche (`git commit -m 'Add AmazingFeature'`)
4. Push al branch (`git push origin feature/AmazingFeature`)
5. Apri Pull Request

## 📝 Roadmap

- [ ] Autenticazione utenti
- [ ] Notifiche email automatiche
- [ ] Grafici consumi storici
- [ ] Export Excel
- [ ] API REST documentata (Swagger)
- [ ] App mobile nativa
- [ ] Multi-condominio
- [ ] Integrazione pagamenti

## 📄 Licenza

Questo progetto è rilasciato sotto licenza MIT.

## 👤 Autore

**gianfrocca**
- GitHub: [@gianfrocca](https://github.com/gianfrocca)

## 🙏 Ringraziamenti

- [React](https://reactjs.org/)
- [Express](https://expressjs.com/)
- [SQLite](https://www.sqlite.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [PDFKit](http://pdfkit.org/)

## 💬 Supporto

Per domande, problemi o suggerimenti:
- 🐛 [Apri una Issue](https://github.com/gianfrocca/Gestione_Condominio/issues)
- 📖 Consulta la [documentazione](docs/)

---

⭐ Se questo progetto ti è utile, lascia una stella su GitHub!

**Made with ❤️ for efficient condominium management**
