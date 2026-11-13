// Run: node --test src/pets.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { bothStreak, catStatus, fullnessAt, localDay, moveOnLetter, parseMoodInput, parseNameInput, stageFor } from './pets.js';
import { runCheckins } from './reminders.js';

const TZ = 'Asia/Ho_Chi_Minh'; // UTC+7, no DST
const at = (local) => new Date(`${local}+07:00`);

test('fullness drains over 24 hours and feeding is refused while full', () => {
  const fed = at('2026-11-13T08:00:00');
  assert.equal(fullnessAt(null, fed), 0);
  assert.equal(fullnessAt(fed, fed), 100);
  assert.equal(fullnessAt(fed, at('2026-11-13T20:00:00')), 50);
  assert.equal(fullnessAt(fed, at('2026-11-15T08:00:00')), 0);

  const cat = { last_fed_at: fed.toISOString(), xp: 0 };
  assert.equal(catStatus(cat, at('2026-11-13T10:00:00'), TZ).canFeed, false); // ~92%
  assert.equal(catStatus(cat, at('2026-11-13T16:00:00'), TZ).canFeed, true); // ~67%
  assert.equal(catStatus({ last_fed_at: null, xp: 0 }, at('2026-11-13T16:00:00'), TZ).hungry, true);
  assert.equal(catStatus(cat, at('2026-11-13T23:30:00'), TZ).asleep, true);
  assert.equal(localDay(at('2026-11-14T00:30:00'), TZ), '2026-11-14'); // local midnight, not UTC
});

test('a cat grows from the nest to an adult with care', () => {
  assert.equal(stageFor(0).key, 'nest');
  assert.equal(stageFor(7).key, 'nest');
  assert.deepEqual(stageFor(8), { index: 1, key: 'kitten', label: '2 months old', next: 30, progress: 0 });
  assert.equal(stageFor(19).progress, 50);
  assert.equal(stageFor(30).key, 'junior');
  assert.equal(stageFor(80).key, 'adult');
  assert.equal(stageFor(500).next, null);
  assert.equal(stageFor(500).progress, 100);
});

test('letters move the cats between the two houses', () => {
  const home = { moon: { location: 'moon' }, sun: { location: 'sun' } };
  // Sun writes: Sun's cat carries the letter to Moon's house
  assert.deepEqual(moveOnLetter(home, 'sun'), { owner: 'sun', location: 'moon' });
  const visiting = { moon: { location: 'moon' }, sun: { location: 'moon' } };
  // Sun writes again while its cat is still there: nobody moves
  assert.equal(moveOnLetter(visiting, 'sun'), null);
  // Moon replies: Sun's cat carries the reply home, Moon's cat stays
  assert.deepEqual(moveOnLetter(visiting, 'moon'), { owner: 'sun', location: 'sun' });
});

test('streak counts days both checked in, and survives an unanswered today', () => {
  const both = (day) => [{ author: 'moon', day }, { author: 'sun', day }];
  const moods = [...both('2026-11-10'), ...both('2026-11-11'), ...both('2026-11-12'), { author: 'moon', day: '2026-11-13' }];
  assert.equal(bothStreak(moods, '2026-11-13'), 3);
  assert.equal(bothStreak([...moods, { author: 'sun', day: '2026-11-13' }], '2026-11-13'), 4);
  assert.equal(bothStreak(moods, '2026-11-14'), 0);
  assert.equal(bothStreak([...both('2026-11-08'), ...both('2026-11-10')], '2026-11-10'), 1);
});

test('mood and name input validation', () => {
  assert.deepEqual(parseMoodInput({ emoji: '🥰', note: '  nhớ em  ' }), { value: { emoji: '🥰', note: 'nhớ em' } });
  assert.ok(parseMoodInput({ emoji: '🍕' }).error);
  assert.ok(parseMoodInput({ emoji: '😄', note: 'a'.repeat(141) }).error);
  assert.ok(!parseMoodInput({ emoji: '😄', note: '😀'.repeat(140) }).error); // counts characters, not UTF-16 units
  assert.ok(parseNameInput({ name: '   ' }).error);
  assert.deepEqual(parseNameInput({ name: ' Mây ' }), { value: 'Mây' });
});

function fakeDb({ moods = [] } = {}) {
  const claimed = new Set();
  return {
    async getCats() {
      return { moon: { name: 'Luna', last_fed_at: null }, sun: { name: 'Sol', last_fed_at: null } };
    },
    async getMoods({ from, to }) {
      return moods.filter((m) => m.day >= from && m.day <= to);
    },
    async claimReminder(key) {
      if (claimed.has(key)) return false;
      claimed.add(key);
      return true;
    },
    async countUnreadInbox() {
      return 0;
    },
  };
}

test('daily check-in: nothing before 18:00, then once per person who has not answered', async () => {
  const db = fakeDb({ moods: [{ author: 'moon', day: '2026-11-13', emoji: '😄' }] });
  const sent = [];
  const deliver = async (author, payload) => sent.push({ author, payload });

  assert.deepEqual(await runCheckins(db, { now: at('2026-11-13T17:59:00'), deliver }), []);
  assert.equal(sent.length, 0);

  assert.deepEqual(await runCheckins(db, { now: at('2026-11-13T18:05:00'), deliver }), ['checkin:2026-11-13:sun']);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].author, 'sun');
  assert.match(sent[0].payload.title, /Sol/); // your own cat asks
  assert.equal(sent[0].payload.url, '/pets?checkin=1');
  assert.match(sent[0].payload.body, /hungry/); // never fed

  assert.deepEqual(await runCheckins(db, { now: at('2026-11-13T21:00:00'), deliver }), []);
  assert.equal(sent.length, 1);

  await runCheckins(db, { now: at('2026-11-14T18:00:00'), deliver });
  assert.deepEqual(sent.slice(1).map((s) => s.author).sort(), ['moon', 'sun']);
});
