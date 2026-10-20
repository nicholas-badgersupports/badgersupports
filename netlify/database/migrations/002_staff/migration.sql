-- Staff sign-in through Connect, and the text edits staff make on the site.
-- Idempotent: safe to apply twice. Applied on deploy by Netlify Database and on boot by the local
-- rig (netlify/lib/db.mjs), so both run the same SQL.
--
-- No staff roster lives here. Connect says who someone is and what they may do, in a signed note,
-- each time they sign in (netlify/lib/connect.mjs); a session row keeps that note for a working
-- day and nothing more. Nothing records what a signed-in person opened.

-- A sign-in that has left for Connect and not yet come back. Keyed by a hash of the state the
-- browser carries, so a leaked row cannot be replayed. Used once; expires in ten minutes.
CREATE TABLE IF NOT EXISTS auth_starts (
  state_hash  TEXT PRIMARY KEY,
  verifier    TEXT NOT NULL,
  nonce       TEXT NOT NULL,
  return_to   TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ
);

-- A signed-in director or admin. Keyed by a hash of the cookie, never the cookie itself.
-- sub is Connect's own id for the person; name is the first name Connect chose to share.
CREATE TABLE IF NOT EXISTS staff_sessions (
  id_hash     TEXT PRIMARY KEY,
  sub         TEXT NOT NULL,
  name        TEXT NOT NULL,
  scopes      JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL
);

-- A change to a word on the site, made with the edit button. The shipped files stay the floor;
-- a row here wins over them at the next publish (and at once on a local copy). Putting the
-- original back is an edit like any other, so the next publish carries the undo too. One row per
-- place, the latest edit only: previous holds the words it replaced.
CREATE TABLE IF NOT EXISTS content_edits (
  target       TEXT PRIMARY KEY,
  value        TEXT NOT NULL,
  previous     TEXT,
  edited_by    TEXT NOT NULL,
  edited_name  TEXT NOT NULL,
  edited_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
