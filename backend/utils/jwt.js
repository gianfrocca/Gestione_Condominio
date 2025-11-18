import jwt from 'jsonwebtoken';

// Secret key per JWT - in produzione dovrebbe essere in variabile d'ambiente
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = '24h'; // Token valido per 24 ore
const REFRESH_TOKEN_EXPIRES_IN = '7d'; // Refresh token valido per 7 giorni

/**
 * Genera un access token JWT
 * @param {Object} payload - Dati dell'utente da includere nel token
 * @returns {string} JWT token
 */
export const generateAccessToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN
  });
};

/**
 * Genera un refresh token JWT
 * @param {Object} payload - Dati dell'utente da includere nel token
 * @returns {string} JWT refresh token
 */
export const generateRefreshToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN
  });
};

/**
 * Verifica e decodifica un token JWT
 * @param {string} token - Token da verificare
 * @returns {Object} Payload decodificato
 * @throws {Error} Se il token non è valido o è scaduto
 */
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token scaduto');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Token non valido');
    }
    throw error;
  }
};

/**
 * Crea un payload utente per il token
 * @param {Object} user - Oggetto utente dal database
 * @returns {Object} Payload per il token
 */
export const createUserPayload = (user) => {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    condominium_id: user.condominium_id,
    unit_id: user.unit_id
  };
};
