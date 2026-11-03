/* The browser suites check.mjs runs, and how it reads each one's report.
 *
 * A suite prints one result line per check, then its tally as its last line: "<tag>: all N passed" or
 * "<tag>: F of N failed". check.mjs fails the suite under its own name, whatever its exit status, when the report
 * has no tally line (cut, or the suite stopped early), when the tally's N differs from the result lines that
 * arrived, or when the exit status disagrees with the tally.
 */
import { spawn } from "node:child_process";

export const SUITES = [
  { name: "screenshots and page weight", script: "ops/shots.mjs", tag: "shots", result: /^\/\S*\s+\d+px\s+\d+ KB loaded/ },
  { name: "accessibility and the real forms", script: "ops/a11y.mjs", tag: "a11y", result: /^ {2}(?:ok {2}|FAIL) / },
  { name: "menus and uploads, pressed and timed", script: "ops/interact.mjs", tag: "interact", result: /^ {2}(?:ok {2}|FAIL) / },
];

const FAILURE = /FAIL|ERROR|SCROLLS|Error/;

/* Not spawnSync: check.mjs serves the site from its own process, and a blocked event loop never answers the browser. */
export function runSuite(script, { cwd, env }) {
  return new Promise((ok) => {
    const c = spawn(process.execPath, [script], { cwd, env });
    let out = "";
    c.stdout.on("data", (d) => (out += d));
    c.stderr.on("data", (d) => (out += d));
    c.on("error", (e) => ok({ status: null, out: `${out}\n${script} did not start: ${e.message}` }));
    c.on("close", (status) => ok({ status, out }));
  });
}

export function judgeSuite(suite, { status, out }) {
  const lines = out.replace(/\s+$/, "").split("\n");
  const failures = lines.filter((l) => FAILURE.test(l));
  const tally = new RegExp(`^${suite.tag}: (?:all (\\d+) passed|(\\d+) of (\\d+) failed)\\b`);
  const at = lines.findLastIndex((l) => tally.test(l));
  if (at < 0) {
    return {
      problems: [`${suite.script}: no tally line ("${suite.tag}: …") — the report was cut or the suite stopped early (exit ${status}, ${lines.length} lines arrived)`, ...failures],
      note: lines.at(-1) || "(no output)",
    };
  }
  const [, all, bad, of] = lines[at].match(tally);
  const total = Number(all ?? of);
  const failed = all ? 0 : Number(bad);
  const results = lines.filter((l) => suite.result.test(l)).length;
  const problems = [];
  if (results !== total) problems.push(`${suite.script}: its tally counts ${total} but ${results} result lines arrived`);
  if ((status === 0) !== (failed === 0)) problems.push(`${suite.script}: exit ${status} disagrees with its tally ("${lines[at]}")`);
  if (status !== 0 || failed) problems.push(...failures);
  if ((status !== 0 || failed) && !problems.length) problems.push(`${suite.script}: exit ${status}, "${lines[at]}"`);
  return { problems, note: lines[at] };
}
