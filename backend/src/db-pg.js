import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function createPgDb(connectionString) {
  // channel_binding=require breaks node-pg on some hosts (e.g. Railway)
  const url = connectionString.replace(/([?&])channel_binding=[^&]*&?/g, '$1').replace(/[?&]$/, '');
  const pool = new pg.Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });

  async function init() {
    const schema = fs.readFileSync(path.join(__dirname, '..', 'sql', 'schema.sql'), 'utf8');
    await pool.query(schema);
  }

  return {
    kind: 'postgres',
    init,
    ping: () => pool.query('SELECT 1'),

    async getLetters() {
      const { rows } = await pool.query(
        'SELECT id, title, content, template, author, reply_to, created_at FROM letters ORDER BY created_at DESC'
      );
      return rows.map(formatLetter);
    },

    async getLetter(id) {
      const { rows } = await pool.query(
        'SELECT id, title, content, template, author, reply_to, created_at FROM letters WHERE id = $1',
        [id]
      );
      return rows[0] ? formatLetter(rows[0]) : null;
    },

    async insertLetter(letter) {
      await pool.query(
        `INSERT INTO letters (id, title, content, template, author, reply_to, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          letter.id,
          letter.title,
          letter.content,
          letter.template,
          letter.author,
          letter.reply_to || null,
          letter.created_at,
        ]
      );
      return letter;
    },

    async updateLetter(id, { title, content, template }) {
      const { rowCount } = await pool.query(
        `UPDATE letters SET title = $1, content = $2, template = $3 WHERE id = $4`,
        [title, content, template, id]
      );
      if (!rowCount) return null;
      return this.getLetter(id);
    },

    async deleteLetter(id) {
      const { rowCount } = await pool.query('DELETE FROM letters WHERE id = $1', [id]);
      return rowCount > 0;
    },

    async getSessions(letterId) {
      const { rows } = await pool.query(
        `SELECT id, letter_id, started_at, ended_at, duration_seconds, user_agent, reader
         FROM reading_sessions WHERE letter_id = $1`,
        [letterId]
      );
      return rows.map(formatSession);
    },

    async insertSession(session) {
      await pool.query(
        `INSERT INTO reading_sessions (id, letter_id, started_at, ended_at, duration_seconds, user_agent, reader)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          session.id,
          session.letter_id,
          session.started_at,
          session.ended_at,
          session.duration_seconds,
          session.user_agent,
          session.reader || null,
        ]
      );
      return session;
    },

    async updateSession(id, updates) {
      const session = await this.getSession(id);
      if (!session) return null;
      const merged = { ...session, ...updates };
      await pool.query(
        `UPDATE reading_sessions SET ended_at = $1, duration_seconds = $2 WHERE id = $3`,
        [merged.ended_at, merged.duration_seconds, id]
      );
      return merged;
    },

    async getSession(id) {
      const { rows } = await pool.query(
        `SELECT id, letter_id, started_at, ended_at, duration_seconds, user_agent, reader
         FROM reading_sessions WHERE id = $1`,
        [id]
      );
      return rows[0] ? formatSession(rows[0]) : null;
    },

    async letterWithStats(id) {
      const { rows } = await pool.query(
        `SELECT
           l.id, l.title, l.content, l.template, l.author, l.reply_to, l.created_at,
           COUNT(rs.id) FILTER (WHERE rs.ended_at IS NOT NULL)::int AS read_count,
           COALESCE(SUM(rs.duration_seconds) FILTER (WHERE rs.ended_at IS NOT NULL), 0)::int AS total_read_seconds,
           MAX(rs.ended_at) FILTER (WHERE rs.ended_at IS NOT NULL) AS last_read_at
         FROM letters l
         LEFT JOIN reading_sessions rs ON rs.letter_id = l.id
         WHERE l.id = $1
         GROUP BY l.id`,
        [id]
      );
      if (!rows[0]) return null;
      return formatLetterStats(rows[0]);
    },

    async allLettersWithStats(author) {
      // My letters only — never return the full shared inbox here
      if (!author) return [];
      const { rows } = await pool.query(
        `SELECT
           l.id, l.title, l.content, l.template, l.author, l.reply_to, l.created_at,
           COUNT(rs.id) FILTER (WHERE rs.ended_at IS NOT NULL)::int AS read_count,
           COALESCE(SUM(rs.duration_seconds) FILTER (WHERE rs.ended_at IS NOT NULL), 0)::int AS total_read_seconds,
           MAX(rs.ended_at) FILTER (WHERE rs.ended_at IS NOT NULL) AS last_read_at
         FROM letters l
         LEFT JOIN reading_sessions rs ON rs.letter_id = l.id
         WHERE l.author = $1
         GROUP BY l.id
         ORDER BY l.created_at DESC`,
        [author]
      );
      return rows.map(formatLetterStats);
    },

    /** Letters from the other role — unread = no reading_session by this reader */
    async getInbox(reader) {
      const { rows } = await pool.query(
        `SELECT
           l.id, l.title, l.template, l.author, l.created_at,
           NOT EXISTS (
             SELECT 1 FROM reading_sessions rs
             WHERE rs.letter_id = l.id AND rs.reader = $1
           ) AS unread
         FROM letters l
         WHERE l.author <> $1
         ORDER BY l.created_at DESC`,
        [reader]
      );
      return rows.map((row) => ({
        id: row.id,
        title: row.title,
        template: row.template,
        author: row.author || 'moon',
        created_at: toIso(row.created_at),
        unread: Boolean(row.unread),
      }));
    },

    async countUnreadInbox(reader) {
      const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS n
         FROM letters l
         WHERE l.author <> $1
           AND NOT EXISTS (
             SELECT 1 FROM reading_sessions rs
             WHERE rs.letter_id = l.id AND rs.reader = $1
           )`,
        [reader]
      );
      return rows[0]?.n ?? 0;
    },

    /** Distinct roles who opened this letter */
    async getReaders(letterId) {
      const { rows } = await pool.query(
        `SELECT reader, MAX(COALESCE(ended_at, started_at)) AS last_read_at
         FROM reading_sessions
         WHERE letter_id = $1 AND reader IS NOT NULL
         GROUP BY reader
         ORDER BY last_read_at DESC`,
        [letterId]
      );
      return rows.map((row) => ({
        reader: row.reader,
        last_read_at: toIso(row.last_read_at),
      }));
    },

    async getPlans() {
      const { rows } = await pool.query(
        `SELECT id, proposed_by, starts_at, note, status, created_at, responded_at
         FROM date_plans
         ORDER BY starts_at ASC`
      );
      return rows.map(formatPlan);
    },

    async getPlan(id) {
      const { rows } = await pool.query(
        `SELECT id, proposed_by, starts_at, note, status, created_at, responded_at
         FROM date_plans WHERE id = $1`,
        [id]
      );
      return rows[0] ? formatPlan(rows[0]) : null;
    },

    async insertPlan(plan) {
      await pool.query(
        `INSERT INTO date_plans (id, proposed_by, starts_at, note, status, created_at, responded_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          plan.id,
          plan.proposed_by,
          plan.starts_at,
          plan.note,
          plan.status,
          plan.created_at,
          plan.responded_at || null,
        ]
      );
      return plan;
    },

    async updatePlanStatus(id, status, respondedAt) {
      const { rowCount } = await pool.query(
        `UPDATE date_plans SET status = $1, responded_at = $2 WHERE id = $3`,
        [status, respondedAt, id]
      );
      if (!rowCount) return null;
      return this.getPlan(id);
    },

    async deletePlan(id) {
      const { rowCount } = await pool.query('DELETE FROM date_plans WHERE id = $1', [id]);
      return rowCount > 0;
    },

    async insertPushSubscription(sub) {
      await pool.query(
        `INSERT INTO push_subscriptions (id, author, endpoint, p256dh, auth, user_agent, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (endpoint) DO UPDATE SET
           author = EXCLUDED.author,
           p256dh = EXCLUDED.p256dh,
           auth = EXCLUDED.auth,
           user_agent = EXCLUDED.user_agent`,
        [sub.id, sub.author, sub.endpoint, sub.p256dh, sub.auth, sub.user_agent || null, sub.created_at]
      );
      return sub;
    },

    async getPushSubscriptionsForAuthor(author) {
      const { rows } = await pool.query(
        `SELECT id, author, endpoint, p256dh, auth, user_agent, created_at
         FROM push_subscriptions WHERE author = $1`,
        [author]
      );
      return rows.map(formatPushSubscription);
    },

    async deletePushSubscriptionByEndpoint(endpoint) {
      const { rowCount } = await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
      return rowCount > 0;
    },
  };
}

