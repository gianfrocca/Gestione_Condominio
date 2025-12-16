import express from 'express';
import { calculateMonthlySplit } from '../utils/calculator.js';
import { allQuery, runQuery, getQuery } from '../database.js';
import { getDebugCalculation, runCalculationTests } from '../controllers/debugController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Tutte le route richiedono autenticazione
router.use(authenticate);

// GET: Debug calculation - dettaglio completo dei calcoli (solo admin)
router.get('/debug', getDebugCalculation);

// POST: Esegui test di verifica logica calcoli (solo admin)
router.post('/debug/run-tests', runCalculationTests);

// POST: Calcola ripartizione per un periodo personalizzato
router.post('/calculate', async (req, res) => {
  try {
    const { dateFrom, dateTo, type = 'both' } = req.body;

    // Validazione parametri
    if (!dateFrom || !dateTo) {
      return res.status(400).json({ error: 'Parametri dateFrom e dateTo richiesti (formato: YYYY-MM-DD)' });
    }

    // Valida formato date
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateFrom) || !dateRegex.test(dateTo)) {
      return res.status(400).json({ error: 'Formato date non valido. Usa YYYY-MM-DD' });
    }

    // Valida che dateFrom <= dateTo
    if (new Date(dateFrom) > new Date(dateTo)) {
      return res.status(400).json({ error: 'La data iniziale deve essere precedente o uguale alla data finale' });
    }

    // Valida type
    if (!['gas', 'electricity', 'both'].includes(type)) {
      return res.status(400).json({ error: 'Parametro type deve essere: gas, electricity o both' });
    }

    const result = await calculateMonthlySplit(dateFrom, dateTo, type);

    // Pulisci NaN e Infinity dai risultati (JSON non supporta questi valori)
    const cleanResult = JSON.parse(JSON.stringify(result, (key, value) => {
      if (typeof value === 'number') {
        if (!isFinite(value)) return 0; // NaN, Infinity → 0
      }
      return value;
    }));

    // Salva nel database lo storico (usa data inizio come riferimento)
    for (const unit of cleanResult.units) {
      await runQuery(
        `INSERT OR REPLACE INTO monthly_splits
         (month, unit_id, cost_gas_heating, cost_gas_hot_water, cost_elec_heating,
          cost_elec_hot_water, cost_elec_cooling, cost_elec_cold_water, cost_elec_fixed, total_cost)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          dateFrom,
          unit.unit_id,
          unit.costs.gas_heating,
          unit.costs.gas_hot_water,
          unit.costs.elec_heating,
          unit.costs.elec_hot_water,
          unit.costs.elec_cooling,
          unit.costs.elec_cold_water,
          unit.costs.elec_fixed,
          unit.costs.total
        ]
      );
    }

    res.json(cleanResult);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET: Ottieni storico ripartizioni
router.get('/history', async (req, res) => {
  try {
    const { month, unit_id, year } = req.query;

    // Ottieni i monthly_splits
    let allSplits = await allQuery('SELECT * FROM monthly_splits ORDER BY month DESC, unit_id');

    // Filtra per month se specificato (formato YYYY-MM)
    if (month) {
      allSplits = allSplits.filter(split => {
        const splitMonth = split.month.substring(0, 7); // Estrai YYYY-MM
        return splitMonth === month;
      });
    }

    // Filtra per year se specificato (formato YYYY)
    if (year) {
      allSplits = allSplits.filter(split => {
        const splitYear = split.month.substring(0, 4); // Estrai YYYY
        return splitYear === year;
      });
    }

    // Filtra per unit_id se specificato
    if (unit_id) {
      allSplits = allSplits.filter(split => split.unit_id == unit_id);
    }

    // Enrichisci con unit information (JOIN manuale)
    const enrichedSplits = [];
    for (const split of allSplits) {
      const unit = await getQuery('SELECT id, number, name FROM units WHERE id = ?', [split.unit_id]);

      if (unit) {
        enrichedSplits.push({
          ...split,
          unit_number: unit.number,
          unit_name: unit.name
        });
      } else {
        enrichedSplits.push({
          ...split,
          unit_number: '-',
          unit_name: '-'
        });
      }
    }

    console.log(`GET /history: Returning ${enrichedSplits.length} splits (month=${month}, year=${year}, unit_id=${unit_id})`);
    res.json(enrichedSplits);
  } catch (error) {
    console.error('❌ GET /history error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET: Ottieni riepilogo annuale
router.get('/annual-summary/:year', async (req, res) => {
  try {
    const { year } = req.params;

    const summary = await allQuery(
      `SELECT
         u.number as unit_number,
         u.name as unit_name,
         SUM(ms.cost_gas_heating + ms.cost_gas_hot_water) as total_gas,
         SUM(ms.cost_elec_heating + ms.cost_elec_hot_water + ms.cost_elec_cooling +
             ms.cost_elec_cold_water + ms.cost_elec_fixed) as total_elec,
         SUM(ms.total_cost) as total_cost,
         COUNT(*) as months_count
       FROM monthly_splits ms
       JOIN units u ON ms.unit_id = u.id
       WHERE strftime("%Y", ms.month) = ?
       GROUP BY ms.unit_id, u.number, u.name
       ORDER BY u.number`,
      [year]
    );

    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET: Ottieni statistiche mensili
router.get('/monthly-stats/:month', async (req, res) => {
  try {
    const { month } = req.params;

    const stats = await allQuery(
      `SELECT
         u.number as unit_number,
         u.name as unit_name,
         ms.total_cost,
         ms.cost_gas_heating + ms.cost_gas_hot_water as total_gas,
         ms.cost_elec_heating + ms.cost_elec_hot_water + ms.cost_elec_cooling +
         ms.cost_elec_cold_water + ms.cost_elec_fixed as total_elec
       FROM monthly_splits ms
       JOIN units u ON ms.unit_id = u.id
       WHERE strftime("%Y-%m", ms.month) = ?
       ORDER BY u.number`,
      [month]
    );

    const totals = stats.reduce((acc, row) => ({
      total_cost: acc.total_cost + row.total_cost,
      total_gas: acc.total_gas + row.total_gas,
      total_elec: acc.total_elec + row.total_elec
    }), { total_cost: 0, total_gas: 0, total_elec: 0 });

    res.json({
      month: month,
      units: stats,
      totals: totals
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
