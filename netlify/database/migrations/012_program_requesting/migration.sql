-- The per-program requesting switch (owner, 23 Nov 2026): one row per program a director has
-- switched, mirroring form_state (001). No row means requesting is on, so every program behaves
-- as it did before the switch existed until a director turns it off.
CREATE TABLE IF NOT EXISTS program_state (
  program_key text PRIMARY KEY,
  state text NOT NULL CHECK (state IN ('on', 'off')),
  changed_by text,
  changed_at timestamptz NOT NULL DEFAULT now()
);
