/**
 * Storage Layer Abstraction
 * Sceglie automaticamente tra File Storage e PostgreSQL Storage
 * based on STORAGE_TYPE environment variable
 */

import FileStorage from './fileStorage.js';
import PostgresStorage from './postgresStorage.js';

let storage;

/**
 * Inizializza lo storage layer
 */
export const initializeStorage = async () => {
  const storageType = process.env.STORAGE_TYPE || 'file';

  console.log(`🔧 Inizializzazione storage: ${storageType}`);

  if (storageType === 'postgresql') {
    storage = new PostgresStorage();
    await storage.initialize();
  } else {
    // Default: File storage
    storage = new FileStorage();
    await storage.initialize();
  }

  console.log(`✅ Storage layer inizializzato: ${storageType}`);
};

/**
 * Esegui una query che ritorna MULTIPLE righe
 * @param {string} sql - SQL query
 * @param {array} params - Query parameters
 * @returns {Promise<Array>} Array di risultati
 */
export const allQuery = async (sql, params = []) => {
  if (!storage) {
    throw new Error('Storage non inizializzato. Chiama initializeStorage() prima.');
  }
  return storage.allQuery(sql, params);
};

/**
 * Esegui una query che ritorna UN SINGOLO risultato
 * @param {string} sql - SQL query
 * @param {array} params - Query parameters
 * @returns {Promise<Object|undefined>} Un record o undefined
 */
export const getQuery = async (sql, params = []) => {
  if (!storage) {
    throw new Error('Storage non inizializzato. Chiama initializeStorage() prima.');
  }
  return storage.getQuery(sql, params);
};

/**
 * Esegui una query di INSERT/UPDATE/DELETE
 * @param {string} sql - SQL query
 * @param {array} params - Query parameters
 * @returns {Promise<Object>} { id: lastInsertId, changes: rowCount }
 */
export const runQuery = async (sql, params = []) => {
  if (!storage) {
    throw new Error('Storage non inizializzato. Chiama initializeStorage() prima.');
  }
  return storage.runQuery(sql, params);
};

/**
 * Ottieni l'istanza di storage per operazioni avanzate
 */
export const getStorageInstance = () => {
  return storage;
};

/**
 * Ricarica i dati dello storage dal file (per sincronizzazione dopo import)
 */
export const reloadStorage = async () => {
  if (!storage) {
    throw new Error('Storage non inizializzato. Chiama initializeStorage() prima.');
  }
  if (storage.reload) {
    await storage.reload();
  }
};

export default {
  initializeStorage,
  allQuery,
  getQuery,
  runQuery,
  getStorageInstance,
  reloadStorage
};
