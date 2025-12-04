import pg from 'pg';

const { Pool } = pg;

// Configurazione connessione PostgreSQL da variabili di ambiente
const pool = new Pool({
  user: process.env.DB_USER || 'condominio_user',
  password: process.env.DB_PASSWORD || 'password',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'condominio_db',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('Errore pool connessione PostgreSQL:', err.message);
});

/**
 * Attendi il database con retry automatico
 * Utile quando il database container sta ancora avviandosi
 */
const waitForDatabase = async () => {
  const MAX_RETRIES = 10;
  const RETRY_DELAY = 2000; // 2 secondi tra i tentativi
  let retries = 0;

  while (retries < MAX_RETRIES) {
    try {
      await pool.query('SELECT NOW()');
      console.log('✅ Connesso al database PostgreSQL');
      return;
    } catch (err) {
      retries++;
      if (retries < MAX_RETRIES) {
        console.log(`⏳ Tentativo ${retries}/${MAX_RETRIES} - Database non ancora pronto, attendo ${RETRY_DELAY / 1000}s...`);
        await new Promise(r => setTimeout(r, RETRY_DELAY));
      } else {
        console.error('❌ Impossibile connettersi al database dopo 10 tentativi');
        throw err;
      }
    }
  }
};

// Funzione per eseguire query con Promise (compatibile con pg)
export const runQuery = async (sql, params = []) => {
  try {
    const result = await pool.query(sql, params);
    // PostgreSQL: per INSERT con RETURNING id, il valore è in result.rows[0].id
    const id = result.rows.length > 0 && result.rows[0].id ? result.rows[0].id : null;
    return { id, changes: result.rowCount };
  } catch (err) {
    throw err;
  }
};

export const getQuery = async (sql, params = []) => {
  try {
    const result = await pool.query(sql, params);
    return result.rows.length > 0 ? result.rows[0] : undefined;
  } catch (err) {
    throw err;
  }
};

export const allQuery = async (sql, params = []) => {
  try {
    const result = await pool.query(sql, params);
    return result.rows;
  } catch (err) {
    throw err;
  }
};

// Inizializza lo schema del database
export const initDatabase = async () => {
  try {
    console.log('🔧 Inizializzazione database...');

    // Attendi che il database sia pronto prima di procedere
    await waitForDatabase();

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
    // TABELLA USERS (autenticazione e autorizzazione)
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
    // TABELLA UNITÀ (appartamenti)
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
    // TABELLA CONTABILIZZATORI
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

    // Tabella Letture
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

    // ============================================
    // TABELLA BOLLETTE
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
    // TABELLA IMPOSTAZIONI
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

    // Tabella Costi Fissi
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

    // ============================================
    // TABELLA RIPARTIZIONI MENSILI (storico)
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
    // TABELLA PAGAMENTI
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
      // Costi Parti Comuni
      ['common_areas_gas_monthly', '50', 'Costo parti comuni gas mensile (€/mese) - es. caldaia condominiale'],
      ['common_areas_elec_monthly', '80', 'Costo parti comuni elettricità mensile (€/mese) - es. ascensore, cancello automatico'],

      // Luci Scale
      ['staircase_lights_monthly', '2', 'Costo luci scale per unità mensile (€/unità/mese) - ogni unità con luci paga questo importo'],

      // Percentuali GAS (stagionali)
      ['gas_involuntary_pct', '40', 'Percentuale involontaria gas (applicata sia in inverno che in estate)'],
      ['gas_winter_heating_pct', '40', 'Percentuale riscaldamento gas inverno (sul totale bolletta)'],
      ['gas_winter_hot_water_pct', '20', 'Percentuale ACS gas inverno (sul totale bolletta)'],
      ['gas_summer_hot_water_pct', '60', 'Percentuale ACS gas estate (sul totale bolletta)'],

      // Percentuali ELETTRICITÀ (non cambiano, rimosse gas_voluntary_pct e elec_voluntary_pct obsolete)
      ['elec_involuntary_pct', '40', 'Percentuale involontaria elettricità'],

      // Stagionalità (mesi)
      ['summer_start_month', '6', 'Mese inizio estate (1-12)'],
      ['summer_end_month', '9', 'Mese fine estate (1-12)'],

      // Percentuali ELETTRICITÀ - ESTATE
      ['summer_cooling_pct', '20', 'Percentuale raffrescamento estate (sul totale bolletta)'],
      ['summer_hot_water_pct', '20', 'Percentuale ACS estate (sul totale bolletta)'],
      ['summer_cold_water_pct', '20', 'Percentuale ACF estate (sul totale bolletta)'],

      // Percentuali ELETTRICITÀ - INVERNO
      ['winter_heating_pct', '30', 'Percentuale riscaldamento inverno (sul totale bolletta)'],
      ['winter_hot_water_pct', '20', 'Percentuale ACS inverno (sul totale bolletta)'],
      ['winter_cold_water_pct', '10', 'Percentuale ACF inverno (sul totale bolletta)']
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

    console.log('✅ Database inizializzato con successo');
  } catch (error) {
    console.error('❌ Errore inizializzazione database:', error);
    throw error;
  }
};

export { pool };
