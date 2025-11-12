# Guida Utente - Gestione Condominio

Guida rapida per l'utilizzo dell'applicazione.

## Accesso all'Applicazione

### Da Casa (LAN)
```
http://192.168.X.X:5173
```
Sostituisci X.X con l'IP del tuo NAS.

### Da Fuori Casa (Internet)
```
http://128.116.211.183:5173
```

## Prima Configurazione

### 1. Configura Unità

1. Vai su **Impostazioni**
2. Scorri fino a **Configurazione Unità**
3. Per ogni unità, verifica:
   - **Superficie**: corretta
   - **Abitato**: spunta se l'appartamento è occupato
   - **Commerciale**: indica se è attività commerciale

### 2. Imposta Parametri

Nella sezione **Impostazioni**:

**Metano:**
- Quota Involontaria: 40%
- Quota Volontaria: 60%

**Energia Elettrica:**
- Quota Involontaria: 40%
- Quota Volontaria: 60%

**Stagionalità:**
- Estate: da Giugno (6) a Settembre (9)
- Percentuali Estate: 20% Raff / 20% ACS / 20% ACF
- Percentuali Inverno: 35% Risc / 25% ACS / 10% ACF

**Costi Fissi:**
- Luci Scale: €2/mese
- Quota Commerciale Acqua: €5/mese

## Workflow Mensile

### Step 1: Inserisci Letture Contabilizzatori

1. Vai su **Letture**
2. Seleziona il **mese di riferimento**
3. Inserisci le letture per ogni unità:
   - **Riscaldamento** (kWh) - solo residenziali
   - **Acqua Calda** (m³) - solo residenziali
   - **Acqua Fredda** (m³) - tutti
4. Clicca **Salva Letture**

**Esempio:**
```
Sub 1 - Riscaldamento: 1250.50 kWh
Sub 1 - Acqua Calda: 4.5 m³
Sub 1 - Acqua Fredda: 8.2 m³
...
```

### Step 2: Inserisci Bollette

1. Vai su **Bollette**
2. Clicca **Nuova Bolletta**
3. Compila i campi:
   - **Data Bolletta**
   - **Tipo**: Energia Elettrica o Metano
   - **Importo**: €XXX.XX
   - **Fornitore**: es. ENEL, ESTRA
   - **File**: carica PDF bolletta (opzionale)
4. Clicca **Salva Bolletta**

**Nota:** Inserisci una bolletta per metano e una per energia elettrica ogni mese.

### Step 3: Calcola Ripartizione

1. Vai su **Report**
2. Seleziona il **mese**
3. Clicca **Calcola Ripartizione**
4. Controlla i risultati nella tabella

**La tabella mostrerà:**
- Totale Gas per unità
- Totale Energia per unità
- **Totale da Pagare** per ogni condomino

### Step 4: Genera PDF

1. Dopo il calcolo, clicca **Genera PDF**
2. Il report verrà scaricato automaticamente
3. Invia il PDF ai condomini via email

**Il PDF include:**
- Consumi dettagliati per ogni unità
- Ripartizione gas e energia elettrica
- Totale da pagare per ogni condomino
- Riepilogo generale

## Dashboard

La dashboard mostra:
- **Totale Spese Anno**: somma di tutte le spese
- **Metano**: totale gas anno corrente
- **Energia Elettrica**: totale energia anno corrente
- **Bollette Recenti**: ultime 5 bollette inserite
- **Riepilogo Unità**: spese per appartamento

## Report Annuale

1. Vai su **Report**
2. Nella sezione **Report Annuale**
3. Seleziona l'**anno**
4. Clicca **Genera Report Annuale PDF**

**Il report annuale include:**
- Totale gas/energia per l'anno
- Spese per unità
- Media mensile per condomino
- Numero mesi calcolati

## Domande Frequenti (FAQ)

### Come modifico una lettura?
Al momento non è possibile modificare letture inserite. Se hai fatto un errore, contatta l'amministratore per correzione manuale nel database.

### Posso eliminare una bolletta?
Sì, nella sezione **Bollette**, clicca sull'icona cestino accanto alla bolletta da eliminare.

### Quanto spesso devo fare i calcoli?
Si consiglia di fare i calcoli **mensilmente** dopo aver inserito tutte le letture e bollette del mese.

### I dati sono al sicuro?
Sì, tutti i dati sono salvati localmente sul tuo NAS. Ricorda di fare backup regolari (vedi [BACKUP_TRANSFER.md](./BACKUP_TRANSFER.md)).

### Posso accedere da smartphone?
Sì, l'interfaccia è responsive e funziona su mobile. Apri il browser e vai all'indirizzo dell'applicazione.

### Come aggiungo una nuova unità?
Al momento non è possibile aggiungere unità via interfaccia. Contatta l'amministratore per configurazione database.

## Best Practices

1. **Inserisci letture regolarmente**: evita di accumulare mesi arretrati
2. **Carica bollette subito**: appena ricevute da fornitore
3. **Verifica calcoli**: controlla che i totali siano ragionevoli
4. **Backup mensili**: dopo ogni calcolo, fai un backup del database
5. **Archivia PDF**: salva i report generati per storico

## Calcolo dei Costi - Come Funziona

### Metano

**Quota Involontaria (40%):**
- Divisa in base alle **superfici** degli appartamenti abitati
- Esempio: App. 100mq paga di più di app. 50mq

**Quota Volontaria (60%):**
- Divisa in base ai **consumi ACS** (acqua calda sanitaria)
- Chi consuma più acqua calda, paga di più

### Energia Elettrica

**Quota Involontaria (40%):**
- Divisa in base alle **superfici** (pesata se non abitato)
- Detratti i costi fissi (luci scale, quota commerciale)

**Quota Volontaria (60%):**
- **Estate**: 20% Raffrescamento, 20% ACS, 20% ACF
- **Inverno**: 35% Riscaldamento, 25% ACS, 10% ACF
- Ogni quota divisa proporzionalmente ai consumi misurati

**Esempio Inverno:**
- Riscaldamento: chi consuma più kWh paga di più
- ACS: chi consuma più acqua calda paga di più
- ACF: chi consuma più acqua fredda paga di più

### Commerciale

L'unità commerciale:
- **NON paga** riscaldamento/raffrescamento
- **Paga** acqua fredda (variabile + €5/mese fisso)

### Appartamento Non Abitato

Se un appartamento è vuoto:
- **Paga** quota involontaria ridotta (30% del peso superficie)
- **NON paga** quota volontaria (consumi zero)

## Supporto

Per assistenza:
- Email: [tua-email]
- GitHub: https://github.com/gianfrocca/Gestione_Condominio/issues
- Documentazione: https://github.com/gianfrocca/Gestione_Condominio/tree/main/docs
