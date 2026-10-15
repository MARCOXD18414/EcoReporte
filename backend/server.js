import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import reportesRoutes from './routes/reportesRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import comunidadRoutes from './routes/comunidadRoutes.js';
import authRoutes from './routes/authRoutes.js';
import { AI_CONFIG } from './config/ai_models.js';
import { supabase } from './config/supabase.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 4000);

const origenes = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
app.use(cors({ origin: (origin, cb) => cb(null, !origin || origenes.includes(origin)) }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.get('/api/health', (_req, res) =>
  res.json({
    ok: true,
    servicio: 'EcoReporta Carmen API',
    supabase: Boolean(supabase),
    ia: {
      proveedor: AI_CONFIG.provider,
      gemma: Boolean(AI_CONFIG.google.apiKey) && AI_CONFIG.google.model,
      ollama: Boolean(AI_CONFIG.ollama.url) && AI_CONFIG.ollama.model,
    },
    hora: new Date().toISOString(),
  })
);

app.use('/api/auth', authRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/comunidad', comunidadRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// Deploy único: el backend también sirve la PWA compilada
const dist = path.resolve(__dirname, '../frontend/dist');
if (process.env.SERVE_FRONTEND !== 'false' && fs.existsSync(dist)) {
  app.use(
    express.static(dist, {
      setHeaders: (res, file) => {
        if (file.endsWith('sw.js')) res.setHeader('Cache-Control', 'no-cache');
      },
    })
  );
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  console.log('[server] sirviendo frontend desde', dist);
}

// Manejo centralizado de errores
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
  if (status >= 500) console.error('[error]', err);
  res.status(status).json({
    error: err.code === 'LIMIT_FILE_SIZE' ? 'La imagen supera 8 MB' : err.message || 'Error interno',
  });
});

app.listen(PORT, () => {
  console.log(`🌊 EcoReporta Carmen API en http://localhost:${PORT}`);
  console.log(`   IA: ${AI_CONFIG.provider} · modelo ${AI_CONFIG.google.model}`);
});
