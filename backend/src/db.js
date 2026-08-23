import { createJsonDb } from './db-json.js';
import { createPgDb } from './db-pg.js';

let db = null;

export async function initDb() {
  if (process.env.DATABASE_URL) {
    db = await createPgDb(process.env.DATABASE_URL);
    console.log('Using PostgreSQL');
  } else {
    db = createJsonDb();
    console.log('Using local JSON store (dev only)');
  }
  await db.init();
  return db;
}

export function getDb() {
  if (!db) throw new Error('Database not initialized — call initDb() first');
  return db;
}
