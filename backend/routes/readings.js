import express from 'express';
import { allQuery, getQuery, runQuery } from '../database.js';

const router = express.Router();

// GET: Ottieni tutte le letture o filtrate per unità/tipo/mese/meter_id
router.get('/', async (req, res) => {
  try {
    const { unit_id, meter_type, month, meter_id } = req.query;

    console.log(`🔵 GET readings called`);
    console.log(`  Query params: unit_id=${unit_id}, meter_type=${meter_type}, month=${month}, meter_id=${meter_id}`);

    // Build WHERE clause conditionally (no dummy 1=1)
    let query = `SELECT * FROM readings`;
    const params = [];
    const conditions = [];

    // CRITICAL: Filter by meter_id if provided (most specific filter)
    if (meter_id) {
      conditions.push('meter_id = ?');
      params.push(meter_id);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY reading_date DESC';

    console.log(`  Executing query with ${params.length} params:`, params);
    let readings = await allQuery(query, params);
    console.log(`  ✅ Got ${readings.length} readings`);

    // If we need to filter by unit_id or meter_type, we need to fetch meter info
    if (unit_id || meter_type) {
      console.log(`  🔎 Filtering by unit_id=${unit_id}, meter_type=${meter_type}`);

      // Build meters query conditionally (no dummy 1=1)
      let meterQuery = 'SELECT id, unit_id, type FROM meters';
      const meterParams = [];
      const meterConditions = [];

      if (unit_id) {
        meterConditions.push('unit_id = ?');
        meterParams.push(unit_id);
      }

      if (meter_type) {
        meterConditions.push('type = ?');
        meterParams.push(meter_type);
      }

      if (meterConditions.length > 0) {
        meterQuery += ' WHERE ' + meterConditions.join(' AND ');
      }

      const matchingMeters = await allQuery(meterQuery, meterParams);
      const meterIds = new Set(matchingMeters.map(m => m.id));

      // Filter readings to only those with matching meters
      readings = readings.filter(r => meterIds.has(r.meter_id));
      console.log(`  ✅ Filtered to ${readings.length} readings after meter filtering`);
    }

    // If month filter requested, apply it
    if (month) {
      readings = readings.filter(r => {
        const readingMonth = r.reading_date.substring(0, 7); // YYYY-MM
        return readingMonth === month;
      });
      console.log(`  ✅ Filtered to ${readings.length} readings after month filtering`);
    }

    // CRITICAL: Enrich readings with unit and meter information for display
    console.log(`  🔎 Enriching ${readings.length} readings with unit/meter information...`);
    const enrichedReadings = [];

    for (const reading of readings) {
      // Get meter info
      const meter = await getQuery('SELECT id, unit_id, type, meter_code FROM meters WHERE id = ?', [reading.meter_id]);

      if (meter) {
        // Get unit info
        const unit = await getQuery('SELECT id, number, name FROM units WHERE id = ?', [meter.unit_id]);

        // Enrich reading with unit/meter info
        const enriched = {
          ...reading,
          meter_id: reading.meter_id,
          meter_type: meter.type,
          meter_code: meter.meter_code,
          unit_id: meter.unit_id,
          unit_number: unit?.number || '-',
          unit_name: unit?.name || '-'
        };

        enrichedReadings.push(enriched);
        console.log(`    ✅ Enriched reading ${reading.id}: unit=${unit?.number}, name=${unit?.name}, meter_type=${meter.type}`);
      } else {
        console.warn(`    ⚠️ Meter ${reading.meter_id} not found for reading ${reading.id}`);
        // Still include the reading without unit info
        enrichedReadings.push({
          ...reading,
          meter_type: null,
          unit_id: null,
          unit_number: '-',
          unit_name: '-'
        });
      }
    }

    console.log(`  ✅ Enriched all readings with unit information`);
    res.json(enrichedReadings);
  } catch (error) {
    console.error('❌ GET readings error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST: Inserisci nuova lettura
router.post('/', async (req, res) => {
  try {
    const { meter_id, reading_date, value, notes } = req.body;

    console.log(`🔵 POST single reading: meter_id=${meter_id}, date=${reading_date}, value=${value}`);

    if (!meter_id || !reading_date || value === undefined) {
      console.error(`  ❌ Missing required fields`);
      return res.status(400).json({ error: 'Campi obbligatori: meter_id, reading_date, value' });
    }

    console.log(`  💾 Inserting reading...`);
    const result = await runQuery(
      `INSERT INTO readings (meter_id, reading_date, value, notes)
       VALUES (?, ?, ?, ?)`,
      [meter_id, reading_date, value, notes || null]
    );

    console.log(`  ✅ Reading inserted with ID: ${result.id}`);

    console.log(`  📝 Fetching created reading...`);
    const newReading = await getQuery(
      `SELECT * FROM readings WHERE id = ?`,
      [result.id]
    );

    console.log(`  📊 Got reading:`, newReading);
    res.status(201).json(newReading);
  } catch (error) {
    console.error('❌ POST single reading error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST: Inserisci letture multiple (batch)
router.post('/batch', async (req, res) => {
  try {
    const { readings } = req.body;

    console.log(`\n🔵 ===== BATCH INSERT STARTED =====`);
    console.log(`📥 Received ${readings?.length || 0} readings`);
    console.log(`📥 Full payload:`, JSON.stringify(readings, null, 2));

    if (!Array.isArray(readings) || readings.length === 0) {
      return res.status(400).json({ error: 'Array di letture richiesto' });
    }

    const results = [];
    const insertedReadings = [];

    for (const reading of readings) {
      let { meter_id, unit_id, meter_type, reading_date, value, notes } = reading;

      console.log(`\n🔍 Processing reading:`, { meter_id, unit_id, meter_type, reading_date, value });

      // Se non c'è meter_id ma ci sono unit_id e meter_type, crea o trova il meter
      if (!meter_id && unit_id && meter_type) {
        console.log(`  🔎 Searching for meter: unit_id=${unit_id}, type=${meter_type}`);

        // Cerca se esiste già un meter per questa unità e tipo
        const existingMeter = await getQuery(
          'SELECT id, unit_id, type FROM meters WHERE unit_id = ? AND type = ?',
          [unit_id, meter_type]
        );

        if (existingMeter) {
          meter_id = existingMeter.id;
          console.log(`  ✅ Found existing meter:`, existingMeter);
        } else {
          // Crea nuovo meter
          console.log(`  🆕 Creating new meter: unit_id=${unit_id}, type=${meter_type}`);
          const meterResult = await runQuery(
            'INSERT INTO meters (unit_id, type, meter_code) VALUES (?, ?, ?)',
            [unit_id, meter_type, `${meter_type}-${unit_id}`]
          );
          meter_id = meterResult.id;
          console.log(`  ✅ Meter created with ID: ${meter_id}`);
        }
      }

      if (!meter_id) {
        console.error('  ❌ No meter_id found or created for:', reading);
        continue;
      }

      // CRITICAL: Verify that the meter actually belongs to the unit and has the correct type
      const meterVerification = await getQuery(
        'SELECT id, unit_id, type FROM meters WHERE id = ?',
        [meter_id]
      );

      if (!meterVerification) {
        console.error(`  ❌ SECURITY: Meter ${meter_id} does not exist!`);
        continue;
      }

      if (meterVerification.unit_id !== unit_id) {
        console.error(`  ❌ SECURITY: Meter ${meter_id} belongs to unit ${meterVerification.unit_id}, not ${unit_id}!`);
        continue;
      }

      if (meterVerification.type !== meter_type) {
        console.error(`  ❌ SECURITY: Meter ${meter_id} is type ${meterVerification.type}, not ${meter_type}!`);
        continue;
      }

      console.log(`  ✅ Meter verification passed: meter ${meter_id} belongs to unit ${unit_id} with type ${meter_type}`);

      console.log(`  💾 Inserting reading: meter_id=${meter_id}, date=${reading_date}, value=${value}`);

      const result = await runQuery(
        `INSERT INTO readings (meter_id, reading_date, value, notes)
         VALUES (?, ?, ?, ?)`,
        [meter_id, reading_date, value, notes || null]
      );

      console.log(`  ✅ Reading inserted with ID: ${result.id}`);
      results.push(result.id);

      // Verifica cosa è stato effettivamente salvato
      const savedReading = await getQuery(
        `SELECT * FROM readings WHERE id = ?`,
        [result.id]
      );
      console.log(`  📊 Verified saved reading:`, savedReading);
      insertedReadings.push(savedReading);
    }

    console.log(`\n✅ ===== BATCH INSERT COMPLETE =====`);
    console.log(`📤 Inserted ${results.length} readings:`, insertedReadings);

    res.status(201).json({
      message: `${results.length} letture inserite con successo`,
      ids: results,
      inserted: insertedReadings
    });
  } catch (error) {
    console.error('❌ Error in batch insert:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT: Aggiorna lettura
router.put('/:id', async (req, res) => {
  try {
    const { reading_date, value, notes } = req.body;

    await runQuery(
      `UPDATE readings SET reading_date = ?, value = ?, notes = ? WHERE id = ?`,
      [reading_date, value, notes, req.params.id]
    );

    const updated = await getQuery('SELECT * FROM readings WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE: Elimina lettura
router.delete('/:id', async (req, res) => {
  try {
    await runQuery('DELETE FROM readings WHERE id = ?', [req.params.id]);
    res.json({ message: 'Lettura eliminata con successo' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET: Ottieni contabilizzatori per unità
// CRITICAL: Supporta filtro opzionale per type per prevenire cross-contamination
router.get('/meters/unit/:unit_id', async (req, res) => {
  try {
    const { type } = req.query;

    let query = 'SELECT * FROM meters WHERE unit_id = ?';
    const params = [req.params.unit_id];

    // CRITICAL: Se specificato type, filtra SOLO per quel tipo
    if (type) {
      query += ' AND type = ?';
      params.push(type);
      console.log(`🔎 GET meters: unit_id=${req.params.unit_id}, type=${type}`);
    } else {
      console.log(`🔎 GET meters: unit_id=${req.params.unit_id}, ALL TYPES`);
    }

    const meters = await allQuery(query, params);

    console.log(`📊 Found ${meters.length} meter(s) for query`);
    if (meters.length > 0) {
      meters.forEach(m => {
        console.log(`   - Meter ID ${m.id}: unit=${m.unit_id}, type=${m.type}`);
      });
    } else {
      console.log(`   ⚠️ No meters found`);
    }

    res.json(meters);
  } catch (error) {
    console.error('❌ Error getting meters:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
