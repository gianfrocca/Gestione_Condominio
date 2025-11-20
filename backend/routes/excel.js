import express from 'express';
import { exportReport } from '../controllers/excelController.js';

const router = express.Router();

// Export report in Excel
router.get('/export-report', exportReport);

export default router;
