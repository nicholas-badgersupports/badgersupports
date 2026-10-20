/* Is every word editable? Lists any word the code prints that is not a text key.
 *
 *   node ops/editable.mjs
 *
 * Words a visitor reads live in one of: page content (content/pages), site settings
 * (content/site.json), form definitions (content/forms), the mood list (content/widgets), the
 * media list (alt text), or the text registry (content/text.json). Code holds none. This reads
 * every renderer, browser script and server module and fails on:
 *   - words in the markup of an html`…` template, or in an aria-label, alt, title or placeholder;
 *   - a word passed straight to link(), or offered as a fallback with ||;
 *   - a word put on the page by a browser script (textContent, append, setAttribute, innerHTML);
 *   - a t("key") that the registry lacks, or that a browser script uses without CLIENT_TEXT
 *     sending it to the page.
 * Keys nobody uses are listed as a warning, not a failure.
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { CLIENT_TEXT } from "../src/shared/text.mjs";

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const WORD = /[A-Za-z]{2,}/;
const A11Y_ATTRS = /\b(aria-label|aria-description|alt|title|placeholder)="([^"]*)"/g;

function walk(dir, ext) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p, ext));
    else if (ext.some((x) => e.name.endsWith(x))) out.push(p);
  }
  return out;
}

/* The static parts of every html`…` template in a source file, with "\u0001" where each ${…} was.
   A small scanner: it skips comments and strings, and follows ${…} into nested templates. */
export function htmlTemplates(src) {
  const found = [];
  let i = 0;
  function skipString(q) { i++; while (i < src.length && src[i] !== q) { if (src[i] === "\\") i++; i++; } i++; }
  function readTemplate(tagged) {
    i++; // past the opening backtick
    let text = "";
    while (i < src.length && src[i] !== "`") {
      if (src[i] === "\\") { text += src[i + 1]; i += 2; continue; }
      if (src[i] === "$" && src[i + 1] === "{") { i += 2; readCode(1); text += "\u0001"; continue; }
      text += src[i++];
    }
    i++;
    if (tagged) found.push(text);
  }
  function readCode(depth) {
    while (i < src.length && depth > 0) {
      const c = src[i];
      if (c === "/" && src[i + 1] === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
      if (c === "/" && src[i + 1] === "*") { i = src.indexOf("*/", i + 2) + 2; continue; }
      if (c === '"' || c === "'") { skipString(c); continue; }
      if (c === "`") { readTemplate(/html\s*$/.test(src.slice(Math.max(0, i - 8), i))); continue; }
      if (c === "{") depth++;
      if (c === "}") depth--;
      i++;
    }
  }
  readCode(Infinity);
  return found;
}

function templateProblems(file, src) {
  const out = [];
  for (const tpl of htmlTemplates(src)) {
    for (const m of tpl.matchAll(A11Y_ATTRS)) {
      const v = m[2].replace(/\u0001/g, "");
      if (WORD.test(v)) out.push(`${file}: ${m[1]}="${m[2].replace(/\u0001/g, "${…}")}"`);
    }
    const text = tpl.replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]*>/g, "\u0002");
    for (const seg of text.split("\u0002")) {
      const words = seg.replace(/\u0001/g, " ").replace(/&[a-z]+;|&#\d+;/g, " ").trim();
      if (WORD.test(words)) out.push(`${file}: text "${words.slice(0, 60)}"`);
    }
  }
  return out;
}

const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

function literalProblems(file, src, { client }) {
  const out = [];
  const code = stripComments(src);
  const lit = String.raw`(["'\`])((?:(?!\1)[^\\]|\\.)*?)\1`;
  const rules = [
    [new RegExp(String.raw`\blink\(ctx,[^,]+,\s*` + lit, "g"), "link text"],
    [new RegExp(String.raw`\|\|\s*` + lit, "g"), "fallback", (v) => /[A-Z ]/.test(v)],
  ];
  if (client) {
    rules.push(
      [new RegExp(String.raw`textContent\s*[:=]\s*` + lit, "g"), "textContent"],
      [new RegExp(String.raw`\.(?:append|prepend|after|before|replaceChildren)\(\s*` + lit, "g"), "inserted text"],
      [new RegExp(String.raw`setAttribute\(\s*["'](?:aria-label|title|alt|placeholder)["']\s*,\s*` + lit, "g"), "attribute"],
    );
    if (/\.innerHTML\s*=/.test(code)) out.push(`${file}: innerHTML (build elements and set textContent instead)`);
  }
  for (const [re, what, extra] of rules) {
    for (const m of code.matchAll(re)) {
      const v = m[2].replace(/\$\{[^}]*\}/g, "");
      if (WORD.test(v) && (!extra || extra(v))) out.push(`${file}: ${what} "${m[2].slice(0, 60)}"`);
    }
  }
  return out;
}

