import express from 'express';
import bcrypt from 'bcrypt';
import { allQuery, getQuery, runQuery } from '../database.js';
import { authenticate, authorize, filterByCondominium } from '../middleware/auth.js';

const router = express.Router();

// Tutte le route richiedono autenticazione
router.use(authenticate);

/**
 * GET /api/users
 * Ottieni tutti gli utenti del condominio
 * Super-admin vede tutti, admin/gestore vedono solo il proprio condominio
 */
router.get('/', filterByCondominium, async (req, res) => {
  try {
    let query = `
      SELECT u.id, u.condominium_id, u.username, u.email, u.role, u.unit_id,
             u.full_name, u.phone, u.is_active, u.last_login, u.created_at,
             c.name as condominium_name,
             un.number as unit_number
      FROM users u
      LEFT JOIN condominiums c ON u.condominium_id = c.id
      LEFT JOIN units un ON u.unit_id = un.id
      WHERE 1=1
    `;
    const params = [];

    // Se non è super-admin, filtra per condominio
    if (req.condominiumId) {
      query += ' AND u.condominium_id = ?';
      params.push(req.condominiumId);
    }

    query += ' ORDER BY u.created_at DESC';

    const users = await allQuery(query, params);
    res.json(users);

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      error: 'Errore server',
      message: error.message
    });
  }
});

/**
 * GET /api/users/:id
 * Ottieni un singolo utente
 */
router.get('/:id', async (req, res) => {
  try {
    const user = await getQuery(
      `SELECT u.id, u.condominium_id, u.username, u.email, u.role, u.unit_id,
              u.full_name, u.phone, u.is_active, u.last_login, u.created_at,
              c.name as condominium_name,
              un.number as unit_number
       FROM users u
       LEFT JOIN condominiums c ON u.condominium_id = c.id
       LEFT JOIN units un ON u.unit_id = un.id
       WHERE u.id = ?`,
      [req.params.id]
    );

    if (!user) {
      return res.status(404).json({
        error: 'Utente non trovato'
      });
    }

    // Verifica permessi: super-admin vede tutto, altri solo il proprio condominio
    if (req.user.role !== 'super_admin' && user.condominium_id !== req.user.condominium_id) {
      return res.status(403).json({
        error: 'Accesso negato',
        message: 'Non puoi accedere agli utenti di altri condomini'
      });
    }

    res.json(user);

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      error: 'Errore server',
      message: error.message
    });
  }
});

/**
 * POST /api/users
 * Crea un nuovo utente
 * Solo admin e super-admin possono creare utenti
 */
