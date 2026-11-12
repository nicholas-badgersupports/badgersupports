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
  assert.match(svg, /<circle cx="9\.9" cy="16\.9" r="2\.8"\/>/, "the note's head is a circle inside the frame");
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
