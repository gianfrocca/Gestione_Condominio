import express from 'express';
import { allQuery, getQuery, runQuery } from '../database.js';

const router = express.Router();

// GET: Ottieni tutte le impostazioni
router.get('/', async (req, res) => {
  try {
    const settings = await allQuery('SELECT * FROM settings ORDER BY key');
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET: Ottieni singola impostazione
router.get('/:key', async (req, res) => {
  try {
    const setting = await getQuery('SELECT * FROM settings WHERE key = ?', [req.params.key]);
    if (!setting) {
      return res.status(404).json({ error: 'Impostazione non trovata' });
    }
    res.json(setting);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT: Aggiorna impostazione
router.put('/:key', async (req, res) => {
  try {
    const { value, description } = req.body;

    await runQuery(
      `UPDATE settings SET value = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?`,
      [value, description, req.params.key]
    );

    const updated = await getQuery('SELECT * FROM settings WHERE key = ?', [req.params.key]);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST: Crea nuova impostazione
router.post('/', async (req, res) => {
  try {
    const { key, value, description } = req.body;

    await runQuery(
      `INSERT INTO settings (key, value, description) VALUES (?, ?, ?)`,
      [key, value, description || null]
    );

    const newSetting = await getQuery('SELECT * FROM settings WHERE key = ?', [key]);
    res.status(201).json(newSetting);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT: Aggiorna multiple impostazioni
router.put('/', async (req, res) => {
  try {
    const { settings } = req.body;

    if (!Array.isArray(settings)) {
      return res.status(400).json({ error: 'Array di impostazioni richiesto' });
    }

    for (const setting of settings) {
      await runQuery(
        `UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?`,
        [setting.value, setting.key]
      );
    }

    const updated = await allQuery('SELECT * FROM settings ORDER BY key');
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
