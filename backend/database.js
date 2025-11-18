import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '..', 'data', 'condominio.db');

// Crea connessione al database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Errore connessione database:', err.message);
  } else {
    console.log('✅ Connesso al database SQLite');
  }
});

// Funzione per eseguire query con Promise
export const runQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

export const getQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

export const allQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// Inizializza lo schema del database
export const initDatabase = async () => {
  try {
    console.log('🔧 Inizializzazione database...');

    // ============================================
    // TABELLA CONDOMINIUMS (multi-tenancy)
    // ============================================
    await runQuery(`
      CREATE TABLE IF NOT EXISTS condominiums (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        address TEXT,
        city TEXT,
        zip_code TEXT,
        tax_code TEXT,
        notes TEXT,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✅ Tabella condominiums');

    // ============================================
    // TABELLA USERS (autenticazione e autorizzazione)
    // ============================================
    await runQuery(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        condominium_id INTEGER,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        email TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('super_admin', 'admin', 'gestore', 'inquilino')),
        unit_id INTEGER,
        full_name TEXT,
        phone TEXT,
        is_active BOOLEAN DEFAULT 1,
        last_login DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (condominium_id) REFERENCES condominiums(id),
        FOREIGN KEY (unit_id) REFERENCES units(id)
      )
    `);
    console.log('  ✅ Tabella users');

    // ============================================
    // TABELLA UNITÀ (appartamenti)
    // ============================================
    await runQuery(`
      CREATE TABLE IF NOT EXISTS units (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        condominium_id INTEGER NOT NULL DEFAULT 1,
        number TEXT NOT NULL,
        name TEXT NOT NULL,
        surface_area REAL NOT NULL,
        is_inhabited BOOLEAN DEFAULT 1,
        is_commercial BOOLEAN DEFAULT 0,
        foglio TEXT,
        particella TEXT,
        sub TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (condominium_id) REFERENCES condominiums(id),
        UNIQUE(condominium_id, number)
      )
    `);

    console.log('  ✅ Tabella units');

    // Aggiungi colonne se non esistono (per database esistenti)
    try {
      await runQuery(`ALTER TABLE units ADD COLUMN condominium_id INTEGER NOT NULL DEFAULT 1`);
    } catch (e) { /* già esistente */ }
    try {
      await runQuery(`ALTER TABLE units ADD COLUMN foglio TEXT`);
    } catch (e) { /* già esistente */ }
    try {
      await runQuery(`ALTER TABLE units ADD COLUMN particella TEXT`);
    } catch (e) { /* già esistente */ }
    try {
      await runQuery(`ALTER TABLE units ADD COLUMN sub TEXT`);
    } catch (e) { /* già esistente */ }

    // ============================================
    // TABELLA CONTABILIZZATORI
    // ============================================
    // Tabella Contabilizzatori
    await runQuery(`
      CREATE TABLE IF NOT EXISTS meters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        unit_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        meter_code TEXT,
        description TEXT,
        FOREIGN KEY (unit_id) REFERENCES units(id),
        UNIQUE(unit_id, type)
      )
    `);

    // Tabella Letture
    await runQuery(`
      CREATE TABLE IF NOT EXISTS readings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        meter_id INTEGER NOT NULL,
        reading_date DATE NOT NULL,
        value REAL NOT NULL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (meter_id) REFERENCES meters(id)
      )
    `);

    // ============================================
    // TABELLA BOLLETTE
    // ============================================
    await runQuery(`
      CREATE TABLE IF NOT EXISTS bills (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        condominium_id INTEGER NOT NULL DEFAULT 1,
        bill_date DATE NOT NULL,
        type TEXT NOT NULL,
        amount REAL NOT NULL,
        provider TEXT,
        bill_period_start DATE,
        bill_period_end DATE,
        file_path TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (condominium_id) REFERENCES condominiums(id)
      )
    `);
    console.log('  ✅ Tabella bills');

    // Aggiungi condominium_id se non esiste
    try {
      await runQuery(`ALTER TABLE bills ADD COLUMN condominium_id INTEGER NOT NULL DEFAULT 1`);
    } catch (e) { /* già esistente */ }

    // ============================================
    // TABELLA IMPOSTAZIONI
    // ============================================
    await runQuery(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT NOT NULL,
        condominium_id INTEGER NOT NULL DEFAULT 1,
        value TEXT NOT NULL,
        description TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (key, condominium_id),
        FOREIGN KEY (condominium_id) REFERENCES condominiums(id)
      )
    `);
    console.log('  ✅ Tabella settings');

    // Aggiungi condominium_id se non esiste (per database esistenti)
    try {
      await runQuery(`ALTER TABLE settings ADD COLUMN condominium_id INTEGER NOT NULL DEFAULT 1`);
    } catch (e) { /* già esistente */ }

    // Tabella Costi Fissi
    await runQuery(`
      CREATE TABLE IF NOT EXISTS fixed_costs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        unit_id INTEGER,
        type TEXT NOT NULL,
        amount REAL NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT 1,
        FOREIGN KEY (unit_id) REFERENCES units(id)
      )
    `);

    // ============================================
    // TABELLA RIPARTIZIONI MENSILI (storico)
    // ============================================
    await runQuery(`
      CREATE TABLE IF NOT EXISTS monthly_splits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        condominium_id INTEGER NOT NULL DEFAULT 1,
        month DATE NOT NULL,
        unit_id INTEGER NOT NULL,
        cost_gas_heating REAL DEFAULT 0,
        cost_gas_hot_water REAL DEFAULT 0,
        cost_elec_heating REAL DEFAULT 0,
        cost_elec_hot_water REAL DEFAULT 0,
        cost_elec_cooling REAL DEFAULT 0,
        cost_elec_cold_water REAL DEFAULT 0,
        cost_elec_fixed REAL DEFAULT 0,
        total_cost REAL DEFAULT 0,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (condominium_id) REFERENCES condominiums(id),
        FOREIGN KEY (unit_id) REFERENCES units(id),
        UNIQUE(month, unit_id)
      )
    `);
    console.log('  ✅ Tabella monthly_splits');

    // Aggiungi condominium_id se non esiste
    try {
      await runQuery(`ALTER TABLE monthly_splits ADD COLUMN condominium_id INTEGER NOT NULL DEFAULT 1`);
    } catch (e) { /* già esistente */ }

    // ============================================
    // TABELLA PAGAMENTI
    // ============================================
    await runQuery(`
      CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        condominium_id INTEGER NOT NULL DEFAULT 1,
        unit_id INTEGER NOT NULL,
        payment_date DATE NOT NULL,
        amount REAL NOT NULL,
        payment_type TEXT,
        reference_month DATE,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (condominium_id) REFERENCES condominiums(id),
        FOREIGN KEY (unit_id) REFERENCES units(id)
      )
    `);
    console.log('  ✅ Tabella payments');

    // Aggiungi condominium_id se non esiste
    try {
      await runQuery(`ALTER TABLE payments ADD COLUMN condominium_id INTEGER NOT NULL DEFAULT 1`);
    } catch (e) { /* già esistente */ }

    // ============================================
    // DATI DI DEFAULT
    // ============================================

    // Crea condominio di default se non esiste
    const existingCondo = await getQuery('SELECT id FROM condominiums WHERE id = 1');
    if (!existingCondo) {
      await runQuery(
        `INSERT INTO condominiums (id, name, address, notes) VALUES (1, 'Condominio Default', 'Via Example 1', 'Condominio principale')`
      );
      console.log('  ✅ Condominio di default creato');
    }

    // Crea super-admin di default se non esiste
    const existingSuperAdmin = await getQuery('SELECT id FROM users WHERE role = "super_admin"');
    if (!existingSuperAdmin) {
      // Password di default: "admin123" (da cambiare al primo login)
      // Questo è solo per il setup iniziale - in produzione andrebbe cambiata immediatamente
      const bcrypt = await import('bcrypt');
      const passwordHash = await bcrypt.hash('admin123', 10);

      await runQuery(
        `INSERT INTO users (condominium_id, username, password_hash, email, role, full_name, is_active)
         VALUES (NULL, 'superadmin', ?, 'admin@example.com', 'super_admin', 'Super Administrator', 1)`,
        [passwordHash]
      );
      console.log('  ✅ Super-admin creato (username: superadmin, password: admin123)');
      console.log('  ⚠️  IMPORTANTE: Cambia la password al primo login!');
    }

    // Inserisci impostazioni di default per il condominio 1
    const defaultSettings = [
      ['gas_involuntary_pct', '40', 'Percentuale involontaria gas'],
      ['gas_voluntary_pct', '60', 'Percentuale volontaria gas'],
      ['elec_involuntary_pct', '40', 'Percentuale involontaria elettricità'],
      ['elec_voluntary_pct', '60', 'Percentuale volontaria elettricità'],
      ['summer_start_month', '6', 'Mese inizio estate (1-12)'],
      ['summer_end_month', '9', 'Mese fine estate (1-12)'],
      ['summer_cooling_pct', '20', 'Percentuale raffrescamento estate'],
      ['summer_hot_water_pct', '20', 'Percentuale ACS estate'],
      ['summer_cold_water_pct', '20', 'Percentuale ACF estate'],
      ['winter_heating_pct', '35', 'Percentuale riscaldamento inverno'],
      ['winter_hot_water_pct', '25', 'Percentuale ACS inverno'],
      ['winter_cold_water_pct', '10', 'Percentuale ACF inverno'],
      ['staircase_lights_cost', '2', 'Costo forfettario luci scale (€/mese)'],
      ['commercial_water_fixed', '5', 'Quota fissa commerciale acqua (€/mese)']
    ];

    for (const [key, value, description] of defaultSettings) {
      await runQuery(
        `INSERT OR IGNORE INTO settings (key, condominium_id, value, description) VALUES (?, 1, ?, ?)`,
        [key, value, description]
      );
    }
    console.log('  ✅ Impostazioni di default create');

    console.log('✅ Database inizializzato con successo');
  } catch (error) {
    console.error('❌ Errore inizializzazione database:', error);
    throw error;
  }
};

export default db;
