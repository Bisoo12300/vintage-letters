/**
 * ponytail: quick role check — fails if moon/sun can see each other's "my letters"
 * Run: node scripts/check-roles.mjs
 */
import 'dotenv/config';
import { initDb, getDb } from '../src/db.js';

await initDb();
const db = getDb();

const moon = await db.allLettersWithStats('moon');
const sun = await db.allLettersWithStats('sun');
const all = await db.getLetters();

const moonOk = moon.every((l) => l.author === 'moon');
const sunOk = sun.every((l) => l.author === 'sun');
const emptyWithout = (await db.allLettersWithStats()).length === 0;

console.log({
  total: all.length,
  moon: moon.length,
  sun: sun.length,
  moonOk,
  sunOk,
  emptyWithoutAuthor: emptyWithout,
});

if (!moonOk || !sunOk || !emptyWithout) {
  console.error('FAIL role isolation');
  process.exit(1);
}
console.log('OK role isolation');
process.exit(0);
