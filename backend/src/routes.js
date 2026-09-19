import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from './db.js';
import { AUTHORS, assertOwnLetter, requireAuthor } from './auth.js';
import { otherAuthor, sendPushToAuthor } from './push.js';

const router = Router();

function frontendBase() {
  let url = (process.env.FRONTEND_URL || 'http://localhost:3000').trim().split(',')[0].trim().replace(/\/$/, '');
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  return url;
}

router.get('/health', async (_req, res) => {
  try {
    const db = getDb();
    await db.ping();
    res.json({ ok: true, db: db.kind, auth: 'author', roles: AUTHORS });
  } catch (err) {
    res.status(503).json({ ok: false, db: getDb().kind, error: err.message });
  }
});

router.get('/me', requireAuthor, (req, res) => {
  res.json({ author: req.author });
});

/** Create — tagged with current role */
router.post('/letters', requireAuthor, async (req, res) => {
  const db = getDb();
  const { title, content, template = 'daisy-paper', reply_to = null } = req.body;
  if (!title?.trim() || !content?.trim()) {
    return res.status(400).json({ error: 'Title and content required' });
  }

  let replyToId = null;
  if (reply_to) {
    const parent = await db.getLetter(String(reply_to));
    if (!parent) return res.status(400).json({ error: 'Letter to reply to was not found' });
    replyToId = parent.id;
  }

  const id = uuidv4();
  const letter = {
    id,
    title: title.trim(),
    content: content.trim(),
    template,
    author: req.author,
    reply_to: replyToId,
    created_at: new Date().toISOString(),
  };
  await db.insertLetter(letter);

  const frontendUrl = frontendBase();
  res.status(201).json({
    ...letter,
    url: `${frontendUrl}/letter/${id}`,
    qrUrl: `${frontendUrl}/qr/${id}`,
  });

  const recipient = otherAuthor(req.author);
  db.countUnreadInbox(recipient)
    .then((unreadCount) =>
      sendPushToAuthor(db, recipient, {
        title: `New letter from ${req.author}`,
        body: letter.title,
        url: `/letter/${id}`,
        unreadCount,
      })
    )
    .catch((err) => console.warn('[push] letters notify failed:', err.message));
});

/** My letters — only current role */
router.get('/letters', requireAuthor, async (req, res) => {
  res.json(await getDb().allLettersWithStats(req.author));
});

/** Shared timeline — both roles see all */
router.get('/letters/timeline', requireAuthor, async (_req, res) => {
  const all = await getDb().getLetters();
  const byId = new Map(all.map((l) => [l.id, l]));
  const letters = all
    .map(({ id, title, author, reply_to, created_at }) => ({
      id,
      title,
      author,
      reply_to: reply_to || null,
      reply_to_title: reply_to ? byId.get(reply_to)?.title || null : null,
      created_at,
    }))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  res.json(letters);
});

/** Read one — public (QR / shared link) */
router.get('/letters/:id', async (req, res) => {
  const letter = await getDb().getLetter(req.params.id);
  if (!letter) return res.status(404).json({ error: 'Letter not found' });
  let reply_to_title = null;
  if (letter.reply_to) {
    const parent = await getDb().getLetter(letter.reply_to);
    reply_to_title = parent?.title || null;
  }
  res.json({ ...letter, reply_to_title });
});

router.put('/letters/:id', requireAuthor, async (req, res) => {
  const check = await assertOwnLetter(getDb(), req.params.id, req.author);
  if (check.error) return res.status(check.status).json({ error: check.error });

  const { title, content, template = 'daisy-paper' } = req.body;
  if (!title?.trim() || !content?.trim()) {
    return res.status(400).json({ error: 'Title and content required' });
  }

  const letter = await getDb().updateLetter(req.params.id, {
    title: title.trim(),
    content: content.trim(),
    template,
  });
  if (!letter) return res.status(404).json({ error: 'Letter not found' });
  res.json(letter);
});

router.delete('/letters/:id', requireAuthor, async (req, res) => {
  const check = await assertOwnLetter(getDb(), req.params.id, req.author);
  if (check.error) return res.status(check.status).json({ error: check.error });

  const deleted = await getDb().deleteLetter(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Letter not found' });
  res.json({ ok: true });
});

router.get('/letters/:id/stats', requireAuthor, async (req, res) => {
  const check = await assertOwnLetter(getDb(), req.params.id, req.author);
  if (check.error) return res.status(check.status).json({ error: check.error });

  const db = getDb();
  const letter = await db.letterWithStats(req.params.id);
  if (!letter) return res.status(404).json({ error: 'Letter not found' });

  const sessions = (await db.getSessions(req.params.id))
    .filter((s) => s.ended_at)
    .sort((a, b) => b.started_at.localeCompare(a.started_at));
  const readers = await db.getReaders(req.params.id);

  res.json({ ...letter, sessions, readers });
});

router.post('/letters/:id/read-start', requireAuthor, async (req, res) => {
  const db = getDb();
  const letter = await db.getLetter(req.params.id);
  if (!letter) return res.status(404).json({ error: 'Letter not found' });

  const sessionId = uuidv4();
  const startedAt = new Date().toISOString();
  await db.insertSession({
    id: sessionId,
    letter_id: req.params.id,
    started_at: startedAt,
    ended_at: null,
    duration_seconds: null,
    user_agent: req.headers['user-agent'] || null,
    reader: req.author,
  });

  res.json({ sessionId, startedAt, reader: req.author });
});

router.post('/letters/:id/read-end', async (req, res) => {
  const db = getDb();
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  const { sessionId, durationSeconds } = body || {};
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

  const session = await db.getSession(sessionId);
  if (!session || session.letter_id !== req.params.id) {
    return res.status(404).json({ error: 'Session not found' });
  }
  if (session.ended_at) return res.json({ ok: true, alreadyEnded: true });

  const endedAt = new Date().toISOString();
  const duration = Math.max(0, Math.round(Number(durationSeconds) || 0));

  await db.updateSession(sessionId, { ended_at: endedAt, duration_seconds: duration });

  res.json({ ok: true, endedAt, durationSeconds: duration });
});

/** Inbox — letters from the other role (unread via reading_sessions.reader) */
router.get('/inbox', requireAuthor, async (req, res) => {
  res.json(await getDb().getInbox(req.author));
});

router.get('/inbox/unread-count', requireAuthor, async (req, res) => {
  res.json({ count: await getDb().countUnreadInbox(req.author) });
});

/** @deprecated use /inbox */
router.get('/archive', requireAuthor, async (req, res) => {
  res.json(await getDb().getInbox(req.author));
});

/** Public — client needs this before subscribing */
router.get('/push/vapid-public-key', (_req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || null });
});