router.post('/', authorize('super_admin', 'admin'), async (req, res) => {
  try {
    const {
      username,
      password,
      email,
      role,
      condominium_id,
      unit_id,
      full_name,
      phone
    } = req.body;

    // Validazione
    if (!username || !password || !email || !role) {
      return res.status(400).json({
        error: 'Dati mancanti',
        message: 'Username, password, email e role sono richiesti'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'Password non valida',
        message: 'La password deve essere di almeno 6 caratteri'
      });
    }

    const validRoles = ['super_admin', 'admin', 'gestore', 'inquilino'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        error: 'Ruolo non valido',
        message: `Il ruolo deve essere uno tra: ${validRoles.join(', ')}`
      });
    }

    // Solo super-admin può creare altri super-admin
    if (role === 'super_admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        error: 'Accesso negato',
        message: 'Solo un super-admin può creare altri super-admin'
      });
    }

    // Admin può creare utenti solo nel proprio condominio
    let finalCondominiumId = condominium_id;
    if (req.user.role === 'admin') {
      finalCondominiumId = req.user.condominium_id;
    }

    // Verifica che lo username non esista già
    const existingUser = await getQuery(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );

    if (existingUser) {
      return res.status(409).json({
        error: 'Username già esistente',
        message: 'Scegli un altro username'
      });
    }

    // Hash della password
    const passwordHash = await bcrypt.hash(password, 10);

    // Inserisci l'utente
    const result = await runQuery(
      `INSERT INTO users (condominium_id, username, password_hash, email, role, unit_id, full_name, phone, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [finalCondominiumId, username, passwordHash, email, role, unit_id || null, full_name || null, phone || null]
    );

    // Ottieni l'utente appena creato
    const newUser = await getQuery(
      `SELECT u.id, u.condominium_id, u.username, u.email, u.role, u.unit_id,
              u.full_name, u.phone, u.is_active, u.created_at
       FROM users u
       WHERE u.id = ?`,
      [result.id]
    );

    res.status(201).json({
      message: 'Utente creato con successo',
      user: newUser
    });

  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      error: 'Errore server',
      message: error.message
    });
  }
});

/**
 * PUT /api/users/:id
 * Aggiorna un utente
 */
router.put('/:id', authorize('super_admin', 'admin'), async (req, res) => {
  try {
    const {
      email,
      role,
      condominium_id,
      unit_id,
      full_name,
      phone,
      is_active
    } = req.body;

    // Verifica che l'utente esista
    const user = await getQuery('SELECT * FROM users WHERE id = ?', [req.params.id]);

    if (!user) {
      return res.status(404).json({
        error: 'Utente non trovato'
      });
    }

    // Admin può modificare solo utenti del proprio condominio
    if (req.user.role === 'admin' && user.condominium_id !== req.user.condominium_id) {
      return res.status(403).json({
        error: 'Accesso negato',
        message: 'Non puoi modificare utenti di altri condomini'
      });
    }

    // Solo super-admin può modificare super-admin
    if (user.role === 'super_admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        error: 'Accesso negato',
        message: 'Solo un super-admin può modificare altri super-admin'
      });
    }

    // Aggiorna l'utente
    await runQuery(
      `UPDATE users
       SET email = ?, role = ?, condominium_id = ?, unit_id = ?,
           full_name = ?, phone = ?, is_active = ?
       WHERE id = ?`,
      [
        email || user.email,
        role || user.role,
        condominium_id !== undefined ? condominium_id : user.condominium_id,
        unit_id !== undefined ? unit_id : user.unit_id,
        full_name !== undefined ? full_name : user.full_name,
        phone !== undefined ? phone : user.phone,
        is_active !== undefined ? is_active : user.is_active,
        req.params.id
      ]
    );

    // Ottieni l'utente aggiornato
    const updatedUser = await getQuery(
      `SELECT u.id, u.condominium_id, u.username, u.email, u.role, u.unit_id,
              u.full_name, u.phone, u.is_active, u.last_login, u.created_at
       FROM users u
       WHERE u.id = ?`,
      [req.params.id]
    );

    res.json({
      message: 'Utente aggiornato con successo',
      user: updatedUser
    });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      error: 'Errore server',
      message: error.message
    });
  }
});

/**
 * DELETE /api/users/:id
 * Elimina un utente (soft delete - imposta is_active = 0)
 */
router.delete('/:id', authorize('super_admin', 'admin'), async (req, res) => {
  try {
    // Verifica che l'utente esista
    const user = await getQuery('SELECT * FROM users WHERE id = ?', [req.params.id]);

    if (!user) {
      return res.status(404).json({
        error: 'Utente non trovato'
      });
    }

    // Non puoi eliminare te stesso
    if (user.id === req.user.id) {
      return res.status(400).json({
        error: 'Operazione non valida',
        message: 'Non puoi eliminare il tuo stesso account'
      });
    }

    // Admin può eliminare solo utenti del proprio condominio
    if (req.user.role === 'admin' && user.condominium_id !== req.user.condominium_id) {
      return res.status(403).json({
        error: 'Accesso negato',
        message: 'Non puoi eliminare utenti di altri condomini'
      });
    }

    // Solo super-admin può eliminare super-admin
    if (user.role === 'super_admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        error: 'Accesso negato',
        message: 'Solo un super-admin può eliminare altri super-admin'
      });
    }

    // Soft delete
    await runQuery(
      'UPDATE users SET is_active = 0 WHERE id = ?',
      [req.params.id]
    );

    res.json({
      message: 'Utente disattivato con successo'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      error: 'Errore server',
      message: error.message
    });
  }
});

/**
 * POST /api/users/:id/reset-password
 * Reset password di un utente (solo admin/super-admin)
 */
router.post('/:id/reset-password', authorize('super_admin', 'admin'), async (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        error: 'Password non valida',
        message: 'La password deve essere di almeno 6 caratteri'
      });
    }

    // Verifica che l'utente esista
    const user = await getQuery('SELECT * FROM users WHERE id = ?', [req.params.id]);

    if (!user) {
      return res.status(404).json({
        error: 'Utente non trovato'
      });
    }

    // Admin può resettare password solo nel proprio condominio
    if (req.user.role === 'admin' && user.condominium_id !== req.user.condominium_id) {
      return res.status(403).json({
        error: 'Accesso negato',
        message: 'Non puoi resettare password di utenti di altri condomini'
      });
    }

    // Hash della nuova password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Aggiorna la password
    await runQuery(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [passwordHash, req.params.id]
    );

    res.json({
      message: 'Password resettata con successo'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      error: 'Errore server',
      message: error.message
    });
  }
});

export default router;