/* Hard-coded words in one source file. Exported so the tests can prove the scan catches one. */
export function sourceProblems(rel, src, { client = false } = {}) {
  return [...templateProblems(rel, src), ...literalProblems(rel, src, { client })];
}

/* Every key the code asks for: t("a.b"), ctx.t("a.b"), and t(`a.${x}`) as the prefix "a.". */
function keysUsed(src) {
  const exact = new Set();
  const prefixes = new Set();
  for (const m of src.matchAll(/\bt\(\s*"([a-zA-Z0-9.]+)"/g)) exact.add(m[1]);
  for (const m of src.matchAll(/\bt\(\s*`([a-zA-Z0-9.]+)\$\{/g)) prefixes.add(m[1]);
  for (const m of src.matchAll(/\bt\(\s*[^)"`]*\?\s*"([a-zA-Z0-9.]+)"\s*:\s*"([a-zA-Z0-9.]+)"/g)) { exact.add(m[1]); exact.add(m[2]); }
  return { exact, prefixes };
}

export function editableReport() {
  const registry = JSON.parse(fs.readFileSync(path.join(ROOT, "content/text.json"), "utf8"));
  const keys = new Set(Object.keys(registry.text));
  const problems = [];
  const used = new Set();
  const usedPrefixes = new Set();
  const files = [
    ...walk(path.join(ROOT, "src/render"), [".mjs"]).map((f) => ({ f, client: false })),
    ...walk(path.join(ROOT, "src/client"), [".js"]).map((f) => ({ f, client: true })),
    ...walk(path.join(ROOT, "netlify"), [".mjs"]).map((f) => ({ f, client: false })),
    { f: path.join(ROOT, "src/shared/forms.mjs"), client: false },
  ];
  for (const { f, client } of files) {
    const rel = path.relative(ROOT, f);
    const src = fs.readFileSync(f, "utf8");
    problems.push(...sourceProblems(rel, src, { client }));
    const k = keysUsed(src);
    for (const key of k.exact) {
      used.add(key);
      if (!keys.has(key)) problems.push(`${rel}: t("${key}") is not in content/text.json`);
    }
    for (const p of k.prefixes) {
      usedPrefixes.add(p);
      if (![...keys].some((key) => key.startsWith(p))) problems.push(`${rel}: no text key starts with "${p}"`);
    }
    if (client) {
      const allowed = CLIENT_TEXT[path.basename(f)] || [];
      const sent = (key) => allowed.some((a) => (a.endsWith(".*") ? key.startsWith(a.slice(0, -1)) : a === key));
      for (const key of k.exact) if (!sent(key)) problems.push(`${rel}: uses "${key}" but CLIENT_TEXT does not send it to the page`);
    }
  }
  // errorText() takes its keys from a switch over codes, through t: count those as used.
  for (const key of keys) if (key.startsWith("form.error.")) used.add(key);
  for (const list of Object.values(CLIENT_TEXT)) for (const k of list) if (!k.endsWith(".*") && !keys.has(k)) problems.push(`src/shared/text.mjs: CLIENT_TEXT names "${k}", which is not a text key`);
  const unused = [...keys].filter((k) => !used.has(k) && ![...usedPrefixes].some((p) => k.startsWith(p)));
  return { problems, unused, keys: keys.size, files: files.length };
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  const r = editableReport();
  for (const p of r.problems) console.log(`  not editable: ${p}`);
  for (const k of r.unused) console.log(`  unused key:   ${k}`);
  console.log(`${r.files} files, ${r.keys} text keys: ${r.problems.length} words not editable, ${r.unused.length} keys unused`);
  process.exit(r.problems.length ? 1 : 0);
}
