import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'database.sqlite');

/**
 * Esporta il database come SQL dump
 */
export const exportSQL = async (req, res) => {
  try {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);

    let sqlDump = `-- Gestione Condominio Database Backup
-- Generated: ${new Date().toISOString()}
-- SQLite version 3

BEGIN TRANSACTION;

`;

    // Ottieni tutte le tabelle
    db.all("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", [], (err, tables) => {
      if (err) {
        db.close();
        return res.status(500).json({ error: 'Errore durante la lettura delle tabelle' });
      }

      let completed = 0;
      const totalTables = tables.length;

      tables.forEach((table) => {
        // Aggiungi CREATE TABLE
        sqlDump += `-- Table: ${table.name}\n`;
        sqlDump += `DROP TABLE IF EXISTS ${table.name};\n`;
        sqlDump += `${table.sql};\n\n`;

        // Ottieni i dati
        db.all(`SELECT * FROM ${table.name}`, [], (err, rows) => {
          if (err) {
            console.error(`Errore lettura dati da ${table.name}:`, err);
          } else if (rows.length > 0) {
            rows.forEach((row) => {
              const columns = Object.keys(row);
              const values = columns.map(col => {
                const val = row[col];
                if (val === null) return 'NULL';
                if (typeof val === 'number') return val;
                // Escape single quotes
                return `'${String(val).replace(/'/g, "''")}'`;
              });

              sqlDump += `INSERT INTO ${table.name} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
            });
            sqlDump += '\n';
          }

          completed++;
          if (completed === totalTables) {
            sqlDump += 'COMMIT;\n';
            db.close();

            // Invia il file come download
            res.setHeader('Content-Type', 'application/sql');
            res.setHeader('Content-Disposition', `attachment; filename=backup_${Date.now()}.sql`);
            res.send(sqlDump);
          }
        });
      });
    });
  } catch (error) {
    console.error('Errore export SQL:', error);
    res.status(500).json({ error: 'Errore durante l\'export del database' });
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
    fs.copyFileSync(dbPath, backupPath);

    const db = new sqlite3.Database(dbPath);

    // Esegui il SQL dump
    db.exec(sqlContent, (err) => {
      if (err) {
        console.error('Errore import SQL:', err);

        // Ripristina il backup in caso di errore
        fs.copyFileSync(backupPath, dbPath);
        fs.unlinkSync(backupPath);

        db.close();
        return res.status(500).json({
          error: 'Errore durante l\'import del database',
          details: err.message
        });
      }

      // Rimuovi il backup temporaneo se tutto ok
      fs.unlinkSync(backupPath);
      db.close();

      res.json({
        success: true,
        message: 'Database importato con successo'
      });
    });
  } catch (error) {
    console.error('Errore import SQL:', error);
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
    res.download(dbPath, `database_${Date.now()}.sqlite`, (err) => {
      if (err) {
        console.error('Errore download database:', err);
        res.status(500).json({ error: 'Errore durante il download del database' });
      }
    });
  } catch (error) {
    console.error('Errore download database:', error);
    res.status(500).json({ error: 'Errore durante il download del database' });
  }
};
