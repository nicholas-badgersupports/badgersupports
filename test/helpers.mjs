/* Shared by the suites: a fresh database each, the shipped content as the API sees it, and
   fictional answers. Nobody in these files is a real person. */

import { freshPglite, useAdapter } from "../netlify/lib/db.mjs";
import { useContent } from "../netlify/lib/content.mjs";
import { loadContent } from "../ops/build.mjs";

export async function freshServer({ textEdits = {} } = {}) {
  process.env.LOCAL_DB = "pglite";
  const db = await freshPglite();
  useAdapter(db);
  const c = loadContent({ textEdits });
  useContent({
    schema: "bss.server/1", prototype: true, site: c.site, routes: c.routes, builtPaths: c.pages.map((p) => p.path),
    forms: c.forms, mood: c.mood, media: c.media, text: c.text, assets: { css: "/assets/css/test.css", js: { "site.js": "/s.js", "form.js": "/f.js", "mood.js": "/m.js" } },
    formPages: { "workshop-request": { id: "pg-form-workshop-request", path: "/forms/workshop-request/", title: "Request a workshop — Badger Supports", blockId: "b-form-workshop", blockTitle: "request a workshop" } },
  });
  return db;
}

export const ORIGIN = "http://site.test";

export function workshopAnswers(over = {}) {
  return {
    _form: "workshop-request", _version: "1",
    name: "Avery Example", email: "avery@example.org", affiliation: "Example Hall Council", attendees: "25",
    topics: ["stress_self_care"], option_1: "2026-11-02T18:00", option_2: "2026-11-03T18:00", option_3: "2026-11-04T18:00",
    location: "Example Hall lounge", projection: "yes", group_notes: "First workshop for the group.", access_needs: "None known.",
    ...over,
  };
}

export const post = (path, body, { json = true, origin = ORIGIN, headers = {} } = {}) => new Request(ORIGIN + path, {
  method: "POST",
  headers: { "content-type": json ? "application/json" : "application/x-www-form-urlencoded", origin, ...(json ? { accept: "application/json" } : {}), ...headers },
  body: json ? JSON.stringify(body) : new URLSearchParams(Object.entries(body).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x]) : [[k, v]]))).toString(),
});
