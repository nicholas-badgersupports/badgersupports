-- Files that go up with an application: a resume or cover letter, one PDF of at most 3 MB.
-- Idempotent: safe to apply twice. Applied on deploy by Netlify Database and on boot by the local
-- rig (netlify/lib/db.mjs), so both run the same SQL.
--
-- A file arrives in its own request before Send (netlify/lib/files.mjs) and waits here, unclaimed,
-- under a random id the browser holds. Send claims it for the submission in the same transaction
-- that saves the answers. There is no route that reads a file back, and no address it can be
-- fetched from: Connect will collect it through the outbox, and only then can the bytes go.
-- An upload nobody claimed is deleted after a day, as new ones arrive.

CREATE TABLE IF NOT EXISTS uploads (
  file_id        TEXT PRIMARY KEY,
  form_key       TEXT NOT NULL,
  question       TEXT NOT NULL,
  name           TEXT NOT NULL,
  type           TEXT NOT NULL CHECK (type = 'application/pdf'),
  bytes          INTEGER NOT NULL CHECK (bytes > 0 AND bytes <= 3145728),
  sha256         TEXT NOT NULL,
  data           BYTEA,
  submission_id  BIGINT REFERENCES submissions (id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at     TIMESTAMPTZ,
  delivered_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS uploads_unclaimed ON uploads (created_at) WHERE submission_id IS NULL;
CREATE INDEX IF NOT EXISTS uploads_submission ON uploads (submission_id);
