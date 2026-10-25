/* One command for "does this work": every gate and every suite, ending in a verdict line.
 *
 *   node ops/check.mjs              # source gates, build, tests (no network)
 *   node ops/check.mjs --browser    # …and screenshots, axe, the real forms, menus and uploads in Chromium
 *
 * Nothing here deploys, pushes or contacts anyone. The verdict says whether the work is ready to
 * show; publishing is the owner's decision (WORK.md, owner actions).
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import net from "node:net";
import { spawn, spawnSync } from "node:child_process";
import { build } from "./build.mjs";
import { editableReport } from "./editable.mjs";

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const results = [];
const gate = (name, problems, note = "") => {
  results.push({ name, ok: problems.length === 0, problems, note });
  console.log(`${problems.length ? "FAIL" : " ok "}  ${name}${note ? ` — ${note}` : ""}`);
  for (const p of problems.slice(0, 25)) console.log(`        ${p}`);
  if (problems.length > 25) console.log(`        …and ${problems.length - 25} more`);
};

function walk(dir, skip = []) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.includes(e.name) || e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p, skip));
    else out.push(p);
  }
  return out;
}
const REPO_SKIP = ["node_modules", "dist", "local"];
const repoFiles = walk(ROOT, REPO_SKIP).filter((f) => /\.(mjs|js|json|css|md|sql|toml|html|txt)$/.test(f));
const rel = (f) => path.relative(ROOT, f);

/* 1. The words: every one editable. */
{
  const r = editableReport();
  gate("every word is editable", r.problems, `${r.keys} text keys over ${r.files} source files${r.unused.length ? `; unused: ${r.unused.join(", ")}` : ""}`);
}

/* 1b. The Connect editor contract says what the code enforces. */
{
  const { contract } = await import("./contract.mjs");
  const file = path.join(ROOT, "docs", "CONNECT-EDITOR-CONTRACT.md");
  const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  gate("the Connect editor contract is current", current === contract() ? [] : ["docs/CONNECT-EDITOR-CONTRACT.md differs from the code: run node ops/contract.mjs"]);
}

/* 2. Colours live in tokens.css only (the generated media and mood rules are written by the build). */
{
  const problems = [];
  for (const f of walk(path.join(ROOT, "src"))) {
    if (f.endsWith("tokens.css")) continue;
    const text = fs.readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const m of text.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\(/g)) {
      // A fragment link (href="#e-…") is not a colour.
      if (/^#[0-9a-f]{3,8}$/i.test(m[0]) && /["'`]#/.test(text.slice(m.index - 1, m.index + 1))) continue;
      problems.push(`${rel(f)}: ${m[0]}`);
    }
  }
  gate("colours come from tokens.css", problems);
}

/* 3. The type floor: nothing a person reads below 14px. */
{
  const problems = [];
  for (const f of walk(path.join(ROOT, "src/styles"))) {
    const text = fs.readFileSync(f, "utf8");
    for (const m of text.matchAll(/font(?:-size)?:\s*(?:\d{3}\s+)?([0-9.]+)(rem|px|em)\b/g)) {
      const px = m[2] === "px" ? Number(m[1]) : Number(m[1]) * 16;
      if (px < 14) problems.push(`${rel(f)}: ${m[0]} (${px}px)`);
    }
  }
  gate("no text under 14px", problems);
}

/* 4. Nothing private in the repository: no addresses but the organisation's and examples, no
   phone numbers but the crisis lines, no credentials, no staff profile paths (names stay out of
   this public repo). The resource list is Connect's directory of public services: every address
   and number in it is a service's own public line, so only the credential scan reads it. The
   email list's subscribe address is the organisation's own, printed on its Join Our Email List form. */
{
  const problems = [];
  const okEmail = /@(badgersupports\.org|example\.org|example\.com)$|^name@wisc\.edu$|^badgersupports\+subscribe@g-groups\.wisc\.edu$/;
  const okPhone = new Set(["608-265-5600", "6082655600", "741741"]);
  const directory = path.join(ROOT, "content", "fixtures", "resources.json");
  for (const f of repoFiles) {
    const text = fs.readFileSync(f, "utf8");
    if (f !== directory) {
      for (const m of text.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)) if (!okEmail.test(m[0])) problems.push(`${rel(f)}: address ${m[0]}`);
      for (const m of text.matchAll(/\b(?:\+?1[ -.]?)?\(?\d{3}\)?[ -.]\d{3}[ -.]\d{4}\b/g)) if (!okPhone.has(m[0].replace(/^\+?1[ -.]?/, "").replace(/[() .]/g, "-").replace(/^-|-(?=-)/g, ""))) problems.push(`${rel(f)}: phone ${m[0]}`);
    }
    if (/AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,}|xox[bpa]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY|sk-[A-Za-z0-9]{20,}|postgres(ql)?:\/\/[^\s"']+:[^\s"']+@/.test(text)) problems.push(`${rel(f)}: looks like a credential`);
    for (const m of text.matchAll(/\/about\/our-team\/(advisors|directors|general-staff|volunteers)\/[a-z]/g)) problems.push(`${rel(f)}: staff profile path ${m[0]}…`);
  }
  gate("nothing private in the repository", problems, `${repoFiles.length} files read`);
}

