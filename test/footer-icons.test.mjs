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

/* The SPILL chip's source order (UX placement audit finding 7, 16 Nov 2026): the chip renders at
   the foot of the brand column, below the three columns' links, so its markup stands after the
   columns — reading and focus order match the page as seen. The grid places it back into the
   brand column's cell and the brand reserves its space, so nothing about its place or shape
   changes: the built CSS carries both halves of that placement. */
test("the footer's SPILL chip stands after the three columns in source order, and the grid places it at the foot of the brand column", () => {
  for (const p of ["index.html", "404.html"]) {
    const page = read(p);
    const footer = page.match(/<footer class="site-footer">[\s\S]*?<\/footer>/)[0];
    const at = (needle) => footer.indexOf(needle);
    assert.ok(at('class="footer-brand"') >= 0 && at('class="footer-brand"') < at("<h2>Organization</h2>"), p);
    assert.ok(at("<h2>Organization</h2>") < at("<h2>Community</h2>") && at("<h2>Community</h2>") < at("<h2>Contact</h2>"), p);
    assert.ok(at("<h2>Contact</h2>") < at('class="footer-spill"'), `${p}: the chip follows the columns`);
    assert.ok(at('class="footer-spill"') < at('class="footer-bottom"'), p);
    const brand = footer.slice(at('class="footer-brand"'), at("<h2>Organization</h2>"));
    assert.doesNotMatch(brand, /footer-spill/, `${p}: the chip is no longer inside the brand column's markup`);
    assert.match(footer, /class="footer-spill"[\s\S]*?class="spill-logo footer-spill-logo"[\s\S]*?<span>Ready to SPILL\?<\/span>/, p);
  }
  const styles = css();
  assert.match(styles, /\.footer-top \.footer-spill\{[^}]*grid-column:1;grid-row:1;align-self:end/, "the chip is placed at the foot of the brand cell");
  assert.match(styles, /\.footer-brand\{[^}]*grid-column:1;grid-row:1/, "the brand names the shared cell");
  assert.match(styles, /\.footer-top:has\(> \.footer-spill\) \.footer-brand\{[^}]*padding-bottom:calc\(var\(--s3\) \+ 4\.8rem\)/, "the brand reserves the chip's space");
});

test("Director Sign-In sits in the footer's legal row as a labelled text link, on every page", () => {
  for (const p of ["index.html", "404.html"]) {
    const page = read(p);
    assert.match(page, /<a href="\/staff\/" class="staff-in" data-signin-open="">/, p);
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
  /* the glyph's line is thinned (owner, 12 Nov 2026): at the shared weight of
     2 the note read heavy for its size, so the head and stem ride in a group
     at stroke-width 1.5. The frame keeps the shared weight, like its
     neighbours. The geometry is untouched, so the gaps below still hold. */
  assert.match(svg, /<g stroke-width="1\.5"><circle/, "the TikTok glyph is drawn at the thinner weight");
  /* the glyph sits centred in the frame with real air around it: the space
     above it equals the space below it, and every edge keeps at least 4 grid
     units of clearance (owner, 12 Nov 2026 — first the head's bottom nearly
     touched the frame's lower line while the stem floated high, so the glyph
     was centred; then, centred at 2.45 units of air, it still crowded the
     frame, so it was scaled to about two-thirds, about its own centre, until
     its top/bottom gaps matched the Instagram lens and the WIN mark at 4.5
     units each; then the glyph's line was thinned, geometry untouched).
     The frame spans 3.5..20.5; the glyph runs from the stem's
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
