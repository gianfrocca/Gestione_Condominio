/**
 * File Storage Implementation
 * Salva i dati in file JSON
 * Perfetto per 1-10 condominii
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class FileStorage {
  constructor() {
    this.dataDir = path.join(__dirname, '../../data/storage');
    this.dataFile = path.join(this.dataDir, 'database.json');
    this.data = {
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
    };
    this.nextIds = {};
  }

  /**
   * Inizializza lo storage su file
   */
  async initialize() {
    try {
      // Crea directory se non esiste
      await fs.mkdir(this.dataDir, { recursive: true });

      // Carica dati esistenti o crea file nuovo
      try {
        const content = await fs.readFile(this.dataFile, 'utf-8');
        this.data = JSON.parse(content);
        console.log(`✅ Dati caricati da: ${this.dataFile}`);
      } catch (err) {
        if (err.code === 'ENOENT') {
          // File non esiste, crealo
          await this.saveToFile();
          console.log(`✅ Nuovo file di storage creato: ${this.dataFile}`);
        } else {
          throw err;
        }
      }

      // Inizializza i counter per gli ID
      this.initializeIdCounters();
    } catch (error) {
      console.error('❌ Errore inizializzazione FileStorage:', error);
      throw error;
    }
  }

  /**
   * Inizializza i contatori degli ID basati sui dati caricati
   */
  initializeIdCounters() {
    for (const [table, records] of Object.entries(this.data)) {
      if (Array.isArray(records) && records.length > 0) {
        const maxId = Math.max(...records.map(r => r.id || 0));
        this.nextIds[table] = maxId + 1;
      } else {
        this.nextIds[table] = 1;
      }
    }
  }

  /**
   * Salva i dati su file
   */
  async saveToFile() {
    try {
      await fs.writeFile(this.dataFile, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (error) {
      console.error('❌ Errore salvataggio su file:', error);
      throw error;
    }
  }

  /**
   * Esegui una query SELECT che ritorna multiple righe
   */
  async allQuery(sql, params = []) {
    try {
      const results = this.executeSql(sql, params);
      return results;
    } catch (error) {
      console.error('❌ Errore allQuery:', error);
      throw error;
    }
  }

  /**
   * Esegui una query SELECT che ritorna un singolo record
   */
  async getQuery(sql, params = []) {
    try {
      const results = this.executeSql(sql, params);
      return results.length > 0 ? results[0] : undefined;
    } catch (error) {
      console.error('❌ Errore getQuery:', error);
      throw error;
    }
  }

  /**
   * Esegui una query INSERT/UPDATE/DELETE
   */
  async runQuery(sql, params = []) {
    try {
      const result = this.executeSql(sql, params);
      // Salva i cambiamenti su file
      await this.saveToFile();
      return { id: result.lastId, changes: result.changes };
    } catch (error) {
      console.error('❌ Errore runQuery:', error);
      throw error;
    }
  }

  /**
   * Esecuzione SQL - interpreta le query basilari
   * Supporta: SELECT, INSERT, UPDATE, DELETE
   * Converte $1, $2, $3... in ? per compatibilità
   */
  executeSql(sql, params = []) {
    // Normalizza i parametri: $1, $2, $3... → ?
    // Questo permette di supportare sia il formato ? che $N
    sql = sql.replace(/\$\d+/g, '?');

    const sqlNormalized = sql.trim().toUpperCase();

    if (sqlNormalized.startsWith('SELECT')) {
      return this.executeSelect(sql, params);
    } else if (sqlNormalized.startsWith('INSERT')) {
      return this.executeInsert(sql, params);
    } else if (sqlNormalized.startsWith('UPDATE')) {
      return this.executeUpdate(sql, params);
    } else if (sqlNormalized.startsWith('DELETE')) {
      return this.executeDelete(sql, params);
    } else if (sqlNormalized.startsWith('CREATE')) {
      return { changes: 0 }; // CREATE TABLE non fa nulla in file storage
    } else {
      throw new Error(`Query non supportata: ${sql}`);
    }
  }

  /**
   * Esegui SELECT
   */
  executeSelect(sql, params) {
    // Parse semplice per SELECT - supporta la struttura base
    // SELECT col FROM table WHERE condition

    const fromMatch = sql.match(/FROM\s+(\w+)/i);
    if (!fromMatch) throw new Error('SELECT senza FROM');

    const tableName = fromMatch[1].toLowerCase();
    const table = this.data[tableName];

    if (!table) {
      console.warn(`Tabella ${tableName} non trovata, ritorno array vuoto`);
      return [];
    }

    let results = [...table];

    // Applica WHERE conditions semplici
    const whereMatch = sql.match(/WHERE\s+(.+?)(?:ORDER BY|LIMIT|$)/i);
    if (whereMatch) {
      const whereClause = whereMatch[1];
      results = results.filter(row => this.evaluateWhere(row, whereClause, params));
    }

    // Applica ORDER BY
    const orderMatch = sql.match(/ORDER BY\s+(\w+)(?:\s+(ASC|DESC))?/i);
    if (orderMatch) {
      const column = orderMatch[1];
      const direction = (orderMatch[2] || 'ASC').toUpperCase();
      results.sort((a, b) => {
        const aVal = a[column];
        const bVal = b[column];
        if (aVal < bVal) return direction === 'ASC' ? -1 : 1;
        if (aVal > bVal) return direction === 'ASC' ? 1 : -1;
        return 0;
      });
    }

    // Applica LIMIT
    const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
    if (limitMatch) {
      const limit = parseInt(limitMatch[1]);
      results = results.slice(0, limit);
    }

    return results;
  }

  /**
   * Esegui INSERT
   */
  executeInsert(sql, params) {
    // Parse: INSERT INTO table (col1, col2) VALUES (?, ?)
    const match = sql.match(/INSERT INTO\s+(\w+)\s*\((.+?)\)\s*VALUES/i);
    if (!match) throw new Error('INSERT non valido');

    const tableName = match[1].toLowerCase();
    const columns = match[2].split(',').map(c => c.trim().replace(/"/g, ''));

    const table = this.data[tableName];
    if (!table) throw new Error(`Tabella ${tableName} non esiste`);

    // Crea il nuovo record
    const newRecord = { id: this.nextIds[tableName]++ };
    columns.forEach((col, idx) => {
      newRecord[col] = params[idx];
    });

    table.push(newRecord);

    return { lastId: newRecord.id, changes: 1 };
  }

  /**
   * Esegui UPDATE
   */
  executeUpdate(sql, params) {
    // Parse semplice: UPDATE table SET col=? WHERE id=?
    const tableMatch = sql.match(/UPDATE\s+(\w+)/i);
    const setMatch = sql.match(/SET\s+(.+?)\s+WHERE/i);
    const whereMatch = sql.match(/WHERE\s+(.+?)$/i);

    if (!tableMatch || !setMatch || !whereMatch) {
      throw new Error('UPDATE non valido');
    }

    const tableName = tableMatch[1].toLowerCase();
    const table = this.data[tableName];
    if (!table) throw new Error(`Tabella ${tableName} non esiste`);

    const setClauses = setMatch[1].split(',').map(s => s.trim());
    const whereClause = whereMatch[1];

    let changes = 0;
    table.forEach(row => {
      if (this.evaluateWhere(row, whereClause, params)) {
        setClauses.forEach((setClause, idx) => {
          const [col] = setClause.split('=').map(s => s.trim());
          row[col] = params[setClauses.length + idx];
        });
        changes++;
      }
    });

    return { changes };
  }

  /**
   * Esegui DELETE
   */
  executeDelete(sql, params) {
    const tableMatch = sql.match(/FROM\s+(\w+)/i);
    const whereMatch = sql.match(/WHERE\s+(.+?)$/i);

    if (!tableMatch) throw new Error('DELETE senza FROM');

    const tableName = tableMatch[1].toLowerCase();
    const table = this.data[tableName];
    if (!table) throw new Error(`Tabella ${tableName} non esiste`);

    const whereClause = whereMatch ? whereMatch[1] : null;
    const initialLength = table.length;

    if (whereClause) {
      this.data[tableName] = table.filter(
        row => !this.evaluateWhere(row, whereClause, params)
      );
    } else {
      this.data[tableName] = [];
    }

    return { changes: initialLength - this.data[tableName].length };
  }

  /**
   * Normalizza i valori per il confronto
   * Converte boolean e stringhe numeriche al tipo appropriato
   */
  normalizeValue(value) {
    if (value === true || value === 1 || value === '1') return 1;
    if (value === false || value === 0 || value === '0') return 0;
    // Prova a convertire a numero
    const num = Number(value);
    if (!isNaN(num) && value !== '') return num;
    // Altrimenti ritorna come stringa
    return String(value).toLowerCase();
  }

  /**
   * Valuta una WHERE clause semplice
   */
  evaluateWhere(row, whereClause, params) {
    // Supporta: column = ? AND column != ? WHERE id = ?
    let paramIndex = 0;
    let clause = whereClause;

    // Sostituisci i placeholder ? con i valori
    clause = clause.replace(/\?/g, () => {
      const param = params[paramIndex++];
      if (typeof param === 'string') return `'${param}'`;
      return param;
    });

    // Valuta le condizioni
    // Semplice: id = 1, username = 'admin', is_active = 1, etc.
    const conditions = clause.split(/\s+AND\s+/i);

    return conditions.every(condition => {
      const parts = condition.match(/(\w+)\s*(=|!=|<|>|<=|>=)\s*(.+)/);
      if (!parts) return true;

      const [, column, operator, value] = parts;
      const rowValue = row[column.toLowerCase()];
      const compareValue = value.replace(/'/g, '');

      // Normalizza i valori per il confronto
      const normalizedRowValue = this.normalizeValue(rowValue);
      const normalizedCompareValue = this.normalizeValue(compareValue);

      switch (operator) {
        case '=':
          return normalizedRowValue === normalizedCompareValue;
        case '!=':
          return normalizedRowValue !== normalizedCompareValue;
        case '<':
          return normalizedRowValue < normalizedCompareValue;
        case '>':
          return normalizedRowValue > normalizedCompareValue;
        case '<=':
          return normalizedRowValue <= normalizedCompareValue;
        case '>=':
          return normalizedRowValue >= normalizedCompareValue;
        default:
          return true;
      }
    });
  }
}

export default FileStorage;
