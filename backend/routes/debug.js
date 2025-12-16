import express from 'express';
import { getDebugCalculation, runCalculationTests } from '../controllers/debugController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Tutte le debug routes richiedono autenticazione e permessi admin
router.use(authenticate);

// GET: Debug dettagliato dei calcoli
router.get('/calculations', getDebugCalculation);

// POST: Esegui test di verifica della logica di calcolo
router.post('/calculations/run-tests', runCalculationTests);

export default router;
