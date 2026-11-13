-- A sixth outbox state (netlify/lib/deliver.mjs): 'stuck', where a row parks when its failures reach
-- the attempts ceiling. Trying on its own stops there; a person pressing Try again on the staff page
-- is what claims it again, and its last error stays on the row so the page can say why it stopped.
-- Widen the state check 001 set; every value it allowed stays valid.
ALTER TABLE outbox DROP CONSTRAINT IF EXISTS outbox_state_check;
ALTER TABLE outbox ADD CONSTRAINT outbox_state_check CHECK (state IN ('pending', 'held', 'sent', 'failed', 'cancelled', 'stuck'));
