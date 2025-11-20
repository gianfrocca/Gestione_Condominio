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
    const {
      number,
      name,
      surface_area,
      is_inhabited,
      is_commercial,
      has_staircase_lights,
      monthly_water_fixed,
      monthly_elec_fixed_winter,
      monthly_elec_fixed_summer,
      monthly_gas_fixed_winter,
      monthly_gas_fixed_summer,
      foglio,
      particella,
      sub,
      notes
    } = req.body;

    const result = await runQuery(
      `INSERT INTO units (
        number, name, surface_area, is_inhabited, is_commercial,
        has_staircase_lights, monthly_water_fixed,
        monthly_elec_fixed_winter, monthly_elec_fixed_summer,
        monthly_gas_fixed_winter, monthly_gas_fixed_summer,
        foglio, particella, sub, notes
      )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        number,
        name,
        surface_area,
        is_inhabited || 1,
        is_commercial || 0,
        has_staircase_lights || 0,
        monthly_water_fixed || 0,
        monthly_elec_fixed_winter || 0,
        monthly_elec_fixed_summer || 0,
        monthly_gas_fixed_winter || 0,
        monthly_gas_fixed_summer || 0,
        foglio || null,
        particella || null,
        sub || null,
        notes || null
      ]
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
    const {
      number,
      name,
      surface_area,
      is_inhabited,
      is_commercial,
      has_staircase_lights,
      monthly_water_fixed,
      monthly_elec_fixed_winter,
      monthly_elec_fixed_summer,
      monthly_gas_fixed_winter,
      monthly_gas_fixed_summer,
      foglio,
      particella,
      sub,
      notes
    } = req.body;

    await runQuery(
      `UPDATE units
       SET number = ?, name = ?, surface_area = ?, is_inhabited = ?, is_commercial = ?,
           has_staircase_lights = ?, monthly_water_fixed = ?,
           monthly_elec_fixed_winter = ?, monthly_elec_fixed_summer = ?,
           monthly_gas_fixed_winter = ?, monthly_gas_fixed_summer = ?,
           foglio = ?, particella = ?, sub = ?, notes = ?
       WHERE id = ?`,
      [
        number,
        name,
        surface_area,
        is_inhabited,
        is_commercial,
        has_staircase_lights || 0,
        monthly_water_fixed || 0,
        monthly_elec_fixed_winter || 0,
        monthly_elec_fixed_summer || 0,
        monthly_gas_fixed_winter || 0,
        monthly_gas_fixed_summer || 0,
        foglio,
        particella,
        sub,
        notes,
        req.params.id
      ]
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
