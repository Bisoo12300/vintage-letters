import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from './db.js';
import { requireReader } from './auth.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ ok: true, db: getDb().kind });
});

router.post('/letters', async (req, res) => {
  const db = getDb();
  const { title, content, template = 'daisy-paper' } = req.body;
  if (!title?.trim() || !content?.trim()) {
    return res.status(400).json({ error: 'Title and content required' });
  }

  const id = uuidv4();
  const letter = {
    id,
    title: title.trim(),
    content: content.trim(),
    template,
    created_at: new Date().toISOString(),
  };
  await db.insertLetter(letter);

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  res.status(201).json({
    ...letter,
    url: `${frontendUrl}/letter/${id}`,
    qrUrl: `${frontendUrl}/qr/${id}`,
  });
});

router.get('/letters', async (_req, res) => {
  res.json(await getDb().allLettersWithStats());
});

router.get('/letters/timeline', async (_req, res) => {
  const letters = (await getDb().getLetters())
    .map(({ id, title, created_at }) => ({ id, title, created_at }))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  res.json(letters);
});

router.get('/letters/:id', async (req, res) => {
  const letter = await getDb().getLetter(req.params.id);
  if (!letter) return res.status(404).json({ error: 'Letter not found' });
  res.json(letter);
});

router.put('/letters/:id', async (req, res) => {
  const db = getDb();
  const { title, content, template = 'daisy-paper' } = req.body;
  if (!title?.trim() || !content?.trim()) {
    return res.status(400).json({ error: 'Title and content required' });
  }

  const letter = await db.updateLetter(req.params.id, {
    title: title.trim(),
    content: content.trim(),
    template,
  });
  if (!letter) return res.status(404).json({ error: 'Letter not found' });
  res.json(letter);
});

router.delete('/letters/:id', async (req, res) => {
  const deleted = await getDb().deleteLetter(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Letter not found' });
  res.json({ ok: true });
});

router.get('/letters/:id/stats', async (req, res) => {
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

router.get('/archive', requireReader, async (_req, res) => {
  const letters = (await getDb().getLetters()).map(({ id, title, template, created_at }) => ({
    id,
    title,
    template,
    created_at,
  }));
  res.json(letters);
});

export default router;
