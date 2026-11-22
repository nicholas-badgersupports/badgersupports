-- Staff-session limits (hardening item H-P1; netlify/lib/staff.mjs). `auth_at` is when the
-- person behind a staff session proved themselves to Connect, kept apart from the session's
-- own start: the publish step-up measures from it. `seen_at` is the session's last use, for
-- the idle limit. A session already running when this lands has no auth_at (the code reads
-- its start in its place) and is given a fresh idle window from now, not cut off mid-work.
ALTER TABLE staff_sessions ADD COLUMN IF NOT EXISTS auth_at TIMESTAMPTZ;
ALTER TABLE staff_sessions ADD COLUMN IF NOT EXISTS seen_at TIMESTAMPTZ;
UPDATE staff_sessions SET seen_at = now() WHERE seen_at IS NULL;
