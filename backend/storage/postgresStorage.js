/**
 * PostgreSQL Storage Implementation
 * Usa il driver pg per PostgreSQL
 */

import pg from 'pg';

const { Pool } = pg;

class PostgresStorage {
  constructor() {
    this.pool = null;
  }

  /**
   * Inizializza la connessione a PostgreSQL
   */
  async initialize() {
    try {
      const poolConfig = this.buildPoolConfig();

      this.pool = new Pool(poolConfig);

      this.pool.on('error', (err) => {
        console.error('Errore pool PostgreSQL:', err.message);
      });

      // Testa la connessione
      await this.pool.query('SELECT NOW()');
      console.log('✅ Connesso a PostgreSQL');
    } catch (error) {
      console.error('❌ Errore connessione PostgreSQL:', error);
      throw error;
    }
  }

  /**
   * Costruisce la configurazione del pool
   */
  buildPoolConfig() {
    // Se DB_HOST è una URL PostgreSQL completa, usala come connectionString
    if (process.env.DB_HOST && process.env.DB_HOST.startsWith('postgres://')) {
      return {
        connectionString: process.env.DB_HOST,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      };
    }

    // Altrimenti usa parametri singoli
    return {
      user: process.env.DB_USER || 'condominio_user',
      password: process.env.DB_PASSWORD || 'password',
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'condominio_db',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    };
  }

  /**
   * Esegui SELECT che ritorna multiple righe
   */
  async allQuery(sql, params = []) {
    try {
      const result = await this.pool.query(sql, params);
      return result.rows;
    } catch (err) {
      console.error('❌ Errore allQuery:', err);
      throw err;
    }
  }

  /**
   * Esegui SELECT che ritorna un singolo record
   */
  async getQuery(sql, params = []) {
    try {
      const result = await this.pool.query(sql, params);
      return result.rows.length > 0 ? result.rows[0] : undefined;
    } catch (err) {
      console.error('❌ Errore getQuery:', err);
      throw err;
    }
  }

  /**
   * Esegui INSERT/UPDATE/DELETE
   */
  async runQuery(sql, params = []) {
    try {
      const result = await this.pool.query(sql, params);
      // PostgreSQL: per INSERT con RETURNING id, il valore è in result.rows[0].id
      const id = result.rows.length > 0 && result.rows[0].id ? result.rows[0].id : null;
      return { id, changes: result.rowCount };
    } catch (err) {
      console.error('❌ Errore runQuery:', err);
      throw err;
    }
  }

  /**
   * Chiudi la connessione
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
    }
  }
}

export default PostgresStorage;
