import express from 'express';
import { allQuery, getQuery, runQuery } from '../database.js';

const router = express.Router();

// GET: Ottieni tutte le unità
router.get('/', async (req, res) => {
  try {
    const units = await allQuery('SELECT * FROM units ORDER BY number');
    res.json(units);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET: Ottieni una singola unità
router.get('/:id', async (req, res) => {
  try {
    const unit = await getQuery('SELECT * FROM units WHERE id = ?', [req.params.id]);
    if (!unit) {
      return res.status(404).json({ error: 'Unità non trovata' });
    }
    res.json(unit);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST: Crea nuova unità
router.post('/', async (req, res) => {
  try {
    const { number, name, surface_area, is_inhabited, is_commercial, notes } = req.body;

    const result = await runQuery(
      `INSERT INTO units (number, name, surface_area, is_inhabited, is_commercial, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [number, name, surface_area, is_inhabited || 1, is_commercial || 0, notes || null]
    );

    const newUnit = await getQuery('SELECT * FROM units WHERE id = ?', [result.id]);
    res.status(201).json(newUnit);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT: Aggiorna unità
router.put('/:id', async (req, res) => {
  try {
    const { number, name, surface_area, is_inhabited, is_commercial, notes } = req.body;

    await runQuery(
      `UPDATE units
       SET number = ?, name = ?, surface_area = ?, is_inhabited = ?, is_commercial = ?, notes = ?
       WHERE id = ?`,
      [number, name, surface_area, is_inhabited, is_commercial, notes, req.params.id]
    );

    const updated = await getQuery('SELECT * FROM units WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE: Elimina unità
router.delete('/:id', async (req, res) => {
  try {
    await runQuery('DELETE FROM units WHERE id = ?', [req.params.id]);
    res.json({ message: 'Unità eliminata con successo' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
