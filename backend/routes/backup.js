import express from 'express';
import multer from 'multer';
import { exportSQL, importSQL, downloadDatabase } from '../controllers/backupController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Configurazione multer per upload in memoria
const upload = multer({ storage: multer.memoryStorage() });

// Tutte le route richiedono autenticazione
router.use(authenticateToken);

// Export SQL dump
router.get('/export-sql', exportSQL);

// Import SQL dump
router.post('/import-sql', upload.single('file'), importSQL);

// Download database binario
router.get('/download-db', downloadDatabase);

export default router;
