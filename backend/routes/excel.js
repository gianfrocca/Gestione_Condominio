import express from 'express';
import { exportReport } from '../controllers/excelController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Tutte le route richiedono autenticazione
router.use(authenticateToken);

// Export report in Excel
router.get('/export-report', exportReport);

export default router;
