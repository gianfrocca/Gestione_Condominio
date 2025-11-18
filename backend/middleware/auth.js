import { verifyToken } from '../utils/jwt.js';

/**
 * Middleware per verificare l'autenticazione dell'utente
 * Verifica il token JWT nell'header Authorization
 */
export const authenticate = (req, res, next) => {
  try {
    // Estrai il token dall'header Authorization: "Bearer <token>"
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        error: 'Accesso negato',
        message: 'Token di autenticazione mancante'
      });
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;

    if (!token) {
      return res.status(401).json({
        error: 'Accesso negato',
        message: 'Token di autenticazione non valido'
      });
    }

    // Verifica e decodifica il token
    const decoded = verifyToken(token);

    // Aggiungi i dati dell'utente alla request
    req.user = decoded;

    next();
  } catch (error) {
    console.error('Authentication error:', error.message);

    if (error.message === 'Token scaduto') {
      return res.status(401).json({
        error: 'Token scaduto',
        message: 'Effettua nuovamente il login'
      });
    }

    return res.status(401).json({
      error: 'Accesso negato',
      message: error.message || 'Token non valido'
    });
  }
};

/**
 * Middleware per verificare che l'utente abbia uno dei ruoli richiesti
 * @param {string[]} roles - Array di ruoli autorizzati
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Accesso negato',
        message: 'Autenticazione richiesta'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Accesso negato',
        message: 'Non hai i permessi necessari per questa operazione'
      });
    }

    next();
  };
};

/**
 * Middleware per verificare che l'utente possa accedere solo ai dati del suo condominio
 * (tranne super_admin che può accedere a tutto)
 */
export const filterByCondominium = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Accesso negato',
      message: 'Autenticazione richiesta'
    });
  }

  // Super admin può accedere a tutto
  if (req.user.role === 'super_admin') {
    return next();
  }

  // Altri utenti possono accedere solo al proprio condominio
  if (!req.user.condominium_id) {
    return res.status(403).json({
      error: 'Accesso negato',
      message: 'Nessun condominio associato'
    });
  }

  // Aggiungi il condominium_id ai filtri della query
  req.condominiumId = req.user.condominium_id;

  next();
};

/**
 * Middleware per verificare che un inquilino possa accedere solo ai suoi dati
 */
export const filterByUnit = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Accesso negato',
      message: 'Autenticazione richiesta'
    });
  }

  // Super admin, admin e gestore possono vedere tutto del loro condominio
  if (['super_admin', 'admin', 'gestore'].includes(req.user.role)) {
    return next();
  }

  // Inquilino può vedere solo i dati della sua unità
  if (req.user.role === 'inquilino') {
    if (!req.user.unit_id) {
      return res.status(403).json({
        error: 'Accesso negato',
        message: 'Nessuna unità associata'
      });
    }

    req.unitId = req.user.unit_id;
  }

  next();
};