/* 5. WORK.md stays short enough to read. */
{
  const f = path.join(ROOT, "WORK.md");
  const n = fs.existsSync(f) ? fs.readFileSync(f, "utf8").split("\n").length : 0;
  gate("WORK.md under 180 lines", !fs.existsSync(f) ? ["WORK.md is missing"] : n >= 180 ? [`${n} lines`] : [], `${n} lines`);
}

/* 6. The build: content checked, pages written. */
let report = null;
{
  const problems = [];
  try {
    report = await build({ today: process.argv.find((a) => a.startsWith("--today="))?.split("=")[1] || null });
  } catch (e) {
    problems.push(...(e.problems || [e.message]));
  }
  if (report) {
    for (const p of report.pages) {
      const file = p.path.endsWith(".html") ? path.join(ROOT, "dist", p.path) : path.join(ROOT, "dist", p.path, "index.html");
      const html = fs.readFileSync(file, "utf8");
      if (/href="#"/.test(html)) problems.push(`${p.path}: href="#"`);
      if (/\sstyle="/.test(html)) problems.push(`${p.path}: style attribute`);
      if ((html.match(/<h1[\s>]/g) || []).length !== 1) problems.push(`${p.path}: needs exactly one h1`);
    }
  }
  gate("the build", problems, report ? `${report.pages.length} pages for ${report.today}, ${report.media.variants} image variants, ${report.pendingLinks.length} links still to the live site, ${report.redirectsWaiting.length} redirects waiting` : "");
}

/* 7. Every suite, each on its own fresh database. */
{
  const r = spawnSync(process.execPath, ["--test", "--test-concurrency=1", "test/*.test.mjs"], { cwd: ROOT, encoding: "utf8", env: { ...process.env, LOCAL_DB: "pglite" } });
  const out = r.stdout + r.stderr;
  const num = (k) => Number((out.match(new RegExp(`ℹ ${k} (\\d+)`)) || [])[1] || 0);
  const failed = [...out.matchAll(/^✖ (.+?) \(\d/gm)].map((m) => m[1]).filter((v, i, a) => a.indexOf(v) === i && v !== "failing tests:");
  gate("tests", r.status === 0 ? [] : failed.length ? failed : [out.slice(-2000)], `${num("pass")} passed, ${num("fail")} failed`);
}

/* 8. In a browser, against a local server on a free port (never one somebody else is using). */
if (process.argv.includes("--browser")) {
  const port = await new Promise((ok) => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => ok(p)); }); });
  process.env.LOCAL_DB = "pglite";
  const { startServer } = await import("./dev-server.mjs");
  const server = await startServer({ port });
  const env = { ...process.env, BASE: `http://127.0.0.1:${port}` };
  for (const [name, script] of [["screenshots and page weight", "ops/shots.mjs"], ["accessibility and the real forms", "ops/a11y.mjs"], ["menus and uploads, pressed and timed", "ops/interact.mjs"]]) {
    /* Not spawnSync: the server runs in this process, and a blocked event loop never answers the browser. */
    const r = await new Promise((ok) => {
      const c = spawn(process.execPath, [script], { cwd: ROOT, env });
      let out = "";
      c.stdout.on("data", (d) => (out += d));
      c.stderr.on("data", (d) => (out += d));
      c.on("close", (status) => ok({ status, out }));
    });
    const lines = r.out.trim().split("\n");
    gate(name, r.status === 0 ? [] : lines.filter((l) => /FAIL|ERROR|SCROLLS|Error/.test(l)), lines.at(-1));
  }
  server.close();
}

const failed = results.filter((r) => !r.ok);
console.log("");
console.log(failed.length
  ? `verdict: ${failed.length} gate(s) failed (${failed.map((r) => r.name).join(", ")}) — not ready to show.`
  : `verdict: everything passed${process.argv.includes("--browser") ? ", in the browser too" : " (browser checks not run: add --browser)"} — ready for Nicholas to review. Nothing was deployed; publishing stays the owner's decision.`);
process.exit(failed.length ? 1 : 0);
