import express from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';
import { calculateMonthlySplit } from '../utils/calculator.js';
import { generateMonthlyReport, generateAnnualReport } from '../utils/pdfGenerator.js';
import { allQuery } from '../database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Assicurati che la directory reports esista
const reportsDir = join(__dirname, '../../data/reports');
if (!existsSync(reportsDir)) {
  mkdirSync(reportsDir, { recursive: true });
}

// POST: Genera report periodo PDF
router.post('/monthly', async (req, res) => {
  try {
    const { dateFrom, dateTo, type = 'both' } = req.body;

    if (!dateFrom || !dateTo) {
      return res.status(400).json({ error: 'Parametri dateFrom e dateTo richiesti (formato: YYYY-MM-DD)' });
    }

    // Calcola ripartizione
    const data = await calculateMonthlySplit(dateFrom, dateTo, type);

    // Genera PDF
    const filename = `report-${dateFrom}_${dateTo}_${type}.pdf`;
    const outputPath = join(reportsDir, filename);

    await generateMonthlyReport(data, outputPath);

    // Invia il file
    res.download(outputPath, filename, (err) => {
      if (err) {
        console.error('Errore invio PDF:', err);
        res.status(500).json({ error: 'Errore generazione PDF' });
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET: Genera report annuale PDF
router.get('/annual/:year', async (req, res) => {
  try {
    const { year } = req.params;

    // Ottieni dati annuali
    const data = await allQuery(
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

    if (data.length === 0) {
      return res.status(404).json({ error: 'Nessun dato trovato per l\'anno specificato' });
    }

    // Genera PDF
    const filename = `report-annuale-${year}.pdf`;
    const outputPath = join(reportsDir, filename);

    await generateAnnualReport(data, year, outputPath);

    // Invia il file
    res.download(outputPath, filename, (err) => {
      if (err) {
        console.error('Errore invio PDF:', err);
        res.status(500).json({ error: 'Errore generazione PDF' });
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET: Lista report generati
router.get('/list', async (req, res) => {
  try {
    const { readdirSync } = await import('fs');
    const files = readdirSync(reportsDir)
      .filter(f => f.endsWith('.pdf'))
      .map(f => ({
        filename: f,
        path: `/api/reports/download/${f}`
      }));

    res.json(files);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET: Download report esistente
router.get('/download/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const filepath = join(reportsDir, filename);

    if (!existsSync(filepath)) {
      return res.status(404).json({ error: 'Report non trovato' });
    }

    res.download(filepath, filename);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
