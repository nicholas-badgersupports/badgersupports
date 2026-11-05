-- Filing context travels beside answers. Existing records keep empty context; delivery retries
-- read the accepted row rather than a visitor's later address or a newer active cycle.
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS context JSONB NOT NULL DEFAULT '{}'::jsonb
  CHECK (jsonb_typeof(context) = 'object');
