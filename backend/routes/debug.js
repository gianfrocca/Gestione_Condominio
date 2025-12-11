import express from 'express';
import { allQuery } from '../database.js';

const router = express.Router();

/**
 * DEBUG ONLY - Non usare in produzione!
 * GET /api/debug/users
 * Stampa tutti gli utenti nel database
 */
router.get('/users', async (req, res) => {
  try {
    const users = await allQuery('SELECT id, username, email, role, is_active FROM users');
    res.json({
      count: users.length,
      users: users
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
});

/**
 * DEBUG ONLY - Testa il login manualmente
 * POST /api/debug/test-login
 */
router.post('/test-login', async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log(`[DEBUG] Testing login: username=${username}, password=${password}`);

    const user = await allQuery(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );

    console.log(`[DEBUG] Query result:`, user);

    res.json({
      query: 'SELECT * FROM users WHERE username = $1',
      params: [username],
      result: user,
      found: user.length > 0
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

export default router;
