import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initDb, getDb } from './db.js';
import routes from './routes.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(express.json({ limit: '1mb' }));
app.use('/api', routes);

await initDb();

app.listen(PORT, () => {
  const db = getDb();
  console.log(`Vintage Letters API running on http://localhost:${PORT} [${db.kind}]`);
});
