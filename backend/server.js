import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { initDatabase } from './database.js';

// Routes
import unitsRouter from './routes/units.js';
import readingsRouter from './routes/readings.js';
import billsRouter from './routes/bills.js';
import calculationsRouter from './routes/calculations.js';
import settingsRouter from './routes/settings.js';
import reportsRouter from './routes/reports.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Crea directory necessarie se non esistono
const dataDir = join(__dirname, '../data');
const billsDir = join(dataDir, 'bills');
const reportsDir = join(dataDir, 'reports');

[dataDir, billsDir, reportsDir].forEach(dir => {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    console.log(`✅ Directory creata: ${dir}`);
  }
});

// Inizializza database
await initDatabase();

// Inizializza dati di esempio (solo al primo avvio)
import { initializeSampleData } from './init-data.js';
await initializeSampleData();

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    message: 'API Gestione Condominio',
    version: '1.0.0',
    endpoints: {
      units: '/api/units',
      readings: '/api/readings',
      bills: '/api/bills',
      calculations: '/api/calculations',
      settings: '/api/settings',
      reports: '/api/reports'
    }
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API Routes
app.use('/api/units', unitsRouter);
app.use('/api/readings', readingsRouter);
app.use('/api/bills', billsRouter);
app.use('/api/calculations', calculationsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/reports', reportsRouter);

// Serve frontend statico (dopo le API routes)
const frontendPath = join(__dirname, '../frontend/dist');
if (existsSync(frontendPath)) {
  app.use(express.static(frontendPath));

  // Catch-all route per React Router (deve essere dopo tutte le altre routes)
  app.get('*', (req, res) => {
    res.sendFile(join(frontendPath, 'index.html'));
  });

  console.log(`✅ Frontend servito da: ${frontendPath}`);
} else {
  console.log(`⚠️  Frontend non trovato in: ${frontendPath}`);
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Errore interno del server'
  });
});

// Avvia server
app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('╔════════════════════════════════════════╗');
  console.log('║   🏢 Gestione Condominio - Backend   ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('');
  console.log(`✅ Server in ascolto su porta ${PORT}`);
  console.log(`🌐 http://localhost:${PORT}`);
  console.log(`📊 API disponibili su http://localhost:${PORT}/api`);
  console.log('');
  console.log('Premi CTRL+C per fermare il server');
  console.log('');
});

export default app;
