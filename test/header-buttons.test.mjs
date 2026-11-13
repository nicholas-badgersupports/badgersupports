/* Header button rows (owner, 12 Nov 2026): in a page opening's row the primary keeps the full
   treatment and every other pill goes quieter in the header's own colour — never grey, never the
   old white — and on a desktop the row never wraps. These tests pin the rules in blocks.css and
   re-measure the shipped colour pairs from tokens.css. */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const css = fs.readFileSync(path.join(ROOT, "src/styles/blocks.css"), "utf8");
const tokens = fs.readFileSync(path.join(ROOT, "src/styles/tokens.css"), "utf8");

const rule = (selector) => {
  const i = css.indexOf(selector);
  assert.ok(i >= 0, `rule for ${selector}`);
  return css.slice(i, css.indexOf("}", i));
};

test("pagehead and feature-card pills wear the header's own tint, deep words, no white", () => {
  const r = rule(".pagehead-actions .go, .feature-actions .go");
  assert.match(r, /background: var\(--accent-tint\)/);
  assert.match(r, /color: var\(--accent-deep\)/);
  assert.doesNotMatch(r, /--field|#fff|white/i);
  const badge = rule(".pagehead-actions .go .go-ic, .feature-actions .go .go-ic");
  assert.match(badge, /color-mix\(in srgb, var\(--accent\) 16%, transparent\)/);
  assert.match(badge, /color: var\(--accent-deep\)/);
});

test("event-hero pills are a cream wash over the hero's own colour, cream words", () => {
  const r = rule(".eventhero .more-links .go");
  assert.match(r, /background: color-mix\(in srgb, var\(--cream\) 7%, transparent\)/);
  assert.match(r, /color: var\(--cream\)/);
  assert.doesNotMatch(r, /--field|#fff/i);
});

test("on a desktop the header rows never wrap; they scroll in their own strip instead", () => {
  for (const sel of [".pagehead-actions", ".feature-actions", ".eventhero .more-links"]) {
    const j = css.indexOf(sel + " { flex-wrap: nowrap");
    assert.ok(j >= 0, `${sel} nowrap rule`);
    const media = css.lastIndexOf("@media", j);
    assert.match(css.slice(media, css.indexOf("{", media)), /min-width: 861px/, `${sel} is in the desktop block`);
    const r = css.slice(j, css.indexOf("}", j));
    assert.match(r, /overflow-x: auto/, sel);
    assert.match(r, /scrollbar-width: none/, sel);
  }
});

/* --- the shipped pairs, re-measured from tokens.css --- */
const tok = (name) => tokens.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`))[1];
const lum = (hex) => {
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(1 + i, 3 + i), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
const mix = (fg, bg, t) => "#" + [0, 2, 4].map((i) => {
  const f = parseInt(fg.slice(1 + i, 3 + i), 16), b = parseInt(bg.slice(1 + i, 3 + i), 16);
  return Math.round(t * f + (1 - t) * b).toString(16).padStart(2, "0");
}).join("");

const SETS = {
  red: ["red", "red-deep", "red-tint"],
  peer: ["peer", "peer-deep", "peer-tint"],
  craft: ["craft", "craft-deep", "craft-tint"],
  workshops: ["workshops", "workshops-deep", "workshops-tint"],
};

test("every header colour's quiet pairs pass WCAG AA for text", () => {
  const cream = tok("cream");
  for (const [name, [a, d, t]] of Object.entries(SETS)) {
    const accent = tok(a), deep = tok(d), tint = tok(t);
    assert.ok(ratio(deep, tint) >= 4.5, `${name}: deep on tint ${ratio(deep, tint).toFixed(2)}`);
    assert.ok(ratio(deep, mix(accent, tint, 0.18)) >= 4.5, `${name}: deep on tint hover ${ratio(deep, mix(accent, tint, 0.18)).toFixed(2)}`);
    assert.ok(ratio(cream, mix(cream, accent, 0.07)) >= 4.5, `${name}: cream on washed accent ${ratio(cream, mix(cream, accent, 0.07)).toFixed(2)}`);
    assert.ok(ratio(cream, mix(deep, accent, 0.30)) >= 4.5, `${name}: cream on hero hover ${ratio(cream, mix(deep, accent, 0.30)).toFixed(2)}`);
  }
});

test("the workshops opening still lists its workshops beside the primary", () => {
  const page = JSON.parse(fs.readFileSync(path.join(ROOT, "content/pages/request-a-workshop.json"), "utf8"));
  const head = page.blocks.find((b) => b.type === "pagehead");
  assert.ok(head.primary, "primary present");
  assert.ok((head.links || []).length >= 4, "the four workshop pills the row carries");
});
