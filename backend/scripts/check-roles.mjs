/**
 * ponytail: quick role check — fails if moon/fox can see each other's "my letters"
 * Run: node scripts/check-roles.mjs
 */
import 'dotenv/config';
import { initDb, getDb } from '../src/db.js';

await initDb();
const db = getDb();

const moon = await db.allLettersWithStats('moon');
const fox = await db.allLettersWithStats('fox');
const all = await db.getLetters();

const moonOk = moon.every((l) => l.author === 'moon');
const foxOk = fox.every((l) => l.author === 'fox');
const emptyWithout = (await db.allLettersWithStats()).length === 0;

console.log({
  total: all.length,
  moon: moon.length,
  fox: fox.length,
  moonOk,
  foxOk,
  emptyWithoutAuthor: emptyWithout,
});

if (!moonOk || !foxOk || !emptyWithout) {
  console.error('FAIL role isolation');
  process.exit(1);
}
console.log('OK role isolation');
process.exit(0);
