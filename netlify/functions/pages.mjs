/* Every page address — drawn with the published revision of saved words (netlify/lib/pages.mjs). The files
   the build hashes or writes for download (assets, photos, calendar files, robots.txt, the sitemap), the
   API, and the data files the build holds back for an explorer's first use (the C-23 side files, named
   below) are left to their own answers. One address is deliberately NOT excluded: /search-index.json,
   which this function serves itself, rebuilt at every publish (netlify/lib/search-index.mjs; workflow
   audit PF-1/PF-3) — the guard test names it in FUNCTION_SERVED (netlify/lib/pages.mjs) instead. */

import { handlePage } from "../lib/pages.mjs";

export default async (req) => handlePage(req);

export const config = {
  path: "/*",
  excludedPath: [
    "/api/*", "/assets/*", "/media/*", "/calendar/*", "/robots.txt", "/sitemap.xml", "/favicon.ico",
    /* The build's deferred data files (ctx.defer in ops/build.mjs): served from dist as written.
       test/deferred-data.test.mjs fails if a held-back file is ever missing from this list. */
    "/explore/events/events-data.json", "/explore/classes/courses-data.json", "/resources/resources-data.json",
  ],
};
