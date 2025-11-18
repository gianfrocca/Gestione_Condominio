import express from 'express';
import { runQuery, getQuery, allQuery } from '../database.js';

const router = express.Router();

// GET /api/payments - Ottieni tutti i pagamenti
router.get('/', async (req, res) => {
  try {
    const { unit_id, start_date, end_date } = req.query;

    let sql = `
      SELECT p.*, u.number as unit_number, u.name as unit_name
      FROM payments p
      JOIN units u ON p.unit_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (unit_id) {
      sql += ' AND p.unit_id = ?';
      params.push(unit_id);
    }

    if (start_date) {
      sql += ' AND p.payment_date >= ?';
      params.push(start_date);
    }

    if (end_date) {
      sql += ' AND p.payment_date <= ?';
      params.push(end_date);
    }

    sql += ' ORDER BY p.payment_date DESC';

    const payments = await allQuery(sql, params);
    res.json(payments);
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/payments/:id - Ottieni un pagamento specifico
router.get('/:id', async (req, res) => {
  try {
    const payment = await getQuery(
      `SELECT p.*, u.number as unit_number, u.name as unit_name
       FROM payments p
       JOIN units u ON p.unit_id = u.id
       WHERE p.id = ?`,
      [req.params.id]
    );

    if (!payment) {
      return res.status(404).json({ error: 'Pagamento non trovato' });
    }

    res.json(payment);
  } catch (error) {
    console.error('Error fetching payment:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/payments - Crea nuovo pagamento
router.post('/', async (req, res) => {
  try {
    const { unit_id, payment_date, amount, payment_type, reference_month, notes } = req.body;

    if (!unit_id || !payment_date || !amount) {
      return res.status(400).json({
        error: 'unit_id, payment_date e amount sono obbligatori'
      });
    }

    const result = await runQuery(
      `INSERT INTO payments (unit_id, payment_date, amount, payment_type, reference_month, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [unit_id, payment_date, amount, payment_type || null, reference_month || null, notes || null]
    );

    const newPayment = await getQuery(
      `SELECT p.*, u.number as unit_number, u.name as unit_name
       FROM payments p
       JOIN units u ON p.unit_id = u.id
       WHERE p.id = ?`,
      [result.id]
    );

    res.status(201).json(newPayment);
  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/payments/:id - Aggiorna pagamento
router.put('/:id', async (req, res) => {
  try {
    const { unit_id, payment_date, amount, payment_type, reference_month, notes } = req.body;

    await runQuery(
      `UPDATE payments
       SET unit_id = ?, payment_date = ?, amount = ?, payment_type = ?,
           reference_month = ?, notes = ?
       WHERE id = ?`,
      [unit_id, payment_date, amount, payment_type || null, reference_month || null, notes || null, req.params.id]
    );

    const updated = await getQuery(
      `SELECT p.*, u.number as unit_number, u.name as unit_name
       FROM payments p
       JOIN units u ON p.unit_id = u.id
       WHERE p.id = ?`,
      [req.params.id]
    );

    res.json(updated);
  } catch (error) {
    console.error('Error updating payment:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/payments/:id - Elimina pagamento
router.delete('/:id', async (req, res) => {
  try {
    const result = await runQuery('DELETE FROM payments WHERE id = ?', [req.params.id]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Pagamento non trovato' });
    }

    res.json({ message: 'Pagamento eliminato con successo' });
  } catch (error) {
    console.error('Error deleting payment:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/payments/summary-all - Riepilogo generale di tutti i pagamenti (DEVE stare prima di summary/:unit_id)
router.get('/summary-all', async (req, res) => {
  try {
    const units = await allQuery('SELECT id, number, name FROM units');

    const summaries = await Promise.all(
      units.map(async (unit) => {
        // Totale pagato
        const paidResult = await getQuery(
          `SELECT COALESCE(SUM(amount), 0) as total_paid
           FROM payments
           WHERE unit_id = ?`,
          [unit.id]
        );

        // Totale dovuto
        const dueResult = await getQuery(
          `SELECT COALESCE(SUM(total_cost), 0) as total_due
           FROM monthly_splits
           WHERE unit_id = ?`,
          [unit.id]
        );

        const totalPaid = paidResult?.total_paid || 0;
        const totalDue = dueResult?.total_due || 0;
        const balance = totalPaid - totalDue;

        return {
          unit_id: unit.id,
          unit_number: unit.number,
          unit_name: unit.name,
          total_paid: totalPaid,
          total_due: totalDue,
          balance: balance,
          status: balance >= 0 ? 'in_credito' : 'in_debito'
        };
      })
    );

    res.json(summaries);
  } catch (error) {
    console.error('Error fetching payments summary:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/payments/summary/:unit_id - Riepilogo pagamenti per unità
router.get('/summary/:unit_id', async (req, res) => {
  try {
    const { unit_id } = req.params;

    // Totale pagato
    const paidResult = await getQuery(
      `SELECT COALESCE(SUM(amount), 0) as total_paid
       FROM payments
       WHERE unit_id = ?`,
      [unit_id]
    );

    // Totale dovuto (dalla tabella monthly_splits)
    const dueResult = await getQuery(
      `SELECT COALESCE(SUM(total_cost), 0) as total_due
       FROM monthly_splits
       WHERE unit_id = ?`,
      [unit_id]
    );

    const totalPaid = paidResult?.total_paid || 0;
    const totalDue = dueResult?.total_due || 0;
    const balance = totalPaid - totalDue;

    res.json({
      unit_id: parseInt(unit_id),
      total_paid: totalPaid,
      total_due: totalDue,
      balance: balance,
      status: balance >= 0 ? 'in_credito' : 'in_debito'
    });
  } catch (error) {
    console.error('Error fetching payment summary:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
