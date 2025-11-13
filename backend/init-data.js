/**
 * Script per inizializzare dati di esempio
 * Eseguito automaticamente al primo avvio
 */

import { runQuery, getQuery, allQuery } from './database.js';

export async function initializeSampleData() {
  try {
    // Controlla se esistono già unità
    const existing = await allQuery('SELECT COUNT(*) as count FROM units');

    if (existing[0].count > 0) {
      console.log('✅ Dati già inizializzati');
      return;
    }

    console.log('📦 Inizializzazione dati di esempio...');

    // Unità residenziali
    const units = [
      { number: 'Sub 1', name: 'Appartamento 1', surface: 122, inhabited: 1, commercial: 0 },
      { number: 'Sub 2', name: 'Appartamento 2', surface: 52, inhabited: 1, commercial: 0 },
      { number: 'Sub 3', name: 'Appartamento 3', surface: 70, inhabited: 1, commercial: 0 },
      { number: 'Sub 4', name: 'Appartamento 4', surface: 104, inhabited: 0, commercial: 0 },
      { number: 'Comm', name: 'Negozio', surface: 60, inhabited: 1, commercial: 1 }
    ];

    for (const unit of units) {
      const result = await runQuery(
        `INSERT INTO units (number, name, surface_area, is_inhabited, is_commercial)
         VALUES (?, ?, ?, ?, ?)`,
        [unit.number, unit.name, unit.surface, unit.inhabited, unit.commercial]
      );

      console.log(`   ✓ Creata unità: ${unit.number} - ${unit.name}`);

      // Crea contabilizzatori per l'unità
      if (!unit.commercial) {
        // Riscaldamento
        await runQuery(
          `INSERT INTO meters (unit_id, type, description) VALUES (?, ?, ?)`,
          [result.id, 'heating', `Contabilizzatore riscaldamento ${unit.number}`]
        );

        // Acqua calda
        await runQuery(
          `INSERT INTO meters (unit_id, type, description) VALUES (?, ?, ?)`,
          [result.id, 'hot_water', `Contabilizzatore ACS ${unit.number}`]
        );
      }

      // Acqua fredda (tutti)
      await runQuery(
        `INSERT INTO meters (unit_id, type, description) VALUES (?, ?, ?)`,
        [result.id, 'cold_water', `Contabilizzatore ACF ${unit.number}`]
      );
    }

    console.log('✅ Dati di esempio inizializzati con successo');
    console.log('');
    console.log('📝 Prossimi passi:');
    console.log('   1. Vai su Impostazioni per verificare i parametri');
    console.log('   2. Inserisci le prime letture dei contabilizzatori');
    console.log('   3. Carica le bollette del mese');
    console.log('   4. Calcola la ripartizione e genera il report PDF');
    console.log('');
  } catch (error) {
    console.error('❌ Errore inizializzazione dati:', error);
  }
}
