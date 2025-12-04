import express from 'express';
import { allQuery, getQuery, runQuery } from '../database.js';

const router = express.Router();

// GET: Ottieni tutte le letture o filtrate per unità/tipo/mese/meter_id
router.get('/', async (req, res) => {
  try {
    const { unit_id, meter_type, month, meter_id } = req.query;

    let query = `
      SELECT r.*, m.type as meter_type, m.meter_code, u.number as unit_number, u.name as unit_name
      FROM readings r
      JOIN meters m ON r.meter_id = m.id
      JOIN units u ON m.unit_id = u.id
      WHERE 1=1
    `;
    const params = [];

    // CRITICAL: Filter by meter_id if provided (most specific filter)
    if (meter_id) {
      query += ' AND r.meter_id = $1';
      params.push(meter_id);
    }

    if (unit_id) {
      query += ' AND u.id = $1';
      params.push(unit_id);
    }

    if (meter_type) {
      query += ' AND m.type = $1';
      params.push(meter_type);
    }

    if (month) {
      query += ' AND strftime("%Y-%m", r.reading_date) = $1';
      params.push(month);
    }

    query += ' ORDER BY r.reading_date DESC, u.number';

    const readings = await allQuery(query, params);
    res.json(readings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST: Inserisci nuova lettura
router.post('/', async (req, res) => {
  try {
    const { meter_id, reading_date, value, notes } = req.body;

    if (!meter_id || !reading_date || value === undefined) {
      return res.status(400).json({ error: 'Campi obbligatori: meter_id, reading_date, value' });
    }

    const result = await runQuery(
      `INSERT INTO readings (meter_id, reading_date, value, notes)
       VALUES ($1, $2, $3, $4)`,
      [meter_id, reading_date, value, notes || null]
    );

    const newReading = await getQuery(
      `SELECT r.*, m.type as meter_type, u.number as unit_number
       FROM readings r
       JOIN meters m ON r.meter_id = m.id
       JOIN units u ON m.unit_id = u.id
       WHERE r.id = $1`,
      [result.id]
    );

    res.status(201).json(newReading);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST: Inserisci letture multiple (batch)
router.post('/batch', async (req, res) => {
  try {
    const { readings } = req.body;

    console.log(`\n🔵 ===== BATCH INSERT STARTED =====`);
    console.log(`📥 Received ${readings$1.length || 0} readings`);
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
          'SELECT id, unit_id, type FROM meters WHERE unit_id = $1 AND type = $2',
          [unit_id, meter_type]
        );

        if (existingMeter) {
          meter_id = existingMeter.id;
          console.log(`  ✅ Found existing meter:`, existingMeter);
        } else {
          // Crea nuovo meter
          console.log(`  🆕 Creating new meter: unit_id=${unit_id}, type=${meter_type}`);
          const meterResult = await runQuery(
            'INSERT INTO meters (unit_id, type, meter_code) VALUES ($1, $2, $3)',
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
        'SELECT id, unit_id, type FROM meters WHERE id = $1',
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
         VALUES ($1, $2, $3, $4)`,
        [meter_id, reading_date, value, notes || null]
      );

      console.log(`  ✅ Reading inserted with ID: ${result.id}`);
      results.push(result.id);

      // Verifica cosa è stato effettivamente salvato
      const savedReading = await getQuery(
        `SELECT r.*, m.unit_id, m.type as meter_type
         FROM readings r
         JOIN meters m ON r.meter_id = m.id
         WHERE r.id = $1`,
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
      `UPDATE readings SET reading_date = $1, value = $2, notes = $3 WHERE id = $4`,
      [reading_date, value, notes, req.params.id]
    );

    const updated = await getQuery('SELECT * FROM readings WHERE id = $1', [req.params.id]);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE: Elimina lettura
router.delete('/:id', async (req, res) => {
  try {
    await runQuery('DELETE FROM readings WHERE id = $1', [req.params.id]);
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

    let query = 'SELECT * FROM meters WHERE unit_id = $1';
    const params = [req.params.unit_id];

    // CRITICAL: Se specificato type, filtra SOLO per quel tipo
    if (type) {
      query += ' AND type = $1';
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
