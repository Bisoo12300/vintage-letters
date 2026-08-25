import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from './db.js';
import { requireAuthor } from './auth.js';

const router = Router();

function frontendBase() {
  let url = (process.env.FRONTEND_URL || 'http://localhost:3000').trim().replace(/\/$/, '');
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  return url;
}

async function ownLetterOr403(req, res) {
  const letter = await getDb().getLetter(req.params.id);
  if (!letter) {
    res.status(404).json({ error: 'Letter not found' });
    return null;
  }
  if (letter.author !== req.author) {
    res.status(403).json({ error: 'You can only edit your own letters' });
    return null;
  }
  return letter;
}

router.get('/health', async (_req, res) => {
  try {
    const db = getDb();
    await db.ping();
    res.json({ ok: true, db: db.kind, auth: 'author' });
  } catch (err) {
    res.status(503).json({ ok: false, db: getDb().kind, error: err.message });
  }
});

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
});

router.get('/letters', requireAuthor, async (req, res) => {
  res.json(await getDb().allLettersWithStats(req.author));
});

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
  if (!(await ownLetterOr403(req, res))) return;
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
  if (!(await ownLetterOr403(req, res))) return;
  const deleted = await getDb().deleteLetter(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Letter not found' });
  res.json({ ok: true });
});

router.get('/letters/:id/stats', requireAuthor, async (req, res) => {
  if (!(await ownLetterOr403(req, res))) return;
  const db = getDb();
  const letter = await db.letterWithStats(req.params.id);
  if (!letter) return res.status(404).json({ error: 'Letter not found' });

  const sessions = (await db.getSessions(req.params.id))
    .filter((s) => s.ended_at)
    .sort((a, b) => b.started_at.localeCompare(a.started_at));

  res.json({ ...letter, sessions });
});

router.post('/letters/:id/read-start', async (req, res) => {
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
  });

  res.json({ sessionId, startedAt });
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

router.get('/archive', requireAuthor, async (_req, res) => {
  const letters = (await getDb().getLetters()).map(({ id, title, template, author, created_at }) => ({
    id,
    title,
    template,
    author,
    created_at,
  }));
  res.json(letters);
});

export default router;
