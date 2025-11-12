# Configurazione Port Forwarding su Fritz!Box

Guida per configurare il port forwarding sul router Fritz!Box per accedere all'applicazione da internet.

## Informazioni Necessarie

- **IP Pubblico**: 128.116.211.183 (statico)
- **IP Locale NAS**: 192.168.X.X (trova il tuo IP NAS)
- **Porta Applicazione**: 5173 (frontend)
- **Porta API**: 3000 (backend)

## Trova IP del NAS

### Metodo 1: Da NAS
1. Accedi al NAS
2. **Control Panel** → **Network & File Services** → **Network**
3. Annota l'**IPv4 Address**

### Metodo 2: Da Fritz!Box
1. Accedi a `http://fritz.box` o `http://192.168.178.1`
2. **Home Network** → **Network**
3. Cerca il tuo NAS nella lista dispositivi
4. Annota l'IP

## Configurazione Port Forwarding

### Passo 1: Accedi al Fritz!Box

1. Apri browser
2. Vai a: `http://fritz.box` o `http://192.168.178.1`
3. Login con credenziali amministratore

### Passo 2: Configura Port Forwarding per Frontend

1. Vai su: **Internet** → **Permit Access** (o **Freigaben**)
2. Tab: **Port Forwarding**
3. Clicca **New Port Forwarding**

**Configurazione Frontend:**
```
Name: Condominio Frontend
Protocol: TCP
Port to Device: 5173
to Port: 5173
to Computer: [Seleziona NAS o inserisci IP]
Active: ✓
```

4. Clicca **OK** per salvare

### Passo 3: Configura Port Forwarding per Backend API

Ripeti il processo per l'API:

**Configurazione Backend:**
```
Name: Condominio API
Protocol: TCP
Port to Device: 3000
to Port: 3000
to Computer: [Seleziona NAS o inserisci IP]
Active: ✓
```

### Passo 4: Verifica Configurazione

Nelle regole dovresti vedere:

| Name | Protocol | Port | Device | Status |
|------|----------|------|--------|--------|
| Condominio Frontend | TCP | 5173 | 192.168.X.X | Active |
| Condominio API | TCP | 3000 | 192.168.X.X | Active |

## Test Accesso Esterno

### Da Rete Mobile (4G/5G)

1. Disattiva WiFi sul cellulare
2. Apri browser
3. Vai a: `http://128.116.211.183:5173`
4. Dovresti vedere la dashboard

### Da Rete Esterna

Chiedi a un amico di provare ad accedere:
```
http://128.116.211.183:5173
```

## Sicurezza - IMPORTANTE ⚠️

### Limita Accesso (Opzionale)

Se vuoi limitare l'accesso solo a certi IP:

1. In Fritz!Box vai su **Internet** → **Filters** → **Lists**
2. Crea una **Network Application** personalizzata
3. Aggiungi filtri IP se necessario

### Cambio Porte (Maggiore Sicurezza)

Per maggiore sicurezza, usa porte non standard:

**Esempio:**
```
Porta Pubblica: 8443 → Porta Interna: 5173
Porta Pubblica: 8444 → Porta Interna: 3000
```

Così accederai con: `http://128.116.211.183:8443`

## HTTPS (Certificato SSL) - Opzionale Avanzato

### Con Let's Encrypt e Reverse Proxy

Se vuoi HTTPS (https:// invece di http://):

1. Installa **nginx** nel Container Station
2. Configura reverse proxy con SSL
3. Ottieni certificato Let's Encrypt gratuito

**Esempio configurazione nginx:**
```nginx
server {
    listen 443 ssl;
    server_name 128.116.211.183;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    location / {
        proxy_pass http://localhost:5173;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api {
        proxy_pass http://localhost:3000/api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Troubleshooting

### Non riesco ad accedere da esterno

**Controlla:**
1. Port forwarding attivo su Fritz!Box
2. Container Docker in esecuzione: `docker ps`
3. Firewall NAS non blocca le porte
4. IP pubblico corretto: `curl ifconfig.me`

**Test porte:**
```bash
# Da PC esterno
telnet 128.116.211.183 5173
```

### Porta già in uso

Se la porta 5173 o 3000 è già usata da altra applicazione:

1. Cambia porta in `docker-compose.yml`:
```yaml
ports:
  - "8080:5173"
  - "3001:3000"
```

2. Aggiorna port forwarding su Fritz!Box:
```
Port to Device: 8080 → to Port: 5173
Port to Device: 3001 → to Port: 3000
```

### IP Pubblico Cambiato

Se hai IP dinamico (non statico), usa un servizio DDNS:

1. **Fritz!Box** supporta DDNS integrato
2. Vai su **Internet** → **Permit Access** → **DynDNS**
3. Configura provider DDNS (es: No-IP, DuckDNS)

## Dominio Personalizzato (Opzionale)

Se vuoi usare un dominio tipo `condominio.tuodominio.it`:

1. Acquista dominio (es: su Namecheap, GoDaddy)
2. Configura **DNS A Record**:
```
Type: A
Name: condominio (o @)
Value: 128.116.211.183
TTL: 3600
```

3. Accedi con: `http://condominio.tuodominio.it:5173`

## Link Utili

- Manuale Fritz!Box: https://en.avm.de/service/manuals/
- Fritz!Box Port Forwarding: https://en.avm.de/service/fritzbox/fritzbox-7590/knowledge-base/publication/show/893_Setting-up-FRITZ-Box-for-internet-access-via-IPv4/
- Let's Encrypt: https://letsencrypt.org/
