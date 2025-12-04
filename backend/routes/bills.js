import express from 'express';
import multer from 'multer';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { allQuery, getQuery, runQuery } from '../database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Configurazione multer per upload file
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, join(__dirname, '../../data/bills'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + '.pdf');
  }
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    if (file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo file PDF o immagini sono permessi'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  }
});

// GET: Ottieni tutte le bollette o filtrate
router.get('/', async (req, res) => {
  try {
    const { type, month, year } = req.query;

    let query = 'SELECT * FROM bills WHERE 1=1';
    const params = [];

    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }

    if (month) {
      query += ' AND strftime("%Y-%m", bill_date) = ?';
      params.push(month);
    }

    if (year) {
      query += ' AND strftime("%Y", bill_date) = ?';
      params.push(year);
    }

    query += ' ORDER BY bill_date DESC';

    const bills = await allQuery(query, params);
    res.json(bills);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET: Ottieni singola bolletta
router.get('/:id', async (req, res) => {
  try {
    const bill = await getQuery('SELECT * FROM bills WHERE id = ?', [req.params.id]);
    if (!bill) {
      return res.status(404).json({ error: 'Bolletta non trovata' });
    }
    res.json(bill);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST: Inserisci nuova bolletta
router.post('/', upload.single('file'), async (req, res) => {
  try {
    const { bill_date, type, amount, provider, bill_period_start, bill_period_end, notes } = req.body;

    if (!bill_date || !type || !amount) {
      return res.status(400).json({ error: 'Campi obbligatori: bill_date, type, amount' });
    }

    const filePath = req.file ? req.file.path : null;

    const result = await runQuery(
      `INSERT INTO bills (bill_date, type, amount, provider, bill_period_start, bill_period_end, file_path, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [bill_date, type, parseFloat(amount), provider, bill_period_start, bill_period_end, filePath, notes]
    );

    const newBill = await getQuery('SELECT * FROM bills WHERE id = ?', [result.id]);
    res.status(201).json(newBill);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT: Aggiorna bolletta
router.put('/:id', async (req, res) => {
  try {
    const { bill_date, type, amount, provider, bill_period_start, bill_period_end, notes } = req.body;

    await runQuery(
      `UPDATE bills
       SET bill_date = ?, type = ?, amount = ?, provider = ?, bill_period_start = ?, bill_period_end = ?, notes = ?
       WHERE id = ?`,
      [bill_date, type, parseFloat(amount), provider, bill_period_start, bill_period_end, notes, req.params.id]
    );

    const updated = await getQuery('SELECT * FROM bills WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE: Elimina bolletta
router.delete('/:id', async (req, res) => {
  try {
    await runQuery('DELETE FROM bills WHERE id = ?', [req.params.id]);
    res.json({ message: 'Bolletta eliminata con successo' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET: Download file bolletta
router.get('/:id/file', async (req, res) => {
  try {
    const bill = await getQuery('SELECT file_path FROM bills WHERE id = ?', [req.params.id]);

    if (!bill || !bill.file_path) {
      return res.status(404).json({ error: 'File non trovato' });
    }

    res.sendFile(bill.file_path);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
