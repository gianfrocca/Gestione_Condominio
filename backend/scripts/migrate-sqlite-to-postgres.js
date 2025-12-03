#!/usr/bin/env node

/**
 * Script di migrazione da SQLite a PostgreSQL
 *
 * Uso:
 *   node backend/scripts/migrate-sqlite-to-postgres.js
 *
 * Prerequisiti:
 *   1. PostgreSQL database creato e vuoto
 *   2. Database SQLite esistente in /data/condominio.db
 *   3. Variabili di ambiente configurate (.env)
 */

import sqlite3 from 'better-sqlite3';
import pg from 'pg';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configurazione
const sqliteDbPath = join(__dirname, '../../data/condominio.db');

const pgConfig = {
  user: process.env.DB_USER || 'condominio_user',
  password: process.env.DB_PASSWORD || 'password',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'condominio_db',
};

console.log('📋 MIGRAZIONE SQLite → PostgreSQL');
console.log('================================\n');

async function migrate() {
  try {
    // Apri SQLite
    console.log('📖 Lettura da SQLite:', sqliteDbPath);
    const sqliteDb = new sqlite3(sqliteDbPath);
    sqliteDb.pragma('journal_mode = WAL');

    // Connetti a PostgreSQL
    console.log('🔌 Connessione a PostgreSQL:', pgConfig.host);
    const pgClient = new pg.Client(pgConfig);
    await pgClient.connect();

    console.log('✅ Connessioni stabilite\n');

    // Mappa tabelle e loro colonne
    const tables = [
      'condominiums',
      'users',
      'units',
      'meters',
      'readings',
      'bills',
      'settings',
      'fixed_costs',
      'monthly_splits',
      'payments'
    ];

    for (const table of tables) {
      try {
        // Leggi dati da SQLite
        const rows = sqliteDb.prepare(`SELECT * FROM ${table}`).all();

        if (rows.length === 0) {
          console.log(`  ⏭️  ${table}: nessun dato`);
          continue;
        }

        // Prepara insert per PostgreSQL
        const columns = Object.keys(rows[0]);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const insertQuery = `
          INSERT INTO ${table} (${columns.map(c => `"${c}"`).join(', ')})
          VALUES (${placeholders})
          ON CONFLICT DO NOTHING
        `;

        // Inserisci dati
        for (const row of rows) {
          const values = columns.map(col => row[col]);
          await pgClient.query(insertQuery, values);
        }

        console.log(`  ✅ ${table}: ${rows.length} record migrati`);
      } catch (err) {
        console.error(`  ❌ Errore ${table}:`, err.message);
      }
    }

    console.log('\n✅ Migrazione completata!');
    console.log('📝 Prossimi step:');
    console.log('   1. Verifica i dati in PostgreSQL');
    console.log('   2. Testa l\'applicazione');
    console.log('   3. Se OK, puoi eliminare il vecchio database SQLite');

    await pgClient.end();
    sqliteDb.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERRORE MIGRAZIONE:', error.message);
    console.error('\nDettagli:');
    console.error(error);
    process.exit(1);
  }
}

migrate();
