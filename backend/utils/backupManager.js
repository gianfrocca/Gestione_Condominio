/**
 * Backup Manager
 * Gestisce backup automatici per entrambi i tipi di storage
 * - FileStorage: copia il file JSON a data/backups/
 * - PostgreSQL: esporta SQL dump
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getStorageInstance, allQuery } from '../database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUPS_DIR = path.join(__dirname, '../../data/backups');
const MAX_BACKUPS = 30; // Mantieni gli ultimi 30 giorni di backup

/**
 * Crea la directory dei backup se non esiste
 */
export const ensureBackupDir = async () => {
  try {
    await fs.mkdir(BACKUPS_DIR, { recursive: true });
  } catch (error) {
    console.error('❌ Errore creazione directory backup:', error);
    throw error;
  }
};

/**
 * Esegui un backup del database
 */
export const createBackup = async () => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + Date.now();
    const backupFile = path.join(BACKUPS_DIR, `backup_${timestamp}.json`);

    const storage = getStorageInstance();
    const storageType = process.env.STORAGE_TYPE || 'file';

    console.log(`📦 Inizio backup (${storageType})...`);

    if (storageType === 'file') {
      // Per FileStorage: copia il file JSON
      const sourceFile = path.join(__dirname, '../../data/storage/database.json');
      try {
        const content = await fs.readFile(sourceFile, 'utf-8');
        await fs.writeFile(backupFile, content, 'utf-8');
        console.log(`✅ Backup file creato: ${backupFile}`);
      } catch (error) {
        if (error.code === 'ENOENT') {
          console.log('⚠️  File di storage non ancora creato, creando backup vuoto');
          await fs.writeFile(backupFile, JSON.stringify({
            condominiums: [],
            users: [],
            units: [],
            meters: [],
            readings: [],
            bills: [],
            settings: [],
            fixed_costs: [],
            monthly_splits: [],
            payments: []
          }, null, 2), 'utf-8');
        } else {
          throw error;
        }
      }
    } else {
      // Per PostgreSQL: esporta SQL dump
      await createPostgresSQLDump(backupFile);
    }

    // Pulisci i backup vecchi
    await cleanOldBackups();

    return {
      success: true,
      file: backupFile,
      timestamp: new Date().toISOString(),
      storageType
    };
  } catch (error) {
    console.error('❌ Errore durante il backup:', error);
    throw error;
  }
};

/**
 * Crea un dump SQL per PostgreSQL
 */
const createPostgresSQLDump = async (backupFile) => {
  try {
    let sqlDump = `-- Gestione Condominio Database Backup
-- Generated: ${new Date().toISOString()}
-- Storage Type: PostgreSQL

BEGIN;

`;

    // Ottieni tutte le tabelle
    const tables = await allQuery(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public'
       AND table_type = 'BASE TABLE'
       ORDER BY table_name`
    );

    console.log(`  📊 Esportando ${tables.length} tabelle...`);

    // Processa ogni tabella
    for (const tableRow of tables) {
      const tableName = tableRow.table_name;
      const rows = await allQuery(`SELECT * FROM "${tableName}"`);

      if (rows.length > 0) {
        const columns = Object.keys(rows[0]);

        for (const row of rows) {
          const values = columns.map(col => {
            const val = row[col];
            if (val === null) return 'NULL';
            if (typeof val === 'number') return val;
            if (typeof val === 'boolean') return val ? 'true' : 'false';
            if (val instanceof Date) return `'${val.toISOString()}'`;
            return `'${String(val).replace(/'/g, "''")}'`;
          });

          sqlDump += `INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${values.join(', ')});\n`;
        }
      }
    }

    sqlDump += 'COMMIT;\n';

    await fs.writeFile(backupFile, sqlDump, 'utf-8');
    console.log(`✅ Backup SQL creato: ${backupFile}`);
  } catch (error) {
    console.error('❌ Errore creazione dump SQL:', error);
    throw error;
  }
};

/**
 * Lista tutti i backup disponibili
 */
