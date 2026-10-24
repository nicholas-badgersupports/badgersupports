/* Netlify Build plugin (netlify.toml › plugins): stops a deploy before it publishes when its build didn't pack every
 * migration (check.js says why that can happen). Runs after the build, where Netlify's own copy step has had its turn;
 * a stopped deploy leaves the published site as it was. The deployed API never migrates by itself (netlify/lib/db.mjs
 * migrates only the local rig), so without this a publish could put code online ahead of its tables. */

import path from "node:path";
import { unstaged } from "./check.js";

export const onPostBuild = ({ constants, utils }) => {
  const src = path.resolve(constants.DB_MIGRATIONS_SRC || "netlify/database/migrations");
  const dist = path.resolve(constants.DB_MIGRATIONS_DIST || ".netlify/internal/db/migrations");
  const { total, missing, changed } = unstaged(src, dist);
  if (!missing.length && !changed.length) {
    console.log(`Migrations guard: all ${total} migrations are packed for this deploy.`);
    return;
  }
  const parts = [
    missing.length ? `${missing.length} of ${total} not packed (${missing.join(", ")})` : null,
    changed.length ? `${changed.length} packed with different SQL (${changed.join(", ")})` : null,
  ].filter(Boolean).join("; ");
  utils.build.failBuild(
    `Migrations guard: this deploy would not carry the database migrations: ${parts}. Netlify's build skipped its ` +
    `"Netlify Database setup" step, so publishing would put the code ahead of the database. Nothing was published. ` +
    `Run PUBLISH-WEBSITE-2026-10-23.command again from the laptop; if it stops here again, tell Netlify support the ` +
    `build skipped "Netlify Database setup", and send Claude a screenshot.`);
};
