import express from 'express';
import { calculateMonthlySplit } from '../utils/calculator.js';
import { allQuery, runQuery } from '../database.js';

const router = express.Router();

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

    // Salva nel database lo storico (usa data inizio come riferimento)
    for (const unit of result.units) {
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

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET: Ottieni storico ripartizioni
router.get('/history', async (req, res) => {
  try {
    const { month, unit_id, year } = req.query;

    let query = `
      SELECT ms.*, u.number as unit_number, u.name as unit_name
      FROM monthly_splits ms
      JOIN units u ON ms.unit_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (month) {
      query += ' AND strftime("%Y-%m", ms.month) = ?';
      params.push(month);
    }

    if (year) {
      query += ' AND strftime("%Y", ms.month) = ?';
      params.push(year);
    }

    if (unit_id) {
      query += ' AND ms.unit_id = ?';
      params.push(unit_id);
    }

    query += ' ORDER BY ms.month DESC, u.number';

    const history = await allQuery(query, params);
    res.json(history);
  } catch (error) {
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
