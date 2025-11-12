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
    // Tabella Unità (appartamenti)
    await runQuery(`
      CREATE TABLE IF NOT EXISTS units (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        number TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        surface_area REAL NOT NULL,
        is_inhabited BOOLEAN DEFAULT 1,
        is_commercial BOOLEAN DEFAULT 0,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

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

    // Tabella Bollette
    await runQuery(`
      CREATE TABLE IF NOT EXISTS bills (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bill_date DATE NOT NULL,
        type TEXT NOT NULL,
        amount REAL NOT NULL,
        provider TEXT,
        bill_period_start DATE,
        bill_period_end DATE,
        file_path TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabella Impostazioni
    await runQuery(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        description TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

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

    // Tabella Ripartizioni Mensili (storico)
    await runQuery(`
      CREATE TABLE IF NOT EXISTS monthly_splits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
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
        FOREIGN KEY (unit_id) REFERENCES units(id),
        UNIQUE(month, unit_id)
      )
    `);

    // Inserisci impostazioni di default se non esistono
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
        `INSERT OR IGNORE INTO settings (key, value, description) VALUES (?, ?, ?)`,
        [key, value, description]
      );
    }

    console.log('✅ Database inizializzato con successo');
  } catch (error) {
    console.error('❌ Errore inizializzazione database:', error);
    throw error;
  }
};

export default db;
