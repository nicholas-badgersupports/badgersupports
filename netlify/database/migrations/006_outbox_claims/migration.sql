-- A claim on an outbox row while one worker sends it (netlify/lib/deliver.mjs).
-- Idempotent: safe to apply twice. Applied on deploy by Netlify Database and on boot by the local
-- rig (netlify/lib/db.mjs), so both run the same SQL.
--
-- Two function instances may run the outbox at once. Each takes its rows by setting claim_until and its
-- own claim_token in one statement, skipping rows another holds, so no row is sent by two at the same
-- time. A worker that stops mid-send leaves the claim to run out; the row is then due again and is sent
-- with the same dedupe key, which Connect keeps once. Adds two columns; changes no existing row.

ALTER TABLE outbox ADD COLUMN IF NOT EXISTS claim_until TIMESTAMPTZ;
ALTER TABLE outbox ADD COLUMN IF NOT EXISTS claim_token TEXT;
