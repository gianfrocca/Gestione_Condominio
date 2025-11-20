import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { allQuery } from '../database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'database.sqlite');

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

    // Ottieni tutte le tabelle
    const tables = await allQuery(
      "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    );

    for (const table of tables) {
      // Aggiungi CREATE TABLE
      sqlDump += `-- Table: ${table.name}\n`;
      sqlDump += `DROP TABLE IF EXISTS ${table.name};\n`;
      sqlDump += `${table.sql};\n\n`;

      // Ottieni i dati
      const rows = await allQuery(`SELECT * FROM ${table.name}`);

      if (rows.length > 0) {
        for (const row of rows) {
          const columns = Object.keys(row);
          const values = columns.map(col => {
            const val = row[col];
            if (val === null) return 'NULL';
            if (typeof val === 'number') return val;
            if (typeof val === 'boolean') return val ? 1 : 0;
            // Escape single quotes
            return `'${String(val).replace(/'/g, "''")}'`;
          });

          sqlDump += `INSERT INTO ${table.name} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
        }
        sqlDump += '\n';
      }
    }

    sqlDump += 'COMMIT;\n';

    // Invia il file come download
    res.setHeader('Content-Type', 'application/sql; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=backup_${Date.now()}.sql`);
    res.send(sqlDump);

  } catch (error) {
    console.error('Errore export SQL:', error);
    res.status(500).json({ error: 'Errore durante l\'export del database', details: error.message });
  }
};

/**
 * Importa un database da SQL dump
 */
export const importSQL = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nessun file fornito' });
    }

    const sqlContent = req.file.buffer.toString('utf-8');

    // Backup del database corrente
    const backupPath = path.join(__dirname, '..', `database.backup.${Date.now()}.sqlite`);
    await fs.copyFile(dbPath, backupPath);

    // Importa usando sqlite3-promisified
    const sqlite3 = (await import('sqlite3')).default;
    const db = new sqlite3.Database(dbPath);

    // Esegui il SQL dump
    await new Promise((resolve, reject) => {
      db.exec(sqlContent, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

    db.close();

    // Rimuovi il backup temporaneo se tutto ok
    await fs.unlink(backupPath);

    res.json({
      success: true,
      message: 'Database importato con successo'
    });

  } catch (error) {
    console.error('Errore import SQL:', error);

    // Prova a ripristinare il backup
    const backupPath = path.join(__dirname, '..', `database.backup.${Date.now()}.sqlite`);
    try {
      await fs.copyFile(backupPath, dbPath);
      await fs.unlink(backupPath);
    } catch (restoreError) {
      console.error('Errore ripristino backup:', restoreError);
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
    const fileBuffer = await fs.readFile(dbPath);

    res.setHeader('Content-Type', 'application/x-sqlite3');
    res.setHeader('Content-Disposition', `attachment; filename=database_${Date.now()}.sqlite`);
    res.send(fileBuffer);

  } catch (error) {
    console.error('Errore download database:', error);
    res.status(500).json({ error: 'Errore durante il download del database', details: error.message });
  }
};