export const listBackups = async () => {
  try {
    await ensureBackupDir();
    const files = await fs.readdir(BACKUPS_DIR);
    const backupFiles = files.filter(f => f.startsWith('backup_') && (f.endsWith('.json') || f.endsWith('.sql')));

    // Ordina per data (più recenti prima)
    const backups = await Promise.all(
      backupFiles.map(async (filename) => {
        const filepath = path.join(BACKUPS_DIR, filename);
        const stats = await fs.stat(filepath);
        return {
          filename,
          created: stats.mtime,
          size: stats.size,
          path: filepath
        };
      })
    );

    return backups.sort((a, b) => b.created - a.created);
  } catch (error) {
    console.error('❌ Errore lettura backup:', error);
    return [];
  }
};

/**
 * Pulisci i backup più vecchi mantenendo solo i più recenti
 */
const cleanOldBackups = async () => {
  try {
    const backups = await listBackups();

    if (backups.length > MAX_BACKUPS) {
      const toDelete = backups.slice(MAX_BACKUPS);
      console.log(`🗑️  Eliminazione di ${toDelete.length} backup vecchi...`);

      for (const backup of toDelete) {
        await fs.unlink(backup.path);
        console.log(`  ✅ Eliminato: ${backup.filename}`);
      }
    }
  } catch (error) {
    console.error('❌ Errore pulizia backup:', error);
  }
};

/**
 * Scarica un backup specifico
 */
export const downloadBackup = async (filename) => {
  try {
    const filepath = path.join(BACKUPS_DIR, filename);

    // Verifica che il file sia nella directory dei backup (sicurezza)
    if (!filepath.startsWith(BACKUPS_DIR)) {
      throw new Error('Accesso negato');
    }

    const content = await fs.readFile(filepath, 'utf-8');
    return {
      filename,
      content,
      contentType: filename.endsWith('.sql') ? 'application/sql' : 'application/json'
    };
  } catch (error) {
    console.error('❌ Errore download backup:', error);
    throw error;
  }
};

/**
 * Ripristina un backup
 */
export const restoreBackup = async (filename) => {
  try {
    const backupData = await downloadBackup(filename);
    const storageType = process.env.STORAGE_TYPE || 'file';

    console.log(`📥 Ripristino backup: ${filename}`);

    if (storageType === 'file') {
      // Per FileStorage: sovrascrivi il file
      const sourceFile = path.join(__dirname, '../../data/storage/database.json');
      await fs.writeFile(sourceFile, backupData.content, 'utf-8');
      console.log(`✅ Backup ripristinato da: ${filename}`);
    } else {
      throw new Error('Il ripristino per PostgreSQL deve essere fatto manualmente');
    }

    return {
      success: true,
      message: 'Backup ripristinato con successo',
      filename
    };
  } catch (error) {
    console.error('❌ Errore ripristino backup:', error);
    throw error;
  }
};

/**
 * Inizializza backup programmati (giornalieri)
 */
let backupInterval = null;

export const initializeScheduledBackups = () => {
  try {
    // Esegui un backup al primo avvio
    createBackup().catch(err => console.error('❌ Errore backup iniziale:', err));

    // Poi ogni 24 ore
    backupInterval = setInterval(() => {
      createBackup().catch(err => console.error('❌ Errore backup programmato:', err));
    }, 24 * 60 * 60 * 1000); // 24 ore

    console.log('✅ Backup programmati inizializzati (ogni 24 ore)');
  } catch (error) {
    console.error('❌ Errore inizializzazione backup programmati:', error);
  }
};

/**
 * Ferma i backup programmati
 */
export const stopScheduledBackups = () => {
  if (backupInterval) {
    clearInterval(backupInterval);
    backupInterval = null;
    console.log('✅ Backup programmati fermati');
  }
};

export default {
  ensureBackupDir,
  createBackup,
  listBackups,
  downloadBackup,
  restoreBackup,
  initializeScheduledBackups,
  stopScheduledBackups
};
