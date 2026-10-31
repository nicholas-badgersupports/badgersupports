-- Every version of the page structure: pages added, copied, put on the site, moved or retired with the staff
-- page, and the menu's order (src/shared/structure.mjs, netlify/lib/structure.mjs). Newest last; the newest row
-- is the structure now. Idempotent: safe to apply twice. Applied on deploy by Netlify Database and on boot by the
-- local rig (netlify/lib/db.mjs), so both run the same SQL.
--
-- Rows here are never changed or deleted. Bringing back an earlier version writes it again as the newest.

CREATE TABLE IF NOT EXISTS site_structure (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  doc          JSONB NOT NULL,
  action       TEXT NOT NULL,
  page_id      TEXT,
  edited_by    TEXT NOT NULL,
  edited_name  TEXT NOT NULL,
  edited_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
