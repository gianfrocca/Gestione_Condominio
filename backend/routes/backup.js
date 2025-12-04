import express from 'express';
import multer from 'multer';
import {
  createBackup,
  listBackups,
  downloadBackup,
  restoreBackup,
  ensureBackupDir
} from '../utils/backupManager.js';

const router = express.Router();

// Configurazione multer per upload in memoria
const upload = multer({ storage: multer.memoryStorage() });

// Assicura che la directory backup esista
await ensureBackupDir();

/**
 * Crea un nuovo backup
 * POST /api/backup/create
 */
router.post('/create', async (req, res) => {
  try {
    const result = await createBackup();
    res.json({
      success: true,
      message: 'Backup creato con successo',
      backup: result
    });
  } catch (error) {
    console.error('❌ Errore creazione backup:', error);
    res.status(500).json({
      error: 'Errore durante la creazione del backup',
      details: error.message
    });
  }
});

/**
 * Lista tutti i backup disponibili
 * GET /api/backup/list
 */
router.get('/list', async (req, res) => {
  try {
    const backups = await listBackups();
    res.json({
      success: true,
      count: backups.length,
      backups: backups.map(b => ({
        filename: b.filename,
        created: b.created,
        size: b.size
      }))
    });
  } catch (error) {
    console.error('❌ Errore lettura backup:', error);
    res.status(500).json({
      error: 'Errore durante la lettura dei backup',
      details: error.message
    });
  }
});

/**
 * Scarica un backup specifico
 * GET /api/backup/download/:filename
 */
router.get('/download/:filename', async (req, res) => {
  try {
    const backup = await downloadBackup(req.params.filename);
    res.setHeader('Content-Type', `${backup.contentType}; charset=utf-8`);
    res.setHeader('Content-Disposition', `attachment; filename=${backup.filename}`);
    res.send(backup.content);
  } catch (error) {
    console.error('❌ Errore download backup:', error);
    res.status(500).json({
      error: 'Errore durante il download del backup',
      details: error.message
    });
  }
});

/**
 * Ripristina un backup
 * POST /api/backup/restore/:filename
 */
router.post('/restore/:filename', async (req, res) => {
  try {
    const result = await restoreBackup(req.params.filename);
    res.json(result);
  } catch (error) {
    console.error('❌ Errore ripristino backup:', error);
    res.status(500).json({
      error: 'Errore durante il ripristino del backup',
      details: error.message
    });
  }
});

export default router;
