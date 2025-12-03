import express from 'express';
import multer from 'multer';
import { exportSQL, importSQL, exportPGDump } from '../controllers/backupController.js';

const router = express.Router();

// Configurazione multer per upload in memoria
const upload = multer({ storage: multer.memoryStorage() });

// Export SQL dump (INSERT statements)
router.get('/export-sql', exportSQL);

// Import SQL dump
router.post('/import-sql', upload.single('file'), importSQL);

// Export PostgreSQL dump (COPY format)
router.get('/export-dump', exportPGDump);

export default router;