function formatLetter(row) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    template: row.template,
    author: row.author || 'moon',
    reply_to: row.reply_to || null,
    created_at: toIso(row.created_at),
  };
}

function formatSession(row) {
  return {
    id: row.id,
    letter_id: row.letter_id,
    started_at: toIso(row.started_at),
    ended_at: row.ended_at ? toIso(row.ended_at) : null,
    duration_seconds: row.duration_seconds,
    user_agent: row.user_agent,
    reader: row.reader || null,
  };
}

function formatLetterStats(row) {
  return {
    ...formatLetter(row),
    read_count: row.read_count ?? 0,
    total_read_seconds: row.total_read_seconds ?? 0,
    last_read_at: row.last_read_at ? toIso(row.last_read_at) : null,
  };
}

function formatPlan(row) {
  return {
    id: row.id,
    proposed_by: row.proposed_by,
    starts_at: toIso(row.starts_at),
    note: row.note || '',
    status: row.status,
    created_at: toIso(row.created_at),
    responded_at: row.responded_at ? toIso(row.responded_at) : null,
  };
}

function formatPushSubscription(row) {
  return {
    id: row.id,
    author: row.author,
    endpoint: row.endpoint,
    p256dh: row.p256dh,
    auth: row.auth,
    user_agent: row.user_agent || null,
    created_at: toIso(row.created_at),
  };
}

function toIso(value) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
