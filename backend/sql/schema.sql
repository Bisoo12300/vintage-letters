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

CREATE TABLE IF NOT EXISTS milestones (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'countdown',
  at TIMESTAMPTZ NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_milestones_at ON milestones(at);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  author TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subs_endpoint ON push_subscriptions(endpoint);
CREATE INDEX IF NOT EXISTS idx_push_subs_author ON push_subscriptions(author);

-- One row per reminder already pushed (dedupe across restarts and instances).
-- key = <plan|moment>:<id>:<7d|1d>:<target ISO>, so a rescheduled event gets fresh reminders.
CREATE TABLE IF NOT EXISTS reminders_sent (
  key TEXT PRIMARY KEY,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One cat each. location = whose house the cat is at right now ('moon' | 'sun');
-- xp = care points that decide how grown it is (see src/pets.js).
CREATE TABLE IF NOT EXISTS cats (
  owner TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  born_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_fed_at TIMESTAMPTZ,
  last_fed_by TEXT,
  feed_count INTEGER NOT NULL DEFAULT 0,
  xp INTEGER NOT NULL DEFAULT 0,
  location TEXT NOT NULL
);

INSERT INTO cats (owner, name, location) VALUES ('moon', 'Luna', 'moon'), ('sun', 'Sol', 'sun')
ON CONFLICT (owner) DO NOTHING;

-- Daily mood check-ins. day = YYYY-MM-DD in REMINDER_TIMEZONE (text, so no driver date shifting).
CREATE TABLE IF NOT EXISTS moods (
  author TEXT NOT NULL,
  day TEXT NOT NULL,
  emoji TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (author, day)
);

CREATE INDEX IF NOT EXISTS idx_moods_day ON moods(day);

-- Role rename: fox -> sun (idempotent, no-op once migrated)
UPDATE letters SET author = 'sun' WHERE author = 'fox';
UPDATE reading_sessions SET reader = 'sun' WHERE reader = 'fox';
UPDATE date_plans SET proposed_by = 'sun' WHERE proposed_by = 'fox';
UPDATE push_subscriptions SET author = 'sun' WHERE author = 'fox';
