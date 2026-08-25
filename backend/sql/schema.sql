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
  user_agent TEXT,
  reader TEXT
);

ALTER TABLE reading_sessions ADD COLUMN IF NOT EXISTS reader TEXT;

CREATE INDEX IF NOT EXISTS idx_sessions_letter ON reading_sessions(letter_id);
CREATE INDEX IF NOT EXISTS idx_sessions_reader ON reading_sessions(reader);

CREATE TABLE IF NOT EXISTS date_plans (
  id TEXT PRIMARY KEY,
  proposed_by TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_plans_starts ON date_plans(starts_at);
