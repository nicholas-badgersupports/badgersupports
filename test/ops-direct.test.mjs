/* The ops tools' own address checks (ops/direct.mjs; audit R27): a command started through a link must
   still run, against the tree its file lives in; a module another file imports must not mistake itself
   for the command. Verification pass 2 reproduced the failure from the main checkout — the tool resolved
   its root from the invoked path, so a run through a link failed where the direct run did not — and
   refuted the theory that it was an artifact of the synced worktree the audit first saw it in. */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import url from "node:url";
import { spawnSync } from "node:child_process";
import { ROOT } from "../ops/build.mjs";

const DIRECT = path.join(ROOT, "ops", "direct.mjs");
const run = (f) => spawnSync(process.execPath, [f], { encoding: "utf8" });

/* A two-line command that answers by the same check the ops tools use. */
function probe(dir) {
  const file = path.join(dir, "probe.mjs");
  fs.writeFileSync(file, `import { isDirect } from ${JSON.stringify(url.pathToFileURL(DIRECT).href)};\nconsole.log(isDirect(import.meta.url) ? "direct" : "not-direct");\n`);
  return file;
}

test("the invocation check compares real paths: through a file link and a folder link the command still runs", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bss-direct-"));
  const real = path.join(tmp, "real");
  fs.mkdirSync(real);
  const file = probe(real);
  assert.equal(run(file).stdout.trim(), "direct", "started by its own path");
  const fileLink = path.join(tmp, "probe-link.mjs");
  fs.symlinkSync(file, fileLink);
  assert.equal(run(fileLink).stdout.trim(), "direct", "started through a link to the file");
  const dirLink = path.join(tmp, "real-link");
  fs.symlinkSync(real, dirLink, "dir");
  assert.equal(run(path.join(dirLink, "probe.mjs")).stdout.trim(), "direct", "started through a link to its folder (as macOS's temporary folder is)");
});

test("a module imported by another file is not the command, by either address", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bss-direct-"));
  const file = probe(tmp);
  const other = path.join(tmp, "other.mjs");
  fs.writeFileSync(other, `import ${JSON.stringify(url.pathToFileURL(file).href)};\n`);
  assert.equal(run(other).stdout.trim(), "not-direct", "the imported module stays quiet");
  const link = path.join(tmp, "other-link.mjs");
  fs.symlinkSync(other, link);
  assert.equal(run(link).stdout.trim(), "not-direct", "a link to the importer does not make the module the command");
});

/* The scan's own verdict (today it reports one standing finding, the cards.mjs `tabindex="0"` wording —
   a separate item, decided in the testing pass) is not what this asserts: through a link the tool must
   run and report on this tree, exactly as it does by its own path. */
test("the editable scan runs the same through a link as by its own path", () => {
  const dir = path.join(ROOT, "local", "test-direct-ops");
  fs.mkdirSync(dir, { recursive: true });
  const linked = path.join(dir, "editable.mjs");
  if (!fs.existsSync(linked)) fs.symlinkSync(path.join(ROOT, "ops", "editable.mjs"), linked);
  const direct = run(path.join(ROOT, "ops", "editable.mjs")), viaLink = run(linked);
  assert.ok(viaLink.stdout.includes("text keys"), "the report printed, not a silent exit");
  assert.equal(viaLink.stdout, direct.stdout, "the same tree is scanned either way");
  assert.equal(viaLink.status, direct.status, "and it ends the same way");
});
