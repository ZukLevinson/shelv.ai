import express from 'express';
import http from 'http';
import cors from 'cors';
import multer from 'multer';
import { initDatabase } from './db/database.js';
import { initSocketServer, broadcast } from './sockets/socketServer.js';
import { inventoryRouter } from './routes/inventoryRoutes.js';
import { sweepRouter } from './routes/sweepRoutes.js';
import { anomalyRouter } from './routes/anomalyRoutes.js';
import { importOfficialInventoryFromExcel, generateSampleExcelBuffer } from './services/excelImportService.js';
import { detectAnomalies } from './services/anomalyService.js';

const app = express();
const server = http.createServer(app);
const upload = multer({ storage: multer.memoryStorage() });

const PORT = process.env.PORT || 4000;

app.use(cors({ origin: '*' }));
app.use(express.json());

initDatabase();
initSocketServer(server);

app.use('/api/inventory', inventoryRouter);
app.use('/api/sweep', sweepRouter);
app.use('/api/anomalies', anomalyRouter);

app.post('/api/upload-excel', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No Excel file provided' });
  }

  try {
    const result = importOfficialInventoryFromExcel(req.file.buffer);
    const anomalies = detectAnomalies();
    broadcast('ANOMALIES_UPDATED', anomalies);
    broadcast('INVENTORY_SYNCED', result);
    res.json({ message: 'Inventory baseline imported successfully', result });
  } catch (error: any) {
    console.error('[Excel API] Import error:', error);
    res.status(500).json({ error: error.message || 'Failed to process Excel file' });
  }
});

app.get('/api/sample-excel', (req, res) => {
  try {
    const buffer = generateSampleExcelBuffer();
    res.setHeader('Content-Disposition', 'attachment; filename="shelv_signatures_sample.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to generate sample template' });
  }
});

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Serve frontend static files if client build exists (production container)
const clientBuildPath = process.env.CLIENT_BUILD_PATH || path.join(__dirname, '../../web/dist');
if (fs.existsSync(clientBuildPath)) {
  app.use(express.static(clientBuildPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
      return next();
    }
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

server.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`shelv.ai server running on port ${PORT}`);
  console.log(`WebSocket stream available on /ws`);
});