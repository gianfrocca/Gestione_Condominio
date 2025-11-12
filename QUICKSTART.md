# 🚀 Quick Start - Gestione Condominio

Guida rapida per iniziare in 5 minuti.

## Prima di Iniziare

Assicurati di avere:
- ✅ QNAP NAS TS-453E con Container Station installato
- ✅ Accesso SSH al NAS (opzionale)
- ✅ IP del NAS sulla rete locale

## Installazione Express

### Metodo 1: Via SSH (5 minuti)

```bash
# 1. Connetti al NAS
ssh admin@192.168.X.X  # Sostituisci X.X con IP del tuo NAS

# 2. Vai nella directory Container
cd /share/Container

# 3. Clona il progetto
git clone https://github.com/gianfrocca/Gestione_Condominio.git

# 4. Entra nella directory
cd Gestione_Condominio

# 5. Avvia Docker
docker-compose up -d

# 6. Attendi 2-3 minuti per il primo avvio
docker-compose logs -f
```

**Accedi all'app:**
```
http://192.168.X.X:5173
```

### Metodo 2: Via Container Station UI (10 minuti)

1. **Scarica il progetto:**
   - Vai su https://github.com/gianfrocca/Gestione_Condominio
   - Clicca **Code** → **Download ZIP**
   - Salva sul tuo PC

2. **Carica sul NAS:**
   - Apri **File Station**
   - Naviga in `/Container`
   - Carica e estrai lo ZIP

3. **Avvia Container:**
   - Apri **Container Station**
   - Clicca **Create** → **Create Application**
   - Seleziona `docker-compose.yml` dalla cartella Gestione_Condominio
   - Clicca **Create**
   - Attendi completamento (5-10 minuti)

4. **Accedi:**
   ```
   http://IP_NAS:5173
   ```

## Configurazione Iniziale (Una Tantum)

### 1. Configura le Unità

1. Apri l'app nel browser
2. Vai su **Impostazioni** (icona ingranaggio)
3. Scorri fino a **Configurazione Unità**
4. Per ogni appartamento, verifica:
   - ✅ Superficie corretta
   - ✅ Stato "Abitato" (spunta se occupato)

### 2. Verifica Parametri

Nella sezione **Impostazioni**, controlla:

```
Metano:
- Quota Involontaria: 40%
- Quota Volontaria: 60%

Energia Elettrica:
- Quota Involontaria: 40%
- Quota Volontaria: 60%

Estate (Giugno-Settembre):
- Raffrescamento: 20%
- Acqua Calda: 20%
- Acqua Fredda: 20%

Inverno (Resto dell'anno):
- Riscaldamento: 35%
- Acqua Calda: 25%
- Acqua Fredda: 10%

Costi Fissi:
- Luci Scale: €2/mese
- Commerciale Acqua: €5/mese
```

Modifica se necessario e clicca **Salva Impostazioni**.

## Uso Mensile (Workflow Tipico)

### 🔹 Step 1: Inserisci Letture (5 minuti)

1. Vai su **Letture**
2. Seleziona il mese corrente
3. Inserisci le letture fotografate dai contabilizzatori
4. Clicca **Salva Letture**

### 🔹 Step 2: Inserisci Bollette (2 minuti)

1. Vai su **Bollette**
2. Clicca **Nuova Bolletta**
3. Inserisci:
   - Data bolletta
   - Tipo (Gas o Energia)
   - Importo in €
   - (Opzionale) Carica PDF bolletta
4. Clicca **Salva Bolletta**
5. Ripeti per entrambe le bollette (gas + energia)

### 🔹 Step 3: Calcola e Genera PDF (1 minuto)

1. Vai su **Report**
2. Seleziona il mese
3. Clicca **Calcola Ripartizione**
4. Controlla i risultati
5. Clicca **Genera PDF**
6. Il PDF si scarica automaticamente
7. Invia PDF ai condomini

## Accesso da Internet (Opzionale)

Per accedere da fuori casa:

1. Configura port forwarding sul router Fritz!Box
2. Segui la guida: [docs/FRITZBOX_PORTFORWARD.md](docs/FRITZBOX_PORTFORWARD.md)
3. Accedi con: `http://128.116.211.183:5173`

## Backup Consigliato

### Backup Settimanale Manuale

```bash
# Via SSH sul NAS
cd /share/Container/Gestione_Condominio
cp data/condominio.db ~/backup-$(date +%Y%m%d).db
```

### Backup Automatico

Segui la guida completa: [docs/BACKUP_TRANSFER.md](docs/BACKUP_TRANSFER.md)

## Troubleshooting Rapido

### Problema: Container non parte

```bash
# Controlla log
docker-compose logs -f

# Riavvia
docker-compose restart
```

### Problema: Non riesco ad accedere

- ✅ Verifica che container sia in esecuzione: `docker ps`
- ✅ Controlla IP corretto del NAS
- ✅ Prova a riavviare browser o svuota cache
- ✅ Verifica firewall NAS non blocchi porta 5173

### Problema: Calcolo fallisce

- ✅ Verifica di aver inserito TUTTE le letture del mese
- ✅ Verifica di aver inserito ENTRAMBE le bollette (gas + energia)
- ✅ Controlla che i valori siano numeri validi

## Link Utili

- 📖 [Documentazione Completa](README.md)
- 🔧 [Setup NAS Dettagliato](docs/SETUP_NAS_TS453E.md)
- 👤 [Guida Utente Completa](docs/GUIDA_UTENTE.md)
- 💾 [Backup e Sicurezza](docs/BACKUP_TRANSFER.md)
- 🌐 [Port Forwarding](docs/FRITZBOX_PORTFORWARD.md)
- 🐛 [Segnala Problema](https://github.com/gianfrocca/Gestione_Condominio/issues)

## Supporto

Per aiuto:
- Consulta la [Guida Utente](docs/GUIDA_UTENTE.md)
- Apri una [Issue su GitHub](https://github.com/gianfrocca/Gestione_Condominio/issues)

---

✅ **Fatto! Ora sei pronto per gestire le spese del condominio in modo automatico.**

🎯 **Prossimi passi consigliati:**
1. Fai un backup del database ogni mese
2. Configura accesso da internet (opzionale)
3. Testa il workflow completo con un mese di prova
