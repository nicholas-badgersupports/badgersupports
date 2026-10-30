-- How the Connect session behind a staff session was opened (netlify/lib/staff.mjs; Connect GOOGLE-SIGNIN, WORK item 20).
-- Idempotent: safe to apply twice. Applied on deploy by Netlify Database and on boot by the local rig.
--
-- Connect's signed note says `method`: "password" or "google". It is kept with the session and sent back with each status
-- check (CONNECT_SESSION_STATUS=on), so Connect can end a Google-opened session here when its Google route is switched
-- off. A row written before this column existed, or a note without the field, is a password one.

ALTER TABLE staff_sessions ADD COLUMN IF NOT EXISTS method TEXT NOT NULL DEFAULT 'password';
