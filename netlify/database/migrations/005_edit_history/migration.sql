-- Every version of the words saved with the edit button, newest last (netlify/lib/edits.mjs).
-- Idempotent: safe to apply twice. Applied on deploy by Netlify Database and on boot by the local
-- rig (netlify/lib/db.mjs), so both run the same SQL.
--
-- content_edits (migration 002) keeps only the latest words for each place; this keeps each save
-- beside it, written in the same transaction. Rows here are never changed or deleted. Restoring
-- an earlier version saves it again as a new one, so the history only ever grows.

CREATE TABLE IF NOT EXISTS content_edit_history (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  target       TEXT NOT NULL,
  value        TEXT NOT NULL,
  previous     TEXT,
  edited_by    TEXT NOT NULL,
  edited_name  TEXT NOT NULL,
  edited_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS content_edit_history_target ON content_edit_history (target, id DESC);

-- A place edited before this table existed starts its history with the latest words it holds.
-- Only a place with no history yet is copied, so applying this again adds nothing.
INSERT INTO content_edit_history (target, value, previous, edited_by, edited_name, edited_at)
SELECT c.target, c.value, c.previous, c.edited_by, c.edited_name, c.edited_at
FROM content_edits c
WHERE NOT EXISTS (SELECT 1 FROM content_edit_history h WHERE h.target = c.target);
