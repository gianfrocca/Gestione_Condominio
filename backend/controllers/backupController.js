import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import fsSync from 'fs';
import sqlite3 from 'sqlite3';
import { allQuery } from '../database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// IMPORTANT: Usa lo stesso percorso di database.js
const dbPath = path.join(__dirname, '..', '..', 'data', 'condominio.db');

/**
 * Esporta il database come SQL dump
 */
export const exportSQL = async (req, res) => {
  try {
    let sqlDump = `-- Gestione Condominio Database Backup
-- Generated: ${new Date().toISOString()}
-- SQLite version 3

BEGIN TRANSACTION;

`;

    // Ottieni tutte le tabelle usando allQuery
    const tables = await allQuery(
      "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    );

    console.log(`📦 Exporting ${tables.length} tables...`);

    // Processa ogni tabella sequenzialmente
    for (const table of tables) {
      console.log(`  Exporting table: ${table.name}`);

      sqlDump += `-- Table: ${table.name}\n`;
      sqlDump += `DROP TABLE IF EXISTS ${table.name};\n`;
      sqlDump += `${table.sql};\n\n`;

      // Ottieni tutti i dati della tabella
      const rows = await allQuery(`SELECT * FROM ${table.name}`);

      if (rows.length > 0) {
        console.log(`    ${rows.length} rows`);
        for (const row of rows) {
          const columns = Object.keys(row);
          const values = columns.map(col => {
            const val = row[col];
            if (val === null) return 'NULL';
            if (typeof val === 'number') return val;
            if (typeof val === 'boolean') return val ? 1 : 0;
            // Escape single quotes for SQL
            return `'${String(val).replace(/'/g, "''")}'`;
          });

          sqlDump += `INSERT INTO ${table.name} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
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
 * Importa un database da SQL dump
 */
export const importSQL = async (req, res) => {
  let backupPath = null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nessun file fornito' });
    }

    console.log('📥 Starting database import...');
    const sqlContent = req.file.buffer.toString('utf-8');
    console.log(`   File size: ${sqlContent.length} bytes`);

    // Backup del database corrente
    backupPath = path.join(__dirname, '..', '..', 'data', `condominio.backup.${Date.now()}.db`);

    // Verifica che il database esista prima di fare il backup
    if (!fsSync.existsSync(dbPath)) {
      return res.status(500).json({
        error: 'Database non trovato',
        details: `Il file ${dbPath} non esiste`
      });
    }

    console.log('💾 Creating backup...');
    await fs.copyFile(dbPath, backupPath);
    console.log(`   Backup created at: ${backupPath}`);

    // Crea nuova connessione per l'import
    console.log('🔄 Importing SQL...');

    await new Promise((resolve, reject) => {
      const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          reject(err);
          return;
        }

        // Esegui il contenuto SQL
        db.exec(sqlContent, (execErr) => {
          if (execErr) {
            console.error('❌ SQL execution error:', execErr);
            db.close();
            reject(execErr);
            return;
          }

          db.close((closeErr) => {
            if (closeErr) {
              console.error('⚠️ Error closing database:', closeErr);
            }
            resolve();
          });
        });
      });
    });

    console.log('✅ Import completed successfully');

    // Rimuovi il backup temporaneo se tutto ok
    await fs.unlink(backupPath);
    console.log('🗑️ Temporary backup removed');

    res.json({
      success: true,
      message: 'Database importato con successo'
    });

  } catch (error) {
    console.error('❌ Errore import SQL:', error);

    // Ripristina il backup in caso di errore
    if (backupPath && fsSync.existsSync(backupPath)) {
      try {
        console.log('⏮️ Restoring backup...');
        await fs.copyFile(backupPath, dbPath);
        await fs.unlink(backupPath);
        console.log('✅ Backup restored successfully');
      } catch (restoreErr) {
        console.error('❌ Failed to restore backup:', restoreErr);
      }
    }

    res.status(500).json({
      error: 'Errore durante l\'import del database',
      details: error.message
    });
  }
};

/**
 * Scarica una copia binaria del database SQLite
 */
export const downloadDatabase = async (req, res) => {
  try {
    console.log('📦 Downloading database binary...');

    if (!fsSync.existsSync(dbPath)) {
      return res.status(500).json({
        error: 'Database non trovato',
        details: `Il file ${dbPath} non esiste`
      });
    }

    res.download(dbPath, `database_${Date.now()}.sqlite`, (err) => {
      if (err) {
        console.error('❌ Errore download database:', err);
        if (!res.headersSent) {
          res.status(500).json({
            error: 'Errore durante il download del database',
            details: err.message
          });
        }
      } else {
        console.log('✅ Database download completed');
      }
    });
  } catch (error) {
    console.error('❌ Errore download database:', error);
    res.status(500).json({
      error: 'Errore durante il download del database',
      details: error.message
    });
  }
};
