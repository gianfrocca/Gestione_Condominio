import express from 'express';
import bcrypt from 'bcrypt';
import { getQuery, runQuery } from '../database.js';
import { generateAccessToken, generateRefreshToken, verifyToken, createUserPayload } from '../utils/jwt.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * POST /api/auth/login
 * Login utente
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: 'Dati mancanti',
        message: 'Username e password sono richiesti'
      });
    }

    // Cerca l'utente nel database
    const user = await getQuery(
      'SELECT * FROM users WHERE username = ? AND is_active = 1',
      [username]
    );

    if (!user) {
      return res.status(401).json({
        error: 'Credenziali non valide',
        message: 'Username o password errati'
      });
    }

    // Verifica la password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({
        error: 'Credenziali non valide',
        message: 'Username o password errati'
      });
    }

    // Aggiorna last_login
    await runQuery(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
      [user.id]
    );

    // Crea il payload per il token
    const payload = createUserPayload(user);

    // Genera i token
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Restituisci i token e i dati utente (senza password)
    const { password_hash, ...userWithoutPassword } = user;

    res.json({
      message: 'Login effettuato con successo',
      accessToken,
      refreshToken,
      user: userWithoutPassword
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Errore server',
      message: error.message
    });
  }
});

/**
 * POST /api/auth/refresh
 * Rinnova l'access token usando il refresh token
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Token mancante',
        message: 'Refresh token richiesto'
      });
    }

    // Verifica il refresh token
    const decoded = verifyToken(refreshToken);

    // Verifica che l'utente esista ancora e sia attivo
    const user = await getQuery(
      'SELECT * FROM users WHERE id = ? AND is_active = 1',
      [decoded.id]
    );

    if (!user) {
      return res.status(401).json({
        error: 'Utente non trovato',
        message: 'L\'utente non esiste più o è stato disattivato'
      });
    }

    // Genera un nuovo access token
    const payload = createUserPayload(user);
    const newAccessToken = generateAccessToken(payload);

    res.json({
      accessToken: newAccessToken
    });

  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({
      error: 'Token non valido',
      message: error.message
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout utente (lato client basta cancellare i token)
 */
router.post('/logout', authenticate, async (req, res) => {
  // In un'implementazione completa potresti aggiungere una blacklist dei token
  // Per ora il logout è gestito lato client cancellando i token
  res.json({
    message: 'Logout effettuato con successo'
  });
});

/**
 * GET /api/auth/me
 * Ottieni i dati dell'utente corrente
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await getQuery(
      'SELECT id, condominium_id, username, email, role, unit_id, full_name, phone, is_active, last_login, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!user) {
      return res.status(404).json({
        error: 'Utente non trovato'
      });
    }

    res.json(user);

  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      error: 'Errore server',
      message: error.message
    });
  }
});

/**
 * POST /api/auth/change-password
 * Cambia la password dell'utente corrente
 */
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Dati mancanti',
        message: 'Password attuale e nuova password sono richieste'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        error: 'Password non valida',
        message: 'La nuova password deve essere di almeno 6 caratteri'
      });
    }

    // Ottieni l'utente corrente
    const user = await getQuery(
      'SELECT * FROM users WHERE id = ?',
      [req.user.id]
    );

    // Verifica la password attuale
    const passwordMatch = await bcrypt.compare(currentPassword, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({
        error: 'Password errata',
        message: 'La password attuale non è corretta'
      });
    }

    // Hash della nuova password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Aggiorna la password
    await runQuery(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [newPasswordHash, req.user.id]
    );

    res.json({
      message: 'Password aggiornata con successo'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      error: 'Errore server',
      message: error.message
    });
  }
});

/**
 * POST /api/auth/reset-password-request
 * Richiedi il reset della password (invia email con token)
 * TODO: Implementare invio email
 */
router.post('/reset-password-request', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Email mancante',
        message: 'L\'indirizzo email è richiesto'
      });
    }

    // Verifica che l'utente esista
    const user = await getQuery(
      'SELECT * FROM users WHERE email = ? AND is_active = 1',
      [email]
    );

    // Per sicurezza, rispondi sempre con successo anche se l'email non esiste
    // (per non rivelare quali email sono registrate)
    if (!user) {
      return res.json({
        message: 'Se l\'email è registrata, riceverai le istruzioni per il reset della password'
      });
    }

    // TODO: Generare token di reset e inviare email
    // Per ora restituiamo un messaggio generico
    res.json({
      message: 'Se l\'email è registrata, riceverai le istruzioni per il reset della password'
    });

  } catch (error) {
    console.error('Reset password request error:', error);
    res.status(500).json({
      error: 'Errore server',
      message: error.message
    });
  }
});

export default router;
