-- Presentation and intake windows change without replacing questions or historical definitions.
CREATE TABLE IF NOT EXISTS form_settings (
  form_key TEXT PRIMARY KEY,
  version INTEGER NOT NULL,
  settings JSONB NOT NULL,
  changed_by TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS form_settings_history (
  id BIGSERIAL PRIMARY KEY,
  form_key TEXT NOT NULL,
  version INTEGER NOT NULL,
  settings JSONB NOT NULL,
  changed_by TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(form_key, version)
);
