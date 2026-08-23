import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function createPgDb(connectionString) {
  const pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  async function init() {
    const schema = fs.readFileSync(path.join(__dirname, '..', 'sql', 'schema.sql'), 'utf8');
    await pool.query(schema);
  }

  return {
    kind: 'postgres',
    init,

    async getLetters() {
      const { rows } = await pool.query(
        'SELECT id, title, content, template, created_at FROM letters ORDER BY created_at DESC'
      );
      return rows.map(formatLetter);
    },

    async getLetter(id) {
      const { rows } = await pool.query(
        'SELECT id, title, content, template, created_at FROM letters WHERE id = $1',
        [id]
      );
      return rows[0] ? formatLetter(rows[0]) : null;
    },

    async insertLetter(letter) {
      await pool.query(
        `INSERT INTO letters (id, title, content, template, created_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [letter.id, letter.title, letter.content, letter.template, letter.created_at]
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
        `SELECT id, letter_id, started_at, ended_at, duration_seconds, user_agent
         FROM reading_sessions WHERE letter_id = $1`,
        [letterId]
      );
      return rows.map(formatSession);
    },

    async insertSession(session) {
      await pool.query(
        `INSERT INTO reading_sessions (id, letter_id, started_at, ended_at, duration_seconds, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          session.id,
          session.letter_id,
          session.started_at,
          session.ended_at,
          session.duration_seconds,
          session.user_agent,
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
        `SELECT id, letter_id, started_at, ended_at, duration_seconds, user_agent
         FROM reading_sessions WHERE id = $1`,
        [id]
      );
      return rows[0] ? formatSession(rows[0]) : null;
    },

    async letterWithStats(id) {
      const { rows } = await pool.query(
        `SELECT
           l.id, l.title, l.content, l.template, l.created_at,
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

    async allLettersWithStats() {
      const { rows } = await pool.query(
        `SELECT
           l.id, l.title, l.content, l.template, l.created_at,
           COUNT(rs.id) FILTER (WHERE rs.ended_at IS NOT NULL)::int AS read_count,
           COALESCE(SUM(rs.duration_seconds) FILTER (WHERE rs.ended_at IS NOT NULL), 0)::int AS total_read_seconds,
           MAX(rs.ended_at) FILTER (WHERE rs.ended_at IS NOT NULL) AS last_read_at
         FROM letters l
         LEFT JOIN reading_sessions rs ON rs.letter_id = l.id
         GROUP BY l.id
         ORDER BY l.created_at DESC`
      );
      return rows.map(formatLetterStats);
    },
  };
}

function formatLetter(row) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    template: row.template,
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

function toIso(value) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
