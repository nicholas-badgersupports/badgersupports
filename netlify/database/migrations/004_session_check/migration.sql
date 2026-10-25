-- When Connect last vouched for a staff session's scopes (netlify/lib/staff.mjs, sessionFrom()).
-- Idempotent: safe to apply twice. Applied on deploy by Netlify Database and on boot by the local
-- rig (netlify/lib/db.mjs), so both run the same SQL.
--
-- A session row keeps Connect's note for up to eight hours. checked_at is the time of the note it
-- holds: the sign-in, or Connect's latest answer when the status check is on. Reading answers is
-- held to an hour from it, and the status check asks Connect again ten minutes after it. A row
-- written before this column existed has none, and counts from its sign-in (created_at).

ALTER TABLE staff_sessions ADD COLUMN IF NOT EXISTS checked_at TIMESTAMPTZ;
ALTER TABLE staff_sessions ALTER COLUMN checked_at SET DEFAULT now();
