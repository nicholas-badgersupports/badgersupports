#!/usr/bin/env node
/* The scheduled verification run — the public site's half of the verification rhythm
 * (proposal C-40 of the 12 November 2026 audit, approved 13 November 2026;
 * docs/VERIFICATION-RHYTHM.md carries the schedule an owner follows).
 *
 *   node ops/scheduled.mjs              # the whole run, in order, logged
 *   node ops/scheduled.mjs --list       # name the stages and run nothing
 *   node ops/scheduled.mjs --print-plist  # a launchd entry that runs this weekly
 *
 * Stage 1 is the full gate with the browser: ops/check.mjs --browser — every source gate,
 * the build, the unit tests, screenshots, the accessibility pass and all twelve interact
 * groups. It is the same command a publish is decided on; the rhythm exists because the
 * rest of this file was, until now, run only when a person remembered it.
 *
 * Stage 2 is the production-data accessibility run (audit register R7, finding F-ACC-1):
 * the axe pass has only ever run against the demonstration build — hand-typed fixture
 * events and resources. This stage builds with Connect's live public lists instead
 * (node ops/build.mjs --connect: the events, resources, team and wall notes Connect holds
 * on the day), serves that build locally, and runs ops/a11y.mjs against it, forms and all
 * — the forms answer to the local server's fresh database, so nothing reaches the live
 * site or a real inbox. It needs the Connect service configuration in the environment
 * (CONNECT_URL, PUBLIC_SITE_SERVICE_KEY_ID, PUBLIC_SITE_SERVICE_SECRET — the same three
 * the production build uses on Netlify). Where they are absent the stage reports NOT RUN
 * with the reason, in its own line, never as a pass: until a run records it passing, this
 * stage is UNVERIFIED, and the summary below says so every time.
 *
 * A stage's failure stops nothing. Every stage's full output goes to one log in
 * local/scheduled-runs/ (local/ is this machine's scratch, gitignored); the console
 * carries one line per stage and the closing summary. Nothing here deploys or pushes. */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import net from "node:net";
import { finish } from "./finish.mjs";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const NODE = process.execPath;
const FEED_ENV = ["CONNECT_URL", "PUBLIC_SITE_SERVICE_KEY_ID", "PUBLIC_SITE_SERVICE_SECRET"];

const STAGES = [
  "the full gate — node ops/check.mjs --browser",
  "production-data accessibility — a build fed by Connect's live public lists, served locally, judged by ops/a11y.mjs (UNVERIFIED until a run records it passing)",
];

if (process.argv.includes("--list")) {
  console.log("the scheduled verification run, in order:");
  for (const [i, s] of STAGES.entries()) console.log(`  ${i + 1}. ${s}`);
  finish(0);
} else if (process.argv.includes("--print-plist")) {
  console.log(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>org.badgersupports.public.scheduled-checks</string>
  <key>ProgramArguments</key>
  <array>
    <string>${NODE}</string>
    <string>${path.join(HERE, "scheduled.mjs")}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${ROOT}</string>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Weekday</key>
    <integer>6</integer>
    <key>Hour</key>
    <integer>9</integer>
    <key>Minute</key>
    <integer>30</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>${path.join(ROOT, "local", "scheduled-runs", "launchd.out")}</string>
  <key>StandardErrorPath</key>
  <string>${path.join(ROOT, "local", "scheduled-runs", "launchd.out")}</string>
</dict>
</plist>`);
  finish(0);
} else {
  const stamp = () => {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
  };
  const LOG_DIR = path.join(ROOT, "local", "scheduled-runs");
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const LOG = path.join(LOG_DIR, `${stamp()}.log`);
  const say = (s) => { fs.appendFileSync(LOG, s + "\n"); console.log(s); };

  /* One stage as a child process, its output written straight into the run's log. */
  const runStage = (name, args, env = {}) => new Promise((resolve) => {
    const t0 = Date.now();
    say(`\n===== ${name} =====`);
    const fd = fs.openSync(LOG, "a");
    const child = spawn(NODE, args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: ["ignore", fd, fd] });
    child.on("error", (e) => { fs.closeSync(fd); resolve({ name, ok: false, ran: false, seconds: 0, why: `did not start: ${e.message}` }); });
    child.on("close", (code) => {
      fs.closeSync(fd);
      const seconds = Math.round((Date.now() - t0) / 1000);
      say(`----- ${name}: ${code === 0 ? "passed" : `FAILED (exit ${code})`} in ${seconds}s -----`);
      resolve({ name, ok: code === 0, ran: true, seconds });
    });
  });

  const freePort = () => new Promise((ok) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => ok(p)); });
  });

  const results = [];
  say(`the scheduled verification run — ${new Date().toString()}`);
  say(`log: ${path.relative(ROOT, LOG)}`);

  results.push(await runStage(STAGES[0], [path.join(HERE, "check.mjs"), "--browser"]));

  /* Stage 2. Absent configuration is a reported state, not a failure of the site and never
     a pass: the line names what is missing so the first person who can provide it sees why
     this stage has not run yet. */
  const missing = FEED_ENV.filter((k) => !process.env[k]);
  if (missing.length) {
    say(`\n===== ${STAGES[1]} =====`);
    say(`----- ${STAGES[1]}: DID NOT RUN — the Connect service configuration is not in this machine's environment (missing: ${missing.join(", ")}). The stage is wired and runs the first time a run has them, as Netlify's build does. Until then it is UNVERIFIED. -----`);
    results.push({ name: STAGES[1], ok: false, ran: false, seconds: 0, why: `Connect service configuration absent (${missing.join(", ")})`, unverified: true });
  } else {
    const built = await runStage("production-data build — node ops/build.mjs --connect", [path.join(HERE, "build.mjs"), "--connect"]);
    if (!built.ok) {
      results.push({ name: STAGES[1], ok: false, ran: false, seconds: 0, why: "the production-data build failed — see its stage in the log", unverified: true });
    } else {
      const port = await freePort();
      process.env.LOCAL_DB = "pglite";
      const { startServer } = await import("./dev-server.mjs");
      const server = await startServer({ port, media: true });
      try {
        results.push(await runStage(STAGES[1], [path.join(HERE, "a11y.mjs")], { BASE: `http://127.0.0.1:${port}` }));
      } finally {
        server.close();
      }
    }
  }

  say(`\n===== the scheduled verification run: summary =====`);
  for (const r of results) say(`${r.ok ? "  ok  " : " FAIL "} ${r.name}${r.ran ? ` (${r.seconds}s)` : ` — DID NOT RUN${r.why ? `: ${r.why}` : ""}`}`);
  const failed = results.filter((r) => !r.ok && !r.unverified);
  const unverified = results.filter((r) => r.unverified);
  say(failed.length
    ? `verdict: ${failed.length} stage(s) failed — read the log at ${path.relative(ROOT, LOG)}.${unverified.length ? " The production-data accessibility stage remains UNVERIFIED." : ""}`
    : unverified.length
      ? `verdict: every stage that ran passed. The production-data accessibility stage DID NOT RUN and remains UNVERIFIED — it has never yet run; see its line above.`
      : `verdict: every stage passed, the production-data accessibility stage among them. The full log is at ${path.relative(ROOT, LOG)}.`);
  finish(failed.length ? 1 : 0);
}
