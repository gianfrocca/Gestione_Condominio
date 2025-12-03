import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { allQuery, runQuery, pool } from '../database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Esporta il database come SQL dump (PostgreSQL)
 */
export const exportSQL = async (req, res) => {
  try {
    let sqlDump = `-- Gestione Condominio Database Backup
-- Generated: ${new Date().toISOString()}
-- PostgreSQL Database Dump

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET client_min_messages = warning;
SET row_security = off;

BEGIN;

`;

    // Ottieni tutte le tabelle usando PostgreSQL information_schema
    const tables = await allQuery(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public'
       AND table_type = 'BASE TABLE'
       ORDER BY table_name`
    );

    console.log(`📦 Exporting ${tables.length} tables...`);

    // Processa ogni tabella sequenzialmente
    for (const tableRow of tables) {
      const tableName = tableRow.table_name;
      console.log(`  Exporting table: ${tableName}`);

      // Ottieni tutte i dati della tabella
      const rows = await allQuery(`SELECT * FROM "${tableName}"`);

      if (rows.length > 0) {
        console.log(`    ${rows.length} rows`);
        const columns = Object.keys(rows[0]);

        for (const row of rows) {
          const values = columns.map(col => {
            const val = row[col];
            if (val === null) return 'NULL';
            if (typeof val === 'number') return val;
            if (typeof val === 'boolean') return val ? 'true' : 'false';
            if (val instanceof Date) return `'${val.toISOString()}'`;
            // Escape single quotes for SQL
            return `'${String(val).replace(/'/g, "''")}'`;
          });

          sqlDump += `INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${values.join(', ')});\n`;
        }
        sqlDump += '\n';
      }
    }

    sqlDump += 'COMMIT;\n';

    console.log('✅ SQL export completed successfully');

    // Invia il file come download
    res.setHeader('Content-Type', 'application/sql; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=backup_${Date.now()}.sql`);
    res.send(sqlDump);

  } catch (error) {
    console.error('❌ Errore export SQL:', error);
    res.status(500).json({
      error: 'Errore durante l\'export del database',
      details: error.message
    });
  }
};

/**
 * Importa un database da SQL dump (PostgreSQL)
 */
export const importSQL = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nessun file fornito' });
    }

    console.log('📥 Starting database import...');
    const sqlContent = req.file.buffer.toString('utf-8');
    console.log(`   File size: ${sqlContent.length} bytes`);

    // Esegui il contenuto SQL
    console.log('🔄 Importing SQL...');
    await pool.query(sqlContent);

    console.log('✅ Import completed successfully');

    res.json({
      success: true,
      message: 'Database importato con successo'
    });

  } catch (error) {
    console.error('❌ Errore import SQL:', error);
    res.status(500).json({
      error: 'Errore durante l\'import del database',
      details: error.message
    });
  }
};

/**
 * Esporta dump in formato pg_dump (disponibile se accesso a server PostgreSQL)
 */
export const exportPGDump = async (req, res) => {
  try {
    console.log('📦 Preparing PostgreSQL dump...');

    // Genera un dump testuale di tutti i dati
    let dump = `-- PostgreSQL Database Dump
-- Generated: ${new Date().toISOString()}

`;

    // Ottieni tutte le tabelle
    const tables = await allQuery(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public'
       AND table_type = 'BASE TABLE'
       ORDER BY table_name`
    );

    for (const tableRow of tables) {
      const tableName = tableRow.table_name;
      const rows = await allQuery(`SELECT * FROM "${tableName}"`);

      dump += `-- Table: ${tableName}\n`;
      dump += `-- Records: ${rows.length}\n\n`;

      if (rows.length > 0) {
        const columns = Object.keys(rows[0]);
        dump += `COPY "${tableName}" (${columns.map(c => `"${c}"`).join(', ')}) FROM stdin;\n`;

        for (const row of rows) {
          const values = columns.map(col => {
            const val = row[col];
            if (val === null) return '\\N';
            if (typeof val === 'boolean') return val ? 't' : 'f';
            if (val instanceof Date) return val.toISOString();
            return String(val).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\t/g, '\\t');
          });
          dump += values.join('\t') + '\n';
        }
        dump += '\\.\n\n';
      }
    }

    console.log('✅ PostgreSQL dump prepared');

    res.setHeader('Content-Type', 'application/sql; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=dump_${Date.now()}.sql`);
    res.send(dump);

  } catch (error) {
    console.error('❌ Errore preparazione dump:', error);
    res.status(500).json({
      error: 'Errore durante la preparazione del dump',
      details: error.message
    });
  }
};
