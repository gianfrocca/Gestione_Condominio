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
   * Ricarica i dati dal file (sincronizzazione dopo import)
   * Essenziale dopo l'import di un nuovo database.json
   */
  async reload() {
    try {
      console.log(`🔄 Reloading FileStorage from disk...`);
      const content = await fs.readFile(this.dataFile, 'utf-8');
      this.data = JSON.parse(content);
      this.initializeIdCounters();
      console.log(`✅ FileStorage ricaricato da disco`);
    } catch (error) {
      console.error('❌ Errore reload FileStorage:', error);
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
      console.log(`\n💾 saveToFile() called`);
      console.log(`   📊 Data summary before save:`);
      console.log(`     - Readings: ${this.data.readings?.length || 0} records`);
      console.log(`     - Bills: ${this.data.bills?.length || 0} records`);
      console.log(`     - Meters: ${this.data.meters?.length || 0} records`);
      console.log(`     - Units: ${this.data.units?.length || 0} records`);

      if (this.data.readings && this.data.readings.length > 0) {
        console.log(`     - First reading:`, this.data.readings[0]);
      }
      if (this.data.bills && this.data.bills.length > 0) {
        console.log(`     - First bill:`, this.data.bills[0]);
      }

      const jsonContent = JSON.stringify(this.data, null, 2);
      console.log(`   File size: ${jsonContent.length} bytes`);
      console.log(`   Writing to file: ${this.dataFile}`);

      await fs.writeFile(this.dataFile, jsonContent, 'utf-8');
      console.log(`   ✅ File written successfully`);

      // Verifica che il file sia stato scritto
      const stats = await fs.stat(this.dataFile);
      console.log(`   📁 File stats - Size: ${stats.size} bytes, Mode: ${stats.mode}`);
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
      console.log(`\n🟣 runQuery called`);
      console.log(`   SQL: ${sql.substring(0, 80)}...`);
      console.log(`   Params: ${JSON.stringify(params)}`);

      const result = this.executeSql(sql, params);
      console.log(`   ✅ executeSql returned:`, result);

      // Salva i cambiamenti su file
      console.log(`   💾 Saving to file...`);
      await this.saveToFile();
      console.log(`   ✅ Saved to file`);

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

    console.log(`   🔷 executeSql - SQL type: ${sqlNormalized.substring(0, 20)}...`);

    if (sqlNormalized.startsWith('SELECT')) {
      console.log(`   🔷 → Calling executeSelect`);
      return this.executeSelect(sql, params);
    } else if (sqlNormalized.startsWith('INSERT')) {
      console.log(`   🔷 → Calling executeInsert`);
      return this.executeInsert(sql, params);
    } else if (sqlNormalized.startsWith('UPDATE')) {
      console.log(`   🔷 → Calling executeUpdate`);
      return this.executeUpdate(sql, params);
    } else if (sqlNormalized.startsWith('DELETE')) {
      console.log(`   🔷 → Calling executeDelete`);
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
    // Supporta anche funzioni di aggregazione: SUM(), COUNT(), AVG(), MIN(), MAX()
    // Supporta anche LEFT JOIN: FROM table1 LEFT JOIN table2 ON condition

    const fromMatch = sql.match(/FROM\s+(\w+)(?:\s+(\w+))?\s*(?:LEFT\s+JOIN|INNER\s+JOIN)?/i);
    if (!fromMatch) throw new Error('SELECT senza FROM');

    const tableName = fromMatch[1].toLowerCase();
    const tableAlias = fromMatch[2]?.toLowerCase() || tableName;
    const table = this.data[tableName];

    console.log(`   🟢 executeSelect: table=${tableName}${tableAlias !== tableName ? ` (alias ${tableAlias})` : ''}, table exists=${!!table}`);
    if (table) {
      console.log(`   🟢 Table has ${table.length} records`);
      if (table.length > 0) {
        console.log(`     First record:`, table[0]);
      }
    }

    if (!table) {
      console.warn(`Tabella ${tableName} non trovata, ritorno array vuoto`);
      return [];
    }

    let results = [...table];

    // CRITICAL: Controlla se c'è un LEFT JOIN
    const joinMatch = sql.match(/LEFT\s+JOIN\s+(\w+)(?:\s+(\w+))?\s+ON\s+(.+?)(?:WHERE|GROUP|ORDER|$)/is);
    if (joinMatch) {
      const joinTableName = joinMatch[1].toLowerCase();
      const joinTableAlias = joinMatch[2]?.toLowerCase() || joinTableName;
      const onCondition = joinMatch[3].trim();

      console.log(`   🔗 LEFT JOIN detected: ${joinTableName} (alias ${joinTableAlias}) ON ${onCondition}`);

      const joinTable = this.data[joinTableName];
      if (!joinTable) {
        throw new Error(`LEFT JOIN: Tabella ${joinTableName} non trovata`);
      }

      // Parsa la condizione ON (es: u.id = m.unit_id)
      const onMatch = onCondition.match(/(\w+)\.(\w+)\s*=\s*(\w+)\.(\w+)/i);
      if (!onMatch) {
        throw new Error(`LEFT JOIN: Condizione ON non parsabile: ${onCondition}`);
      }

      const leftTable = onMatch[1].toLowerCase();
      const leftCol = onMatch[2].toLowerCase();
      const rightTable = onMatch[3].toLowerCase();
      const rightCol = onMatch[4].toLowerCase();

      console.log(`   🔗 ON condition parsed: ${leftTable}.${leftCol} = ${rightTable}.${rightCol}`);

      // Mappa gli alias ai nomi reali
      const tableMapping = {
        [tableAlias]: tableName,
        [joinTableAlias]: joinTableName
      };

      // Determina quale colonna è da quale tabella
      // Se leftTable è l'alias della tabella principale, leftCol è il campo della sinistra, rightCol è della destra
      const sourceCol = leftTable === tableAlias ? leftCol : rightCol;
      const joinCol = rightTable === joinTableAlias ? rightCol : leftCol;

      console.log(`   🔗 Joining: for each row in ${tableName}, find rows in ${joinTableName} where ${tableName}.${sourceCol} = ${joinTableName}.${joinCol}`);

      // Esegui il LEFT JOIN
      const joinedResults = [];
      for (const leftRow of results) {
        const leftValue = leftRow[sourceCol];

        // Cerca i match nella tabella destra
        const matchingRows = joinTable.filter(rightRow => rightRow[joinCol] == leftValue); // Use == for loose comparison

        if (matchingRows.length > 0) {
          // Una riga sinistra può joinarsi con multiple righe destre
          for (const rightRow of matchingRows) {
            const joinedRow = { ...leftRow };

            // Aggiungi i campi dalla tabella destra con il prefisso alias
            for (const [key, value] of Object.entries(rightRow)) {
              joinedRow[`${joinTableAlias}_${key}`] = value;
              // Aggiungi anche senza prefisso se non conflitto
              if (!(key in joinedRow)) {
                joinedRow[key] = value;
              }
            }

            joinedResults.push(joinedRow);
          }
        } else {
          // LEFT JOIN: mantieni la riga sinistra anche senza match
          joinedResults.push(leftRow);
        }
      }

      console.log(`   🔗 LEFT JOIN result: ${results.length} rows → ${joinedResults.length} rows after join`);
      results = joinedResults;
    }

    // Applica WHERE conditions semplici
    const whereMatch = sql.match(/WHERE\s+(.+?)(?:ORDER BY|LIMIT|$)/is);  // Added 's' flag for multiline
    if (whereMatch) {
      const whereClause = whereMatch[1];
      results = results.filter(row => this.evaluateWhere(row, whereClause, params));
    }

    // CRITICAL: Parsa i SELECT aliases (es: m.id as meter_id, m.type as meter_type)
    const selectMatch = sql.match(/SELECT\s+(.+?)\s+FROM/i);
    if (selectMatch) {
      const selectColumns = selectMatch[1];

      // Trova tutti gli alias "AS alias"
      const aliasMatches = [...selectColumns.matchAll(/(\w+\.\w+|\w+)\s+(?:as|AS)\s+(\w+)/g)];

      if (aliasMatches.length > 0) {
        console.log(`   🔀 Applying SELECT aliases:`);

        results = results.map(row => {
          const newRow = { ...row };

          for (const match of aliasMatches) {
            const sourceField = match[1]; // es: m.id o m.type
            const aliasName = match[2];  // es: meter_id, meter_type

            // Se il campo ha un prefisso (es: m.id), estrai il nome senza prefisso
            const [prefix, field] = sourceField.includes('.')
              ? sourceField.split('.')
              : [null, sourceField];

            // Se c'è un prefisso, guarda il campo con il prefisso alias (es: m_id)
            const lookupField = prefix ? `${prefix}_${field}` : field;

            if (lookupField in newRow && !(aliasName in newRow)) {
              newRow[aliasName] = newRow[lookupField];
              console.log(`     ${lookupField} → ${aliasName}`);
            }
          }

          return newRow;
        });
      }
    }

    // Controlla se è una query di aggregazione
    const sumMatch = sql.match(/SELECT\s+SUM\s*\(\s*(\w+)\s*\)\s+(?:as|AS)\s+(\w+)/i);
    const countMatch = sql.match(/SELECT\s+COUNT\s*\(\s*(\w+|\*)\s*\)\s+(?:as|AS)\s+(\w+)/i);
    const avgMatch = sql.match(/SELECT\s+AVG\s*\(\s*(\w+)\s*\)\s+(?:as|AS)\s+(\w+)/i);
    const minMatch = sql.match(/SELECT\s+MIN\s*\(\s*(\w+)\s*\)\s+(?:as|AS)\s+(\w+)/i);
    const maxMatch = sql.match(/SELECT\s+MAX\s*\(\s*(\w+)\s*\)\s+(?:as|AS)\s+(\w+)/i);

    if (sumMatch) {
      const column = sumMatch[1];
      const alias = sumMatch[2];
      const total = results.reduce((sum, row) => sum + (parseFloat(row[column]) || 0), 0);
      const aggregateResult = {};
      aggregateResult[alias] = total;
      console.log(`   🟢 executeSelect returning SUM aggregation: ${alias}=${total}`);
      return [aggregateResult];
    }

    if (countMatch) {
      const alias = countMatch[2];
      const count = results.length;
      const aggregateResult = {};
      aggregateResult[alias] = count;
      console.log(`   🟢 executeSelect returning COUNT aggregation: ${alias}=${count}`);
      return [aggregateResult];
    }

    if (avgMatch) {
      const column = avgMatch[1];
      const alias = avgMatch[2];
      const sum = results.reduce((acc, row) => acc + (parseFloat(row[column]) || 0), 0);
      const average = results.length > 0 ? sum / results.length : 0;
      const aggregateResult = {};
      aggregateResult[alias] = average;
      console.log(`   🟢 executeSelect returning AVG aggregation: ${alias}=${average}`);
      return [aggregateResult];
    }

    if (minMatch) {
      const column = minMatch[1];
      const alias = minMatch[2];
      const min = results.length > 0 ? Math.min(...results.map(row => parseFloat(row[column]) || Infinity)) : null;
      const aggregateResult = {};
      aggregateResult[alias] = min === Infinity ? null : min;
      console.log(`   🟢 executeSelect returning MIN aggregation: ${alias}=${min}`);
      return [aggregateResult];
    }

    if (maxMatch) {
      const column = maxMatch[1];
      const alias = maxMatch[2];
      const max = results.length > 0 ? Math.max(...results.map(row => parseFloat(row[column]) || -Infinity)) : null;
      const aggregateResult = {};
      aggregateResult[alias] = max === -Infinity ? null : max;
      console.log(`   🟢 executeSelect returning MAX aggregation: ${alias}=${max}`);
      return [aggregateResult];
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

    console.log(`   🟢 executeSelect returning ${results.length} results`);
    return results;
  }

  /**
   * Esegui INSERT
   */
  executeInsert(sql, params) {
    // Parse: INSERT INTO table (col1, col2) VALUES (?, ?)
    // Supporta anche: INSERT OR REPLACE INTO table (col1, col2) VALUES (?, ?)
    const match = sql.match(/INSERT(?:\s+OR\s+REPLACE)?\s+INTO\s+(\w+)\s*\((.+?)\)\s*VALUES/is);

    console.log(`🔵 executeInsert called`);
    console.log(`   SQL: ${sql.substring(0, 100)}...`);
    console.log(`   Regex match result:`, match ? 'MATCHED' : 'NO MATCH');

    if (!match) throw new Error('INSERT non valido');

    const tableName = match[1].toLowerCase();
    const rawColumns = match[2];

    console.log(`   Table: ${tableName}`);
    console.log(`   Raw columns from regex: "${rawColumns}"`);

    const columns = rawColumns.split(',').map(c => c.trim().replace(/"/g, ''));

    console.log(`   Parsed columns:`, columns);
    console.log(`   Params:`, params);

    const table = this.data[tableName];
    if (!table) {
      console.error(`   ❌ Table ${tableName} not found!`);
      throw new Error(`Tabella ${tableName} non esiste`);
    }

    // Crea il nuovo record
    const newRecord = { id: this.nextIds[tableName]++ };
    console.log(`   Creating record with ID: ${newRecord.id}`);

    columns.forEach((col, idx) => {
      newRecord[col] = params[idx];
      console.log(`     ${col} = ${params[idx]}`);
    });

    console.log(`   Final record:`, newRecord);
    table.push(newRecord);
    console.log(`   ✅ Record pushed to table. Table now has ${table.length} records`);

    return { lastId: newRecord.id, changes: 1 };
  }

  /**
   * Esegui UPDATE
   */
  executeUpdate(sql, params) {
    // Parse semplice: UPDATE table SET col=? WHERE id=?
    const tableMatch = sql.match(/UPDATE\s+(\w+)/i);
    const setMatch = sql.match(/SET\s+(.+?)\s+WHERE/is);  // Added 's' flag for multiline matching
    const whereMatch = sql.match(/WHERE\s+(.+?)$/is);     // Added 's' flag for multiline matching

    if (!tableMatch || !setMatch || !whereMatch) {
      throw new Error('UPDATE non valido');
    }

    const tableName = tableMatch[1].toLowerCase();
    const table = this.data[tableName];
    if (!table) throw new Error(`Tabella ${tableName} non esiste`);

    const setClauses = setMatch[1].split(',').map(s => s.trim());
    const whereClause = whereMatch[1];

    // Estrai i parametri del WHERE (gli ultimi N, dove N = numero di ? nella WHERE)
    const whereParamCount = (whereClause.match(/\?/g) || []).length;
    const whereParams = params.slice(-whereParamCount);
    const setParams = params.slice(0, setClauses.length);

    console.log(`🔧 UPDATE ${tableName}:`);
    console.log(`   SET clauses: ${setClauses.length}`);
    console.log(`   SET clauses: ${JSON.stringify(setClauses)}`);
    console.log(`   WHERE clause: ${whereClause}`);
    console.log(`   Total params: ${params.length}, Set params: ${setParams.length}, Where params: ${whereParams.length}`);
    console.log(`   Set params values:`, setParams);
    console.log(`   Where params values:`, whereParams);

    let changes = 0;
    table.forEach((row, rowIdx) => {
      const whereMatches = this.evaluateWhere(row, whereClause, whereParams);
      console.log(`   Row ${rowIdx}: id=${row.id}, whereMatches=${whereMatches}`);

      if (whereMatches) {
        console.log(`     ✓ Updating row ${rowIdx}...`);
        setClauses.forEach((setClause, idx) => {
          const [col] = setClause.split('=').map(s => s.trim());
          const oldValue = row[col];
          row[col] = setParams[idx];
          console.log(`       ${col}: ${oldValue} → ${setParams[idx]}`);
        });
        changes++;
      }
    });

    console.log(`   Result: ${changes} rows updated`);
    return { changes };
  }

  /**
   * Esegui DELETE
   */
  executeDelete(sql, params) {
    const tableMatch = sql.match(/FROM\s+(\w+)/i);
    const whereMatch = sql.match(/WHERE\s+(.+?)$/is);  // Added 's' flag for multiline

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
    // Supporta anche: (col = value OR col = value) AND col >= value
    let paramIndex = 0;
    let clause = whereClause;

    // Sostituisci i placeholder ? con i valori
    clause = clause.replace(/\?/g, () => {
      const param = params[paramIndex++];
      if (typeof param === 'string') return `'${param}'`;
      return param;
    });

    // Valuta le condizioni - separa per AND
    // Ogni AND-group può contenere OR conditions
    const andGroups = clause.split(/\s+AND\s+/i);

    return andGroups.every(andGroup => {
      // Se il group contiene OR, valuta le condizioni OR
      if (/\s+OR\s+/i.test(andGroup)) {
        // Rimuovi le parentesi esterne se presenti
        const orContent = andGroup.replace(/^\s*\(\s*/, '').replace(/\s*\)\s*$/, '');
        const orConditions = orContent.split(/\s+OR\s+/i);

        return orConditions.some(condition => {
          return this.evaluateSingleCondition(row, condition.trim());
        });
      } else {
        // Valuta una singola condizione
        return this.evaluateSingleCondition(row, andGroup.trim());
      }
    });
  }

  evaluateSingleCondition(row, condition) {
    // Estrae e valuta una singola condizione: column operator value
    // IMPORTANTE: operatori ordered from longest to shortest to match correctly (e.g. >= before >)
    const parts = condition.match(/(\w+)\s*(<=|>=|!=|=|<|>)\s*(.+)/);
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
  }
}

export default FileStorage;
