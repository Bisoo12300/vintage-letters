import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initDb, getDb } from './db.js';
import routes from './routes.js';

const app = express();
const PORT = process.env.PORT || 3001;

function normalizeOrigin(raw) {
  let url = String(raw || '').trim().replace(/\/$/, '');
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  return url;
}

const allowedOrigins = new Set(
  [
    ...(process.env.FRONTEND_URL || 'http://localhost:3000').split(','),
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ]
    .map(normalizeOrigin)
    .filter(Boolean)
);

for (const key of ['DATABASE_URL', 'FRONTEND_URL']) {
  const val = process.env[key];
  if (!val) console.warn(`[env] missing ${key}`);
  else if (/^["']/.test(val)) console.warn(`[env] ${key} has stray quotes — remove " from Railway/Vercel`);
}

console.log('[cors] allowed origins:', [...allowedOrigins].join(', '));

app.use(
  cors({
    origin(origin, cb) {
      // same-origin / curl / server-to-server
      if (!origin) return cb(null, true);
      if (allowedOrigins.has(origin)) return cb(null, true);
      // Vercel preview deployments for this project
      if (/^https:\/\/[\w-]+\.vercel\.app$/.test(origin)) return cb(null, true);
      console.warn('[cors] blocked origin:', origin);
      return cb(null, false);
    },
    allowedHeaders: ['Content-Type', 'x-author', 'x-admin-password', 'x-reader-token'],
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  })
);
app.use(express.json({ limit: '1mb' }));
app.use('/api', routes);

await initDb();

app.listen(PORT, () => {
  const db = getDb();
  console.log(`Vintage Letters API on :${PORT} [${db.kind}] roles=moon|fox`);
});
