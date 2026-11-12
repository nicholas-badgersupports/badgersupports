/* The footer's Director Sign-In, the social icons and the site icon
   (owner, 12 Nov 2026): the sign-in is a quiet text link at the end of the
   footer's legal row — never a floating circle, and never under the staff
   page's own .staff-signin rules; the TikTok glyph stays inside the same
   frame the other social icons draw; every page carries the hexagon icon. */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { build, ROOT } from "../ops/build.mjs";

const OUT = path.join(ROOT, "local", "test-build-footer-icons");
const read = (p) => fs.readFileSync(path.join(OUT, p), "utf8");
const css = () => {
  const dir = path.join(OUT, "assets", "css");
  return fs.readFileSync(path.join(dir, fs.readdirSync(dir).find((f) => f.endsWith(".css"))), "utf8");
};

test.before(async () => {
  await build({ out: OUT, serverDir: path.join(OUT, "_server"), media: false, today: "2026-10-20" });
});

test("Director Sign-In sits in the footer's legal row as a labelled text link, on every page", () => {
  for (const p of ["index.html", "404.html"]) {
    const page = read(p);
    assert.match(page, /<a href="\/staff\/" class="staff-in">/, p);
    assert.match(page, /class="staff-in"[\s\S]{0,400}<span>Director Sign-In<\/span>/, p);
    assert.doesNotMatch(page, /class="staff-signin"/, p);
  }
  const styles = css();
  assert.match(styles, /\.footer-bottom \.staff-in/, "the footer styles its own sign-in class");
  assert.doesNotMatch(styles, /\.footer-bottom \.staff-signin/, "the staff page's class earns no footer circle");
});

test("the TikTok glyph is drawn inside the frame it shares with the other social icons", () => {
  const page = read("index.html");
  const svg = page.match(/<svg class="ic social-ic" data-i="tiktok"[\s\S]*?<\/svg>/)?.[0];
  assert.ok(svg, "the TikTok icon is in the footer");
  assert.match(svg, /<circle cx="10\.63" cy="14\.15" r="1\.85"\/>/, "the note's head is a circle inside the frame");
  /* the glyph sits centred in the frame with real air around it: the space
     above it equals the space below it, and every edge keeps at least 4 grid
     units of clearance (owner, 12 Nov 2026 — first the head's bottom nearly
     touched the frame's lower line while the stem floated high, so the glyph
     was centred; then, centred at 2.45 units of air, it still crowded the
     frame, so it was scaled to about two-thirds, about its own centre, until
     its top/bottom gaps matched the Instagram lens and the WIN mark at 4.5
     units each). The frame spans 3.5..20.5; the glyph runs from the stem's
     top to the head's bottom edge, and sideways from the head's left edge to
     the stem curve's end. */
  const cx = Number(svg.match(/<circle cx="([\d.]+)"/)[1]);
  const cy = Number(svg.match(/<circle cx="[\d.]+" cy="([\d.]+)"/)[1]);
  const r = Number(svg.match(/<circle cx="[\d.]+" cy="[\d.]+" r="([\d.]+)"/)[1]);
  const stemX = Number(svg.match(/<path d="M([\d.]+)/)[1]);
  const stemTop = Number(svg.match(/V([\d.]+)c/)[1]);
  const curveDx = Number(svg.match(/ ([\d.]+) [\d.]+"\/>/)[1]);
  const above = stemTop - 3.5, below = 20.5 - (cy + r);
  const left = cx - r - 3.5, right = 20.5 - (stemX + curveDx);
  assert.ok(Math.abs(above - below) < 0.01, `the TikTok glyph is centred in its frame (above ${above}, below ${below})`);
  for (const [side, gap] of [["above", above], ["below", below], ["left", left], ["right", right]]) {
    assert.ok(gap >= 4, `the TikTok glyph keeps at least 4 units of air ${side} it (got ${gap})`);
  }
  assert.doesNotMatch(svg, /a2\.9 2\.9/, "the old arc bulged below the frame (measured 22.46 of 24)");
  for (const name of ["instagram", "linkedin", "win"]) {
    assert.match(page, new RegExp(`data-i="${name}"[^>]*><rect x="3.5" y="3.5" width="17" height="17"`), name);
  }
});

test("every page carries the hexagon site icon, and the icon files ship", () => {
  for (const p of ["index.html", "404.html"]) {
    const page = read(p);
    assert.match(page, /<link rel="icon" href="\/assets\/brand\/bss-hex\.svg" type="image\/svg\+xml">/, p);
    assert.match(page, /<link rel="icon" href="\/assets\/brand\/favicon-64\.png" type="image\/png" sizes="64x64">/, p);
    assert.match(page, /<link rel="apple-touch-icon" href="\/assets\/brand\/apple-touch-icon\.png">/, p);
    assert.doesNotMatch(page, /<link rel="icon" href="\/assets\/brand\/bss-hand-red\.png"/, p);
  }
  const hex = read("assets/brand/bss-hex.svg");
  assert.match(hex, /<polygon[^>]*fill="#B60000"/, "the hexagon is the brand red");
  assert.match(hex, /<image href="data:image\/png;base64,/, "the cream hand is embedded, so the SVG icon stands alone");
  for (const f of ["favicon-64.png", "apple-touch-icon.png"]) {
    assert.ok(fs.statSync(path.join(OUT, "assets", "brand", f)).size > 500, f);
  }
});
