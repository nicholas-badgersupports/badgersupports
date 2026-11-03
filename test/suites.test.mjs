/* The browser suites keep their whole report when read through a pipe, and check.mjs fails a suite whose report
 * has no tally line, or a tally that disagrees with what arrived, under the suite's own name (QUEUE-20).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import url from "node:url";

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const OPS = path.join(ROOT, "ops");
const { SUITES, judgeSuite, runSuite } = await import("../ops/suites.mjs");
const FINISH = `import { finish } from ${JSON.stringify(url.pathToFileURL(path.join(OPS, "finish.mjs")).href)};`;

/* A result line as each suite prints it. A suite added to SUITES without a shape here fails the tests below. */
function result(suite, ok, i) {
  if (suite.tag === "shots") return `${`/page-${i}/`.padEnd(32)} 1280px     12 KB loaded (3 KB images)${ok ? "" : "  SCROLLS SIDEWAYS by 4px"}`;
  if (suite.tag === "a11y" || suite.tag === "interact") return `${ok ? "  ok  " : "  FAIL"} check ${i}`;
  throw new Error(`no result-line shape for the suite "${suite.tag}" in test/suites.test.mjs`);
}
const report = (suite, n, failing = 0) => [
  ...Array.from({ length: n }, (_, i) => result(suite, i >= failing, i)),
  failing ? `${suite.tag}: ${failing} of ${n} failed` : `${suite.tag}: all ${n} passed`,
].join("\n") + "\n";

/* A stand-in suite that prints a long report and ends the way `ending` says. */
function fakeSuite(ending) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "suites-"));
  const file = path.join(dir, "suite.mjs");
  fs.writeFileSync(file, `${ending === "finish" ? FINISH : ""}
const line = "x".repeat(140);
for (let i = 0; i < 20000; i++) console.log(\`  ok   check \${i} \${line}\`);
console.log("interact: all 20000 passed");
${ending === "finish" ? "finish(0);" : "process.exit(0);"}
`);
  return { file, dir };
}
const interact = SUITES.find((s) => s.tag === "interact");

test("a suite that ends with finish() keeps its whole report in a pipe, and check.mjs passes it", async () => {
  const { file, dir } = fakeSuite("finish");
  try {
    const r = await runSuite(file, { cwd: ROOT, env: process.env });
    const lines = r.out.trim().split("\n");
    assert.equal(lines.length, 20001, `${lines.length} of 20001 lines arrived through the pipe`);
    assert.equal(lines.at(-1), "interact: all 20000 passed");
    assert.equal(r.status, 0);
    assert.deepEqual(judgeSuite(interact, r).problems, []);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("control: process.exit() straight after printing cuts the same report here, and check.mjs fails it by name", async (t) => {
  const { file, dir } = fakeSuite("exit");
  try {
    const r = await runSuite(file, { cwd: ROOT, env: process.env });
    const lines = r.out.trim().split("\n");
    if (lines.length === 20001) return t.skip("process.exit() kept every line on this machine, so the cut cannot be seen here");
    assert.equal(r.status, 0, "the cut report still exits 0");
    const { problems } = judgeSuite(interact, r);
    assert.ok(problems.length && problems[0].includes(interact.script) && /no tally line/.test(problems[0]),
      `a cut report (${lines.length} of 20001 lines, exit 0) passed: ${JSON.stringify(problems)}`);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("check.mjs fails a suite's report with no tally line, by the suite's name, whatever its exit status", () => {
  for (const suite of SUITES) {
    const cut = report(suite, 6).split("\n").slice(0, 4).join("\n");
    for (const status of [0, 1]) {
      const { problems } = judgeSuite(suite, { status, out: cut });
      assert.ok(problems.some((p) => p.includes(suite.script) && /no tally line/.test(p)),
        `${suite.tag}, exit ${status}, no tally line: ${JSON.stringify(problems)}`);
    }
  }
});

test("check.mjs fails a tally that disagrees with the result lines that arrived, or with the exit status", () => {
  for (const suite of SUITES) {
    const lines = report(suite, 5).split("\n");
    const short = [...lines.slice(0, 3), ...lines.slice(4)].join("\n");
    const counted = judgeSuite(suite, { status: 0, out: short }).problems;
    assert.ok(counted.some((p) => p.includes(suite.script) && /counts 5 but 4 result lines/.test(p)), `${suite.tag}, a line missing above the tally: ${JSON.stringify(counted)}`);
    const exit1 = judgeSuite(suite, { status: 1, out: report(suite, 5) }).problems;
    assert.ok(exit1.some((p) => p.includes(suite.script) && /exit 1 disagrees/.test(p)), `${suite.tag}, exit 1 under "all 5 passed": ${JSON.stringify(exit1)}`);
    const exit0 = judgeSuite(suite, { status: 0, out: report(suite, 5, 1) }).problems;
    assert.ok(exit0.some((p) => p.includes(suite.script) && /exit 0 disagrees/.test(p)), `${suite.tag}, exit 0 under "1 of 5 failed": ${JSON.stringify(exit0)}`);
  }
});

test("check.mjs passes a whole report, names it by its tally, and lists a failing one's failures", () => {
  for (const suite of SUITES) {
    const ok = judgeSuite(suite, { status: 0, out: report(suite, 7) });
    assert.deepEqual(ok.problems, [], `${suite.tag}, a whole passing report`);
    assert.equal(ok.note, `${suite.tag}: all 7 passed`);
    const bad = judgeSuite(suite, { status: 1, out: report(suite, 7, 2) });
    assert.deepEqual(bad.problems.map((p) => p.trim()), [result(suite, false, 0), result(suite, false, 1)].map((p) => p.trim()), `${suite.tag}, two failures`);
    assert.equal(bad.note, `${suite.tag}: 2 of 7 failed`);
  }
});

/* The commands that print a report end through finish(); a process.exit() anywhere else in ops/ is a short exit on this
   list, each printing a line or a few before it, which a pipe takes whole. A row whose file no longer calls it fails too. */
const SHORT_EXITS = {
  "finish.mjs": "the drain itself",
  "capture-live.mjs": "one usage line",
  "provenance.mjs": "one usage line",
  "deps-match.mjs": "a verdict line and at most a few differences",
  "contract.mjs": "one line",
};
const ENDS_THROUGH_FINISH = ["shots.mjs", "a11y.mjs", "interact.mjs", "check.mjs", "editable.mjs", "build.mjs"];

test("every command in ops/ that prints a report ends through finish(), and no other process.exit() is off the list", () => {
  const code = (f) => fs.readFileSync(path.join(OPS, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const files = fs.readdirSync(OPS).filter((f) => f.endsWith(".mjs"));
  const exits = files.filter((f) => /process\.exit\(/.test(code(f)));
  assert.ok(files.length >= 10, `${files.length} files read in ops/`);
  for (const f of ENDS_THROUGH_FINISH) {
    assert.ok(files.includes(f), `ops/${f} is listed but missing`);
    assert.ok(!/process\.exit\(/.test(code(f)), `ops/${f} calls process.exit(), which drops what a pipe has not yet taken`);
    assert.ok(/\bfinish\(/.test(code(f)), `ops/${f} does not end through finish()`);
  }
  for (const f of exits) assert.ok(SHORT_EXITS[f], `ops/${f} calls process.exit() and is not on the short-exit list`);
  for (const f of Object.keys(SHORT_EXITS)) assert.ok(exits.includes(f), `ops/${f} is on the short-exit list but no longer calls process.exit()`);
});