router.post('/push/subscribe', requireAuthor, async (req, res) => {
  const { subscription } = req.body || {};
  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const auth = subscription?.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    return res.status(400).json({ error: 'Valid push subscription required' });
  }

  await getDb().insertPushSubscription({
    id: uuidv4(),
    author: req.author,
    endpoint,
    p256dh,
    auth,
    user_agent: req.headers['user-agent'] || null,
    created_at: new Date().toISOString(),
  });
  res.status(201).json({ ok: true });
});

router.post('/push/unsubscribe', requireAuthor, async (req, res) => {
  const { endpoint } = req.body || {};
  if (!endpoint) return res.status(400).json({ error: 'endpoint required' });
  await getDb().deletePushSubscriptionByEndpoint(endpoint);
  res.json({ ok: true });
});

/** Shared date plans — propose / accept / decline */
router.get('/plans', requireAuthor, async (_req, res) => {
  res.json(await getDb().getPlans());
});

router.post('/plans', requireAuthor, async (req, res) => {
  const { startsAt, note = '' } = req.body || {};
  if (!startsAt) return res.status(400).json({ error: 'startsAt required' });
  const when = new Date(startsAt);
  if (Number.isNaN(when.getTime())) {
    return res.status(400).json({ error: 'Invalid startsAt' });
  }

  const plan = {
    id: uuidv4(),
    proposed_by: req.author,
    starts_at: when.toISOString(),
    note: String(note || '').trim(),
    status: 'pending',
    created_at: new Date().toISOString(),
    responded_at: null,
  };
  await getDb().insertPlan(plan);
  res.status(201).json(plan);

  const db = getDb();
  const recipient = otherAuthor(req.author);
  db.countUnreadInbox(recipient)
    .then((unreadCount) =>
      sendPushToAuthor(db, recipient, {
        title: 'New date proposed',
        body: plan.note || `Proposed for ${plan.starts_at}`,
        url: '/plans',
        unreadCount,
      })
    )
    .catch((err) => console.warn('[push] plans notify failed:', err.message));
});

router.post('/plans/:id/accept', requireAuthor, async (req, res) => {
  const db = getDb();
  const plan = await db.getPlan(req.params.id);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  if (plan.status !== 'pending') {
    return res.status(400).json({ error: 'Plan is not pending' });
  }
  if (plan.proposed_by === req.author) {
    return res.status(403).json({ error: 'Cannot accept your own plan' });
  }
  const updated = await db.updatePlanStatus(plan.id, 'accepted', new Date().toISOString());
  res.json(updated);

  db.countUnreadInbox(plan.proposed_by)
    .then((unreadCount) =>
      sendPushToAuthor(db, plan.proposed_by, {
        title: 'Date accepted',
        body: plan.note || `Your date on ${plan.starts_at} was accepted`,
        url: '/plans',
        unreadCount,
      })
    )
    .catch((err) => console.warn('[push] plans accept notify failed:', err.message));
});

router.post('/plans/:id/decline', requireAuthor, async (req, res) => {
  const db = getDb();
  const plan = await db.getPlan(req.params.id);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  if (plan.status !== 'pending') {
    return res.status(400).json({ error: 'Plan is not pending' });
  }
  if (plan.proposed_by === req.author) {
    return res.status(403).json({ error: 'Cannot decline your own plan' });
  }
  const updated = await db.updatePlanStatus(plan.id, 'declined', new Date().toISOString());
  res.json(updated);

  db.countUnreadInbox(plan.proposed_by)
    .then((unreadCount) =>
      sendPushToAuthor(db, plan.proposed_by, {
        title: 'Date declined',
        body: plan.note || `Your date on ${plan.starts_at} was declined`,
        url: '/plans',
        unreadCount,
      })
    )
    .catch((err) => console.warn('[push] plans decline notify failed:', err.message));
});

router.delete('/plans/:id', requireAuthor, async (req, res) => {
  const deleted = await getDb().deletePlan(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Plan not found' });
  res.json({ ok: true });
});

export default router;
