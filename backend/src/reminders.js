import { AUTHORS } from './auth.js';
import { isPushConfigured, sendPushToAuthor } from './push.js';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Reminder stages, earliest first. A stage is skipped once the next one is due. */
const STAGES = [
  { key: '7d', days: 7 },
  { key: '1d', days: 1 },
];

/** Moments are all-day (stored as local midnight) — remind at 9:00 local, not at midnight. */
const MOMENT_NOTIFY_OFFSET = 9 * HOUR;

const INTERVAL_MS = Number(process.env.REMINDER_INTERVAL_MS) || 15 * 60_000;
const TIME_ZONE = process.env.REMINDER_TIMEZONE || 'Asia/Ho_Chi_Minh';

function fmt(date, options) {
  return new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, ...options }).format(date);
}

/** YYYY-MM-DD in the reminder time zone (for /plans?date= links). */
function dateParam(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(date);
}

/** Next yearly anniversary of `at` that is still ahead of `now` (the start date itself if it's in the future). */
export function nextAnniversary(at, now) {
  if (at > now) return at;
  const next = new Date(at);
  next.setUTCFullYear(now.getUTCFullYear());
  if (next <= now) next.setUTCFullYear(now.getUTCFullYear() + 1);
  return next;
}

/**
 * Everything worth a reminder, normalized:
 * target   — when it happens; `base` — the moment reminders count back from;
 * changedAt — when it was last created/edited (no reminders for stages already past at that point).
 */
export function collectEvents({ plans, milestones }, now) {
  const events = [];

  for (const p of plans) {
    if (p.status === 'declined') continue;
    const target = new Date(p.starts_at);
    if (target <= now) continue;
    const note = p.note?.trim() || 'Hangout';
    events.push({
      kind: 'plan',
      id: p.id,
      target,
      base: target,
      changedAt: new Date(p.created_at),
      title: note,
      body: `${fmt(target, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}${
        p.status === 'pending' ? ' · still waiting for a yes' : ''
      }`,
      url: `/plans?date=${dateParam(target)}`,
    });
  }

  for (const m of milestones) {
    const at = new Date(m.at);
    const target = m.mode === 'countup' ? nextAnniversary(at, now) : at;
    if (target <= now) continue;
    const years = target.getUTCFullYear() - at.getUTCFullYear();
    const day = fmt(target, { weekday: 'short', month: 'short', day: 'numeric' });
    events.push({
      kind: 'moment',
      id: m.id,
      target,
      base: new Date(target.getTime() + MOMENT_NOTIFY_OFFSET),
      changedAt: new Date(m.updated_at || m.created_at),
      title: m.title,
      body: m.mode === 'countup' && years > 0 ? `${years} ${years === 1 ? 'year' : 'years'} on ${day}` : day,
      url: '/milestones',
    });
  }

  return events;
}

/** The stage that should fire right now for an event, or null. */
export function dueStage(event, now) {
  for (let i = STAGES.length - 1; i >= 0; i--) {
    const stage = STAGES[i];
    const fireAt = event.base.getTime() - stage.days * DAY;
    // Still useful until the event itself; a later stage supersedes an earlier one
    const until = i === STAGES.length - 1 ? event.base.getTime() : event.base.getTime() - STAGES[i + 1].days * DAY;
    if (now.getTime() < fireAt || now.getTime() >= until) continue;
    // Created/edited after this stage's moment (e.g. a plan made 3 days ahead) — no "in a week" reminder
    if (event.changedAt.getTime() > fireAt) return null;
    return stage;
  }
  return null;
}

function headline(event, stage) {
  return stage.key === '1d' ? `Tomorrow: ${event.title}` : `In a week: ${event.title}`;
}

/**
 * One pass: find due reminders, claim each (dedupe across restarts/instances), push to both authors.
 * `send` is injectable for tests; the real one is skipped entirely when VAPID isn't configured so
 * reminders aren't marked sent without being delivered.
 */
export async function runReminders(db, { now = new Date(), send } = {}) {
  if (!send && !isPushConfigured()) return [];
  const deliver = send || ((author, payload) => sendPushToAuthor(db, author, payload));

  const [plans, milestones] = await Promise.all([db.getPlans(), db.getMilestones()]);
  const sent = [];

  for (const event of collectEvents({ plans, milestones }, now)) {
    const stage = dueStage(event, now);
    if (!stage) continue;
    const key = `${event.kind}:${event.id}:${stage.key}:${event.target.toISOString()}`;
    if (!(await db.claimReminder(key))) continue;

    await Promise.all(
      AUTHORS.map(async (author) => {
        const unreadCount = await db.countUnreadInbox(author);
        await deliver(author, { title: headline(event, stage), body: event.body, url: event.url, unreadCount, tag: key });
      })
    );
    sent.push(key);
  }

  if (sent.length) console.log(`[reminders] sent ${sent.length}:`, sent.join(', '));
  return sent;
}

/**
 * In-process loop. Opt-in via REMINDERS_ENABLED=1 so local/dev servers sharing a real database
 * never push to real phones. On hosts that sleep when idle, also hit POST /api/cron/reminders.
 */
export function startReminderScheduler(db) {
  if (process.env.REMINDERS_ENABLED !== '1') {
    console.log('[reminders] scheduler off (set REMINDERS_ENABLED=1 to turn on)');
    return;
  }
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runReminders(db);
    } catch (err) {
      console.warn('[reminders] run failed:', err.message);
    } finally {
      running = false;
    }
  };
  setTimeout(tick, 20_000);
  setInterval(tick, INTERVAL_MS);
  console.log(`[reminders] every ${Math.round(INTERVAL_MS / 60_000)} min, tz ${TIME_ZONE}`);
}
