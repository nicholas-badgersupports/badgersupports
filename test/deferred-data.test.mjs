/* The build's deferred data files and the page function's claim. A block can hold its full list
   back for its script to fetch on first use (ctx.defer in ops/build.mjs); the build writes the
   file beside its page in dist. But the page function (netlify/functions/pages.mjs) claims every
   address that is not on its exclusion list and answers its own 404 page for a path that names
   no page — so a held-back file the list misses can never be fetched, and its explorer never
   loads (the Campus Events Explorer, live 13 November 2026: the file was in the deploy, the
   function answered 404, and the explorer kept its build-time first screen forever). These
   tests read the build's own list of held-back files and the function's own config, so a
   fourth deferred file cannot ship silently broken. */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { build, ROOT } from "../ops/build.mjs";
import { config as pageConfig } from "../netlify/functions/pages.mjs";

const OUT = path.join(ROOT, "local", "test-build-deferred");
let report;

test.before(async () => {
  report = await build({ out: OUT, serverDir: path.join(OUT, "_server"), media: false, today: "2026-10-20" });
});

/* The exclusion list's matching, as Netlify and the rig both read it: an entry covers an
   address when it names it exactly, or ends in /* and the address starts with its stem. */
const covered = (p) => pageConfig.excludedPath.some((x) => x === p || (x.endsWith("/*") && p.startsWith(x.slice(0, -1))));

test("the build holds back the three explorers' data files, written beside their pages", () => {
  for (const f of ["/explore/events/events-data.json", "/explore/classes/courses-data.json", "/resources/resources-data.json"]) {
    assert.ok(report.dataFiles.includes(f), `${f} is held back by the build`);
    assert.ok(fs.existsSync(path.join(OUT, f)), `${f} is written beside its page`);
  }
});

test("every held-back file stands outside the page function's claim", () => {
  assert.ok(report.dataFiles.length > 0, "the build held something back");
  for (const f of report.dataFiles) {
    assert.ok(covered(f), `${f} is claimed by the page function (path ${JSON.stringify(pageConfig.path)}) and missing from excludedPath — its first fetch would answer the 404 page`);
  }
});
