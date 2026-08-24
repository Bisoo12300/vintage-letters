CREATE TABLE IF NOT EXISTS letters (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  template TEXT NOT NULL DEFAULT 'daisy-paper',
  author TEXT NOT NULL DEFAULT 'moon',
  reply_to TEXT REFERENCES letters(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE letters ADD COLUMN IF NOT EXISTS author TEXT NOT NULL DEFAULT 'moon';
ALTER TABLE letters ADD COLUMN IF NOT EXISTS reply_to TEXT;

CREATE TABLE IF NOT EXISTS reading_sessions (
  id TEXT PRIMARY KEY,
  letter_id TEXT NOT NULL REFERENCES letters(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_letter ON reading_sessions(letter_id);
