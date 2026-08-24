import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initDb, getDb } from './db.js';
import routes from './routes.js';

const app = express();
const PORT = process.env.PORT || 3001;
let frontendOrigin = (process.env.FRONTEND_URL || 'http://localhost:3000').trim().replace(/\/$/, '');
if (!/^https?:\/\//i.test(frontendOrigin)) frontendOrigin = `https://${frontendOrigin}`;

for (const key of ['DATABASE_URL', 'FRONTEND_URL']) {
  const val = process.env[key];
  if (!val) console.warn(`[env] missing ${key}`);
  else if (/^["']/.test(val)) console.warn(`[env] ${key} has stray quotes — remove " from Railway/Vercel`);
}

app.use(cors({ origin: frontendOrigin }));
app.use(express.json({ limit: '1mb' }));
app.use('/api', routes);

await initDb();

app.listen(PORT, () => {
  const db = getDb();
  console.log(`Vintage Letters API running on http://localhost:${PORT} [${db.kind}]`);
});
