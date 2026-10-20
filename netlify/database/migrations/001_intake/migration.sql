-- The public site's own tables: form switches and published versions, submissions and their
-- history, the outbox that carries each submission onward, mood counts and rate limits.
-- Idempotent: safe to apply twice. Applied on deploy by Netlify Database and on boot by the local
-- rig (netlify/lib/db.mjs), so both run the same SQL.
--
-- Single owner: this site owns these rows until Connect's ingestion contract is agreed
-- (docs/ARCHITECTURE.md). Connect reads submissions through the outbox; nothing here is a copy
-- of Connect's roster.

-- A form's switch. A row here wins over the "state" in the shipped definition, so Connect can
-- open or close a form without a deploy. No row = the shipped state.
CREATE TABLE IF NOT EXISTS form_state (
  form_key        TEXT PRIMARY KEY,
  state           TEXT NOT NULL CHECK (state IN ('open', 'closed')),
  closed_message  TEXT,
  changed_by      TEXT NOT NULL,
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Definitions published from Connect. The highest version wins over the shipped file; old
-- versions are kept so every submission can be read against the questions it answered.
CREATE TABLE IF NOT EXISTS form_versions (
  form_key      TEXT NOT NULL,
  version       INTEGER NOT NULL CHECK (version >= 1),
  definition    JSONB NOT NULL,
  published_by  TEXT NOT NULL,
  published_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (form_key, version)
);

-- One row per accepted submission. Answers are keyed by stable question id. Nothing that
-- identifies the sender's connection is stored here, for any form.
CREATE TABLE IF NOT EXISTS submissions (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ref            TEXT NOT NULL UNIQUE,
  form_key       TEXT NOT NULL,
  form_version   INTEGER NOT NULL,
  version_seen   INTEGER,
  idem_key       TEXT NOT NULL,
  answers        JSONB NOT NULL,
  anonymous      BOOLEAN NOT NULL,
  status         TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_review', 'done', 'spam', 'withdrawn')),
  received_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (form_key, idem_key)
);
CREATE INDEX IF NOT EXISTS submissions_form_received ON submissions (form_key, received_at DESC);

-- What happened to a submission after it arrived, oldest first. Actors are opaque Connect ids.
CREATE TABLE IF NOT EXISTS submission_events (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  submission_id  BIGINT NOT NULL REFERENCES submissions (id),
  at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor          TEXT NOT NULL,
  kind           TEXT NOT NULL,
  detail         JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS submission_events_sub ON submission_events (submission_id, at);

-- Work that leaves this site, written in the same transaction as the submission so none is
-- lost: hand-off to Connect, the Sheets backup, email. A worker (not built in slice 1) sends
-- 'pending' rows; 'held' rows wait for a person (an unverified sender, a paused workflow).
CREATE TABLE IF NOT EXISTS outbox (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind           TEXT NOT NULL CHECK (kind IN ('connect.ingest', 'sheets.backup', 'mail.receipt', 'mail.notify')),
  submission_id  BIGINT REFERENCES submissions (id),
  dedupe_key     TEXT NOT NULL UNIQUE,
  state          TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'held', 'sent', 'failed', 'cancelled')),
  hold_reason    TEXT,
  attempts       INTEGER NOT NULL DEFAULT 0,
  next_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at        TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS outbox_due ON outbox (state, next_at);

-- The mood check-in: a count per Chicago day per mood. No row says who tapped.
CREATE TABLE IF NOT EXISTS mood_daily (
  day   DATE NOT NULL,
  mood  TEXT NOT NULL,
  n     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, mood)
);

-- Fixed-window counters. The bucket is a keyed hash of the connection and the route; windows
-- older than a day are deleted as new ones are written.
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket        TEXT NOT NULL,
  window_start  TIMESTAMPTZ NOT NULL,
  n             INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, window_start)
);
