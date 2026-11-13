// The two cats (Moon's white one, Sun's orange one): pure rules, no I/O.
// Routes, the letter hook and the daily check-in push build on these.

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export const TIME_ZONE = process.env.REMINDER_TIMEZONE || 'Asia/Ho_Chi_Minh';

/** Local hour (0-23) at which your cat asks how your day was. */
export const CHECKIN_HOUR = Number.isFinite(Number(process.env.CHECKIN_HOUR)) && process.env.CHECKIN_HOUR !== ''
  ? Number(process.env.CHECKIN_HOUR)
  : 18;

export const OWNERS = ['moon', 'sun'];
export const DEFAULT_NAMES = { moon: 'Luna', sun: 'Sol' };

export const MOODS = [
  { emoji: '😄', label: 'Great' },
  { emoji: '🥰', label: 'Loved' },
  { emoji: '😌', label: 'Calm' },
  { emoji: '😐', label: 'Okay' },
  { emoji: '😴', label: 'Tired' },
  { emoji: '😔', label: 'Down' },
  { emoji: '😢', label: 'Sad' },
  { emoji: '😠', label: 'Upset' },
];

export const NOTE_MAX = 140;
export const NAME_MAX = 24;

/** A cat grows with care, not with the calendar. `xp` is the care needed to reach the stage. */
export const STAGES = [
  { key: 'nest', label: 'Newborn in the nest', xp: 0 },
  { key: 'kitten', label: '2 months old', xp: 8 },
  { key: 'junior', label: '6 months old', xp: 30 },
  { key: 'adult', label: 'All grown up', xp: 80 },
];

/** Care points: a meal, and the owner's first mood check-in of the day. */
export const XP = { feed: 2, mood: 3 };

/** Fullness drains from 100 to 0 over this long. */
const HUNGER_MS = DAY;
/** Feeding is refused above this fullness, so tapping the button again does nothing. */
const FULL_AT = 75;

export const otherOwner = (owner) => (owner === 'moon' ? 'sun' : 'moon');

/** YYYY-MM-DD in the cats' time zone. */
export function localDay(now, timeZone = TIME_ZONE) {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(now);
}

/** Hour 0-23 in the cats' time zone. */
export function localHour(now, timeZone = TIME_ZONE) {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hourCycle: 'h23' }).format(now));
}

/** The calendar day before a YYYY-MM-DD day. */
export function previousDay(day) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function fullnessAt(lastFedAt, now) {
  if (!lastFedAt) return 0;
  const elapsed = now.getTime() - new Date(lastFedAt).getTime();
  return Math.max(0, Math.min(100, Math.round(100 - (elapsed / HUNGER_MS) * 100)));
}

/** Stage for an amount of care, with progress (0-100) toward the next one. */
export function stageFor(xp) {
  let index = 0;
  for (let i = 0; i < STAGES.length; i++) if (xp >= STAGES[i].xp) index = i;
  const next = STAGES[index + 1]?.xp ?? null;
  const progress = next === null ? 100 : Math.round(((xp - STAGES[index].xp) / (next - STAGES[index].xp)) * 100);
  return { index, key: STAGES[index].key, label: STAGES[index].label, next, progress };
}

/** Days in a row, ending today (or yesterday, while today is still open), that both of you checked in. */
export function bothStreak(moods, today) {
  const authorsByDay = new Map();
  for (const m of moods) {
    if (!authorsByDay.has(m.day)) authorsByDay.set(m.day, new Set());
    authorsByDay.get(m.day).add(m.author);
  }
  const both = (day) => (authorsByDay.get(day)?.size ?? 0) >= 2;
  let day = both(today) ? today : previousDay(today);
  let streak = 0;
  while (both(day)) {
    streak++;
    day = previousDay(day);
  }
  return streak;
}

/** What one cat shows right now. */
export function catStatus(cat, now, timeZone = TIME_ZONE) {
  const hour = localHour(now, timeZone);
  const fullness = fullnessAt(cat.last_fed_at, now);
  return {
    fullness,
    hungry: fullness < 25,
    canFeed: fullness < FULL_AT,
    asleep: hour >= 23 || hour < 6,
    stage: stageFor(cat.xp),
  };
}

/**
 * Where a cat goes when `sender` sends a letter. `cats` = { moon: { location }, sun: { location } },
 * location being whose house the cat is at.
 * - The other one's cat is visiting the sender: it carries the reply home.
 * - Otherwise the sender's own cat carries the letter over (unless it is already there).
 * Returns { owner, location } or null when nobody moves.
 */
export function moveOnLetter(cats, sender) {
  const other = otherOwner(sender);
  if (cats[other].location === sender) return { owner: other, location: other };
  if (cats[sender].location !== other) return { owner: sender, location: other };
  return null;
}

/** `{ value }` or `{ error }` for a mood check-in body. */
export function parseMoodInput(body) {
  const { emoji, note = '' } = body || {};
  if (!MOODS.some((m) => m.emoji === emoji)) return { error: 'Pick one of the moods' };
  if (typeof note !== 'string') return { error: 'note must be text' };
  const trimmed = note.trim();
  if ([...trimmed].length > NOTE_MAX) return { error: `Keep the note under ${NOTE_MAX} characters` };
  return { value: { emoji, note: trimmed } };
}

export function parseNameInput(body) {
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!name) return { error: 'Give your cat a name' };
  if ([...name].length > NAME_MAX) return { error: `Names are up to ${NAME_MAX} characters` };
  return { value: name };
}
