/**
 * Database Layer - Abstraction over Storage Layer
 * Supporta sia File Storage che PostgreSQL Storage
 */

import { initializeStorage, allQuery as storageAllQuery, getQuery as storageGetQuery, runQuery as storageRunQuery, getStorageInstance } from './storage/index.js';

/**
 * Funzioni di query wrapper - re-esportano le funzioni dal storage layer
 */
export const runQuery = (sql, params = []) => storageRunQuery(sql, params);
export const getQuery = (sql, params = []) => storageGetQuery(sql, params);
export const allQuery = (sql, params = []) => storageAllQuery(sql, params);

/**
 * Crea lo schema PostgreSQL con tutte le tabelle
 */
const createPostgresSchema = async () => {
  console.log('🔧 Creazione schema PostgreSQL...');

  // ============================================
  // TABELLA CONDOMINIUMS (multi-tenancy)
  // ============================================
  await runQuery(`
    CREATE TABLE IF NOT EXISTS condominiums (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT,
      city TEXT,
      zip_code TEXT,
      tax_code TEXT,
      notes TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('  ✅ Tabella condominiums');

  // ============================================
  // TABELLA USERS
  // ============================================
  await runQuery(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      condominium_id INTEGER REFERENCES condominiums(id),
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('super_admin', 'admin', 'gestore', 'inquilino')),
      unit_id INTEGER,
      full_name TEXT,
      phone TEXT,
      is_active BOOLEAN DEFAULT true,
      last_login TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('  ✅ Tabella users');

  // ============================================
  // TABELLA UNITÀ
  // ============================================
  await runQuery(`
    CREATE TABLE IF NOT EXISTS units (
      id SERIAL PRIMARY KEY,
      condominium_id INTEGER NOT NULL DEFAULT 1 REFERENCES condominiums(id),
      number TEXT NOT NULL,
      name TEXT NOT NULL,
      surface_area DECIMAL NOT NULL,
      is_inhabited BOOLEAN DEFAULT true,
      is_commercial BOOLEAN DEFAULT false,
      has_staircase_lights BOOLEAN DEFAULT false,
      monthly_water_fixed DECIMAL DEFAULT 0,
      monthly_elec_fixed_winter DECIMAL DEFAULT 0,
      monthly_elec_fixed_summer DECIMAL DEFAULT 0,
      monthly_gas_fixed_winter DECIMAL DEFAULT 0,
      monthly_gas_fixed_summer DECIMAL DEFAULT 0,
      foglio TEXT,
      particella TEXT,
      sub TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(condominium_id, number)
    )
  `);
  console.log('  ✅ Tabella units');

  // ============================================
  // TABELLA METERS
  // ============================================
  await runQuery(`
    CREATE TABLE IF NOT EXISTS meters (
      id SERIAL PRIMARY KEY,
      unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      meter_code TEXT,
      description TEXT,
      UNIQUE(unit_id, type)
    )
  `);
  console.log('  ✅ Tabella meters');

  // ============================================
  // TABELLA READINGS
  // ============================================
  await runQuery(`
    CREATE TABLE IF NOT EXISTS readings (
      id SERIAL PRIMARY KEY,
      meter_id INTEGER NOT NULL REFERENCES meters(id) ON DELETE CASCADE,
      reading_date DATE NOT NULL,
      value DECIMAL NOT NULL,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('  ✅ Tabella readings');

  // ============================================
  // TABELLA BILLS
  // ============================================
  await runQuery(`
    CREATE TABLE IF NOT EXISTS bills (
      id SERIAL PRIMARY KEY,
      condominium_id INTEGER NOT NULL DEFAULT 1 REFERENCES condominiums(id),
      bill_date DATE NOT NULL,
      type TEXT NOT NULL,
      amount DECIMAL NOT NULL,
      provider TEXT,
      bill_period_start DATE,
      bill_period_end DATE,
      file_path TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('  ✅ Tabella bills');

  // ============================================
  // TABELLA SETTINGS
  // ============================================
  await runQuery(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT NOT NULL,
      condominium_id INTEGER NOT NULL DEFAULT 1 REFERENCES condominiums(id),
      value TEXT NOT NULL,
      description TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (key, condominium_id)
    )
  `);
  console.log('  ✅ Tabella settings');

  // ============================================
  // TABELLA FIXED_COSTS
  // ============================================
  await runQuery(`
    CREATE TABLE IF NOT EXISTS fixed_costs (
      id SERIAL PRIMARY KEY,
      unit_id INTEGER REFERENCES units(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      amount DECIMAL NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true
    )
  `);
  console.log('  ✅ Tabella fixed_costs');

  // ============================================
  // TABELLA MONTHLY_SPLITS
  // ============================================
  await runQuery(`
    CREATE TABLE IF NOT EXISTS monthly_splits (
      id SERIAL PRIMARY KEY,
      condominium_id INTEGER NOT NULL DEFAULT 1 REFERENCES condominiums(id),
      month DATE NOT NULL,
      unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
      cost_gas_heating DECIMAL DEFAULT 0,
      cost_gas_hot_water DECIMAL DEFAULT 0,
      cost_elec_heating DECIMAL DEFAULT 0,
      cost_elec_hot_water DECIMAL DEFAULT 0,
      cost_elec_cooling DECIMAL DEFAULT 0,
      cost_elec_cold_water DECIMAL DEFAULT 0,
      cost_elec_fixed DECIMAL DEFAULT 0,
      total_cost DECIMAL DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(month, unit_id)
    )
  `);
  console.log('  ✅ Tabella monthly_splits');

  // ============================================
  // TABELLA PAYMENTS
  // ============================================
  await runQuery(`
    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      condominium_id INTEGER NOT NULL DEFAULT 1 REFERENCES condominiums(id),
      unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
      payment_date DATE NOT NULL,
      amount DECIMAL NOT NULL,
      payment_type TEXT,
      reference_month DATE,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('  ✅ Tabella payments');

  await createDefaultData();
};

/**
 * Crea i dati di default per FileStorage
 */
const createFileStorageDefaults = async () => {
  console.log('🔧 Inizializzazione dati di default per FileStorage...');

  // FileStorage crea automaticamente il file, ora aggiungiamo i dati di default
  await createDefaultData();
};

/**
 * Crea i dati di default comuni a entrambi i storage
 */
const createDefaultData = async () => {
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
    ['common_areas_gas_monthly', '50', 'Costo parti comuni gas mensile'],
    ['common_areas_elec_monthly', '80', 'Costo parti comuni elettricità mensile'],
    ['staircase_lights_monthly', '2', 'Costo luci scale per unità mensile'],
    ['gas_involuntary_pct', '40', 'Percentuale involontaria gas'],
    ['gas_winter_heating_pct', '40', 'Percentuale riscaldamento gas inverno'],
    ['gas_winter_hot_water_pct', '20', 'Percentuale ACS gas inverno'],
    ['gas_summer_hot_water_pct', '60', 'Percentuale ACS gas estate'],
    ['elec_involuntary_pct', '40', 'Percentuale involontaria elettricità'],
    ['summer_start_month', '6', 'Mese inizio estate'],
    ['summer_end_month', '9', 'Mese fine estate'],
    ['summer_cooling_pct', '20', 'Percentuale raffrescamento estate'],
    ['summer_hot_water_pct', '20', 'Percentuale ACS estate'],
    ['summer_cold_water_pct', '20', 'Percentuale ACF estate'],
    ['winter_heating_pct', '30', 'Percentuale riscaldamento inverno'],
    ['winter_hot_water_pct', '20', 'Percentuale ACS inverno'],
    ['winter_cold_water_pct', '10', 'Percentuale ACF inverno']
  ];

  for (const [key, value, description] of defaultSettings) {
    await runQuery(
      `INSERT INTO settings (key, condominium_id, value, description)
       VALUES ($1, 1, $2, $3)
       ON CONFLICT (key, condominium_id) DO NOTHING`,
      [key, value, description]
    );
  }
  console.log('  ✅ Impostazioni di default create');
};

// Inizializza lo schema del database
export const initDatabase = async () => {
  try {
    console.log('🔧 Inizializzazione database...');

    // Inizializza lo storage layer (file o PostgreSQL)
    await initializeStorage();

    const storageType = process.env.STORAGE_TYPE || 'file';

    // Se usiamo PostgreSQL, crea lo schema
    if (storageType === 'postgresql') {
      await createPostgresSchema();
    } else {
      // Per FileStorage, crea i dati di default
      await createFileStorageDefaults();
    }

    console.log('✅ Database inizializzato con successo');
  } catch (error) {
    console.error('❌ Errore inizializzazione database:', error);
    throw error;
  }
};

export { getStorageInstance };
