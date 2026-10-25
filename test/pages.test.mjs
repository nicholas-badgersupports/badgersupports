/* The pieces of the homepage and the peer support groups page that other suites do not reach: the
   workshop previews, the Drop in links, the peer page's week and word cloud, the reel that loads
   nothing from Instagram until pressed,
   the Hub's old address, the calendar files, the one-red palette, the hero's Pause button and Badger
   SPILL's logo, and the two applications' preview pages. */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { build, ROOT } from "../ops/build.mjs";
import { workshopProblems } from "../src/render/blocks/workshops.mjs";
import { embedProblems } from "../src/render/blocks/embed.mjs";
import { cardProblems } from "../src/render/blocks/cards.mjs";
import { wordProblems } from "../src/render/blocks/words.mjs";
import { directoryProblems } from "../src/render/blocks/directory.mjs";
import { eventIcs } from "../src/render/ics.mjs";
import { html, breakAtSign } from "../src/render/html.mjs";

const OUT = path.join(ROOT, "local", "test-build-pages");
const read = (p) => fs.readFileSync(path.join(OUT, p), "utf8");
/* From a block's opening tag to the next block's: these blocks hold sections of their own. */
const block = (page, id) => {
  const a = page.indexOf(`data-block="${id}"`);
  assert.ok(a > 0, `block ${id}`);
  const b = page.indexOf("data-block=", a + 12);
  return page.slice(page.lastIndexOf("<", a), b < 0 ? undefined : b);
};

test.before(async () => {
  await build({ out: OUT, serverDir: path.join(OUT, "_server"), media: false, today: "2026-10-20" });
});

test("the four workshop previews each carry their own activity, and work as plain links without a script", () => {
  const ws = block(read("index.html"), "b-home-workshops");
  const panels = [...ws.matchAll(/<article class="ws-panel" id="(w-[a-z-]+)"[^>]*>/g)].map((m) => m[1]);
  assert.deepEqual(panels, ["w-networks", "w-selfcare", "w-advocacy", "w-housing"]);
  for (const id of panels) assert.match(ws, new RegExp(`<a class="ws-tab" href="#${id}" data-tab="${id}">`), id);
  assert.doesNotMatch(ws, /<article class="ws-panel"[^>]*\shidden/, "every panel shows until the script makes them tabs");
  assert.deepEqual([...ws.matchAll(/data-act="([a-z]+)"/g)].map((m) => m[1]), ["network", "bingo", "choose", "flip"]);
  assert.equal([...ws.matchAll(/<input type="checkbox" name="w-selfcare-bingo"/g)].length, 9);
  assert.equal([...ws.matchAll(/<input type="radio" name="w-advocacy-say"/g)].length, 3);
  assert.ok([...ws.matchAll(/<details class="flip"/g)].length >= 2, "flip cards open with no script");
  assert.equal([...ws.matchAll(/<a class="net-btn" href="#w-networks-a-[a-z]+"/g)].length, 4);
  assert.equal([...ws.matchAll(/href="\/forms\/workshop-request\/" class="btn"/g)].length, 4, "each preview ends on the request form");
});

test("a workshop preview that is missing a part fails the build instead of showing half a card", () => {
  const ok = { id: "w-test", title: "T", tab: "T", activity: { kind: "bingo", cells: Array(9).fill("x"), win: "line" } };
  assert.deepEqual(workshopProblems({ id: "b", items: [ok] }), []);
  assert.ok(workshopProblems({ id: "b", items: [{ ...ok, activity: { kind: "bingo", cells: ["x"], win: "line" } }] }).some((x) => /nine squares/.test(x)));
  assert.ok(workshopProblems({ id: "b", items: [ok, ok] }).some((x) => /duplicate id/.test(x)));
  assert.ok(workshopProblems({ id: "b", items: [{ ...ok, activity: { kind: "quiz" } }] }).some((x) => /activity kind/.test(x)));
});

test("Drop in sends a peer support group to its page and anything else to its room", () => {
  const home = read("index.html");
  const drops = [...home.matchAll(/<a href="([^"]+)" class="drop">[\s\S]*?<span class="sr-only">: ([^<]+)<\/span>/g)].map((m) => [m[1], m[2]]);
  assert.ok(drops.length >= 2, "the week has Drop in links");
  for (const [href, title] of drops) {
    if (title === "Peer support group") assert.equal(href, "/join/peer-support-groups/", title);
    else assert.match(href, /^\/directions\/[a-z0-9-]+\/$/, title);
  }
  assert.ok(drops.some(([, t]) => t !== "Peer support group"), "a non-group event is in the fixture week");
});

test("the peer support groups page keeps the live page's order: drop in, the week, the Hub, the talk, the activities, why/what/how, Badger SPILL, a request", () => {
  const page = read("join/peer-support-groups/index.html");
  const ids = [...page.matchAll(/data-block="(b-pg-[a-z]+)"/g)].map((m) => m[1]);
  // Badger SPILL is the one addition to the live page's order (owner, 20 Oct 2026)
  assert.deepEqual(ids, ["b-pg-intro", "b-pg-days", "b-pg-hub", "b-pg-talk", "b-pg-activities", "b-pg-how", "b-pg-spill", "b-pg-request", "b-pg-note"]);
  assert.match(page, /<section class="directions band is-section" id="get-directions"[^>]*data-block="b-pg-hub">/);
  assert.equal([...page.matchAll(/<h1[ >]/g)].length, 1);
  assert.match(block(page, "b-pg-intro"), /href="[^"]*\/join\/email-list\/?"[^>]*><span class="go-label">Join Our Email List</, "the email list, as the live hero has it (the live page until ours is built)");

  const days = block(page, "b-pg-days");
  const cards = [...days.matchAll(/<li class="card has-photo" id="([a-z]+)">([\s\S]*?)<\/li>/g)];
  assert.deepEqual(cards.map((m) => m[1]), ["monday", "tuesday", "wednesday", "thursday"]);
  for (const [, id, card] of cards) {
    assert.match(card, /<div class="photo"><picture/, `${id}: a photo of people`);
    assert.match(card, /href="#get-directions"/, `${id}: its own Get directions`);
  }
  assert.equal([...cards[0][2].matchAll(/<p class="card-line">/g)].length, 2, "Monday has two groups");

  const talk = block(page, "b-pg-talk");
  assert.equal([...talk.matchAll(/<li class="w-[123] tone-[123]">/g)].length, 15);
  assert.match(talk, /<li class="w-3 tone-[123]">Housing<\/li>/, "the largest word, as on the live graphic");

  const acts = block(page, "b-pg-activities");
  assert.deepEqual([...acts.matchAll(/<li class="card[^"]*" id="([a-z-]+)">/g)].map((m) => m[1]), ["question-jar", "coloring", "ribbon-making"]);
  assert.match(acts, /href="[^"]*\/initiatives\/ribbons[^"]*"/, "the ribbon campaign, on the live site until ours is built");
  assert.doesNotMatch(acts, /<li class="card" id="[a-z-]+">\s*<div class="card-words">/, "a card with no photo shows its icon");

  const how = block(page, "b-pg-how");
  for (const w of ["Why", "What", "How"]) assert.match(how, new RegExp(`<strong>${w}</strong>`), w);
  assert.match(block(page, "b-pg-request"), /<a href="[^"]*\/request-a-program\/?" class="btn btn--big"/);
  assert.match(block(page, "b-pg-note"), /Requests should be made 3 days before any peer support group\./);
});

test("a cards or words block that is missing a part fails the build instead of showing half a row", () => {
  const card = { id: "monday", title: "Monday", lines: ["5:00–6:00 PM"] };
  assert.deepEqual(cardProblems({ id: "b", items: [card] }), []);
  assert.ok(cardProblems({ id: "b", items: [card, card] }).some((x) => /duplicate id/.test(x)));
  assert.ok(cardProblems({ id: "b", items: [{ ...card, title: " " }] }).some((x) => /needs a title/.test(x)));
  assert.ok(cardProblems({ id: "b", items: [{ ...card, lines: "5 PM" }] }).some((x) => /list of text/.test(x)));
  assert.ok(cardProblems({ id: "b", items: [{ ...card, link: { label: "Go" } }] }).some((x) => /label and an address/.test(x)));
  assert.ok(cardProblems({ id: "b", items: [] }).some((x) => /at least one card/.test(x)));
  assert.deepEqual(wordProblems({ id: "b", items: ["Stress", { text: "Housing", size: 3 }] }), []);
  assert.ok(wordProblems({ id: "b", items: [{ text: "Housing", size: 4 }] }).some((x) => /1, 2 or 3/.test(x)));
  assert.ok(wordProblems({ id: "b", items: [""] }).some((x) => /needs its text/.test(x)));
});

test("a directory keeps every office's own link and address, and refuses a group with no places", () => {
  const sac = block(read("initiatives/student-activity-center/index.html"), "b-sac-floors");
  assert.equal(sac.match(/class="dy-group"/g).length, 9, "floors 3 to 11");
  assert.match(sac, /href="\/directions\/sac-mhh\/"/, "the Hub opens its room page");
  assert.match(sac, /href="https:\/\/asm\.wisc\.edu\/sac\/"/);
  const us = block(read("initiatives/university-square/index.html"), "b-us-sides");
  assert.match(us, /href="\/initiatives\/student-activity-center\/"[^]*?333 East Campus Mall/, "the square links the tower");
  assert.ok(!/data-pending/.test(sac + us));
  const g = { id: "floor-3", title: "Floor 3", items: [{ name: "Print & Resource Center", href: "https://soli.wisc.edu" }] };
  assert.deepEqual(directoryProblems({ id: "b", groups: [g] }), []);
  assert.ok(directoryProblems({ id: "b", groups: [g, g] }).some((x) => /duplicate id/.test(x)));
  assert.ok(directoryProblems({ id: "b", groups: [{ ...g, items: [] }] }).some((x) => /at least one place/.test(x)));
  assert.ok(directoryProblems({ id: "b", groups: [{ ...g, items: [{ name: "" }] }] }).some((x) => /needs a name/.test(x)));
  assert.ok(directoryProblems({ id: "b", groups: [] }).some((x) => /at least one group/.test(x)));
});

test("the reel loads nothing from Instagram until it is pressed, and the policy allows only its frame", () => {
  const page = read("join/peer-support-groups/index.html");
  assert.match(page, /<figure class="reel" data-embed data-src="https:\/\/www\.instagram\.com\/reel\/[A-Za-z0-9_-]+\/embed\/"/);
  assert.match(page, /<button type="button" class="reel-play" data-embed-play>/);
  for (const f of fs.readdirSync(OUT, { recursive: true }).filter((f) => f.endsWith(".html"))) {
    const h = read(f);
    assert.doesNotMatch(h, /<iframe/, f);
    assert.doesNotMatch(h, /<script[^>]+src="https?:\/\//, f);
  }
  const csp = read("_headers").match(/Content-Security-Policy: (.*)/)[1];
  assert.match(csp, /frame-src https:\/\/www\.instagram\.com;/);
  assert.match(csp, /script-src 'self' 'sha256-[^']+';/, "no Instagram script");
  assert.deepEqual(embedProblems({ url: "https://www.instagram.com/reel/DecSxrys1OY/", title: "x" }), []);
  assert.equal(embedProblems({ url: "https://example.com/video", title: "x" }).length, 1);
});

test("the hero's circles drift only once its script runs, and that script brings a Pause button", () => {
  const home = read("index.html");
  const hero = block(home, "b-home-hero");
  assert.match(hero, /<button type="button" class="still" data-still hidden>[\s\S]*?<span>Pause<\/span><\/button>/, "hidden until hero.js shows it");
  assert.match(home, /<script type="module" src="\/assets\/js\/[a-z0-9]+\/hero\.js">/);
  const words = JSON.parse(home.match(/<script type="application\/json" id="bss-text">([^<]*)<\/script>/)[1]);
  assert.equal(words["hero.pause"], "Pause");
  assert.equal(words["hero.play"], "Play");
  const css = fs.readFileSync(path.join(ROOT, "src/styles/blocks.css"), "utf8");
  for (const sel of [".hub", ".bubble"]) {
    const rule = css.match(new RegExp(`^\\${sel} \\{[^}]*\\}`, "m"))[0];
    assert.match(rule, /infinite[^;]*;\s*animation-play-state: running, paused;/, `${sel}: the loop waits, paused, without the script`);
  }
  assert.match(css, /\.network\.is-moving \.hub, \.network\.is-moving \.bubble \{ animation-play-state: running; \}/);
});

test("the Hub's old address goes to its directions page", () => {
  assert.ok(read("_redirects").split("\n").includes("/about/mh-hub  /directions/sac-mhh/  301"));
  assert.ok(fs.existsSync(path.join(OUT, "directions/sac-mhh/index.html")));
});

test("a calendar file is CRLF, UTC, escaped and folded at 75 octets", () => {
  const files = fs.readdirSync(path.join(OUT, "calendar")).filter((f) => f.endsWith(".ics"));
  assert.ok(files.length > 0);
  for (const f of files) {
    const ics = read(path.join("calendar", f));
    assert.ok(ics.endsWith("\r\n"), f);
    assert.doesNotMatch(ics.replace(/\r\n/g, ""), /\n|\r/, `${f}: every line ends CRLF`);
    for (const line of ics.split("\r\n")) assert.ok(Buffer.byteLength(line) <= 75, `${f}: ${line}`);
    assert.match(ics, /\r\nDTSTART:\d{8}T\d{6}Z\r\n/, f);
  }
  const ics = eventIcs(
    { event: "x-2026-11-01", title: "Paint; draw, chat", startsAt: "2026-11-01T18:00:00-05:00", endsAt: "2026-11-01T20:00:00-05:00", note: "a".repeat(120) },
    { place: { name: "Room", building: "Hall", address: "1 Example St" }, origin: "https://www.badgersupports.org", stamp: "20261020T000000Z" },
  );
  assert.match(ics, /\r\nSUMMARY:Paint\\; draw\\, chat\r\n/);
  assert.match(ics, /\r\nLOCATION:Room\\, Hall\\, 1 Example St\r\n/);
  assert.match(ics, /\r\nDTSTART:20261101T230000Z\r\nDTEND:20261102T010000Z\r\n/);
  assert.match(ics, /\r\n a+\r\n/, "a long line continues on a line starting with a space");
});

test("peer support wears green and craft nights purple; the header, footer and announcements stay brand red", () => {
  const tokens = fs.readFileSync(path.join(ROOT, "src/styles/tokens.css"), "utf8");
  for (const p of ["peer", "craft"]) for (const t of ["", "-deep", "-tint", "-wash"]) assert.match(tokens, new RegExp(`--${p}${t}\\s*:`), `--${p}${t}`);
  assert.match(tokens, /\[data-program="peer"\]\s*\{[^}]*--accent:\s*var\(--peer\)/);
  assert.match(tokens, /\[data-program="craft"\]\s*\{[^}]*--accent:\s*var\(--craft\)/);
  const layout = fs.readFileSync(path.join(ROOT, "src/styles/layout.css"), "utf8");
  assert.doesNotMatch(layout, /var\(--(accent|peer|craft)/, "the frame round every page is red");
  assert.match(read("join/peer-support-groups/index.html"), /<main id="main" tabindex="-1" data-program="peer">/);
  assert.match(read("join/craft-nights/index.html"), /<main id="main" tabindex="-1" data-program="craft">/);
  assert.match(read("index.html"), /<main id="main" tabindex="-1">/, "the homepage is red; its sections take their own colours");
});

// Every stylesheet, block ones (src/styles/blocks/) included.
const allCss = () => fs.readdirSync(path.join(ROOT, "src/styles"), { recursive: true }).filter((f) => f.endsWith(".css")).map((f) => fs.readFileSync(path.join(ROOT, "src/styles", f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")).join("\n");

/* No decorative coloured bar on any edge (owner, 24 Oct 2026, widening Round 7): "the rounded red strip across
   the top of a white card", in any colour, on any edge. An edge is the neutral rule, a route's dotted line, or
   nothing. Colour that means something stays: the page you are on, a selected tab, focus, a checked box. */
const NEUTRAL_EDGE = /^(0|none|var\(--(hairline|rule-line|hairline-on-red)\)|\d+px dotted var\(--rule-strong\))$/;
const MEANING = /aria-current|aria-selected|:focus|:checked|aria-invalid/;
/* Each edge here was read and judged not a bar; the reason is the comment beside it. */
const NOT_A_BAR = new Map([
  // a phone tab closes its own outline in its own fill colour, so the edge cannot be seen apart from the tab
  [".ws-tab: border-bottom: 3px solid var(--ws-tint)", "closes the tab's own same-colour outline"],
]);

test("no coloured bar on any edge of anything: an edge is the neutral rule, a route's dotted line, or none", () => {
  const css = allCss();
  // A rotated rule draws a chevron from two of its borders; that is an arrow, not a bar.
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => !/rotate\(/.test(m[2])).map((m) => ({ sel: m[1].trim().replace(/\s+/g, " "), body: m[2] }));
  const bars = [];
  for (const { sel, body } of rules) {
    if (MEANING.test(sel)) continue;
    // one edge, physical or logical, by its shorthand or by its own width or colour
    for (const d of body.matchAll(/(?:^|[;\s])border-((?:top|bottom|left|right|block|inline)(?:-start|-end)?)(-width|-color|-style)?\s*:\s*([^;}]+)/g)) {
      const v = `${sel}: border-${d[1]}${d[2] || ""}: ${d[3].trim()}`;
      if (d[2] === "-style") continue;
      if (d[1] === "block" || d[1] === "inline") { if (!d[2] && NEUTRAL_EDGE.test(d[3].trim())) continue; }
      if (!d[2] && NEUTRAL_EDGE.test(d[3].trim())) continue;
      if (NOT_A_BAR.has(v)) continue;
      bars.push(v);
    }
    // one edge made thicker or another colour through the four-value forms
    for (const d of body.matchAll(/(?:^|[;\s])border-(width|color)\s*:\s*([^;}]+)/g)) {
      const parts = d[2].trim().split(/\s+(?![^(]*\))/);
      if (new Set(parts).size > 1) bars.push(`${sel}: border-${d[1]}: ${d[2].trim()}`);
    }
    // a shadow drawn inside an edge
    for (const d of body.matchAll(/box-shadow\s*:\s*([^;}]+)/g)) if (/\binset\b[^,]*?\s-?(?:[1-9]|0?\.\d)/.test(d[1]) || /\binset\s+-?[1-9]/.test(d[1])) bars.push(`${sel}: box-shadow: ${d[1].trim()}`);
    // a strip: a pseudo-element painted in a colour, thinner than a dot is wide
    if (/::?(before|after)/.test(sel) && /background(-color)?\s*:\s*var\(--(accent|red|peer|craft|ws|ink|cream)[^)]*\)/.test(body) && !/border-radius\s*:\s*50%/.test(body)
      && /(?:^|[;\s])(height|width|block-size|inline-size)\s*:\s*(?:[0-9]px|1[0-2]px|0?\.\d+rem)/.test(body)) bars.push(`${sel}: a thin painted pseudo-element`);
    // a strip: a gradient with a hard stop, or one that changes colour, painted on an element
    for (const d of body.matchAll(/linear-gradient\(((?:[^()]|\([^()]*\))*)\)/g)) {
      const stops = d[1].split(/,(?![^(]*\))/).map((s) => s.trim());
      const colours = new Set(stops.filter((s) => !/^(to |\d+deg)/.test(s)).map((s) => s.replace(/\s+[\d.]+(%|px|rem)$/, "")));
      if (colours.size > 1 && !(sel === ".person-title > span")) bars.push(`${sel}: linear-gradient(${d[1]})`);
    }
  }
  assert.deepEqual(bars, [], "no decorative bar: each of these is one");
});

test("no coloured bar in the pages themselves: no inline border or shadow, no thin painted SVG strip", () => {
  const pages = fs.readdirSync(OUT, { recursive: true }).filter((f) => f.endsWith(".html"));
  assert.ok(pages.length > 40, "the built pages are read");
  const found = [];
  for (const p of pages) {
    const page = read(p);
    for (const m of page.matchAll(/\sstyle="([^"]*)"/g)) if (/border|box-shadow|linear-gradient/.test(m[1])) found.push(`${p}: style="${m[1]}"`);
    for (const m of page.matchAll(/<rect\b[^>]*>/g)) {
      const h = Number((m[0].match(/\sheight="([\d.]+)"/) || [])[1]), w = Number((m[0].match(/\swidth="([\d.]+)"/) || [])[1]);
      if (Math.min(h, w) <= 4 && Math.max(h, w) >= 4 * Math.min(h, w)) found.push(`${p}: ${m[0]}`);
    }
  }
  assert.deepEqual(found, []);
});

test("only what can be pressed stands on a ledge: cards and photos are flat (Badger SPILL's rule)", () => {
  const rules = [...allCss().matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  const ledged = rules.filter((m) => /box-shadow:\s*(0 \d+px 0 |var\(--ledge\))/.test(m[2])).map((m) => m[1].trim().replace(/\s+/g, " "));
  const pressable = /\.(btn|go|drop|door-link|door-go|hub-tag|hero-spill|footer-spill|mood-btn|say|flip|reel-play)\b|summary/;
  assert.deepEqual(ledged.filter((sel) => !sel.split(",").every((one) => pressable.test(one))), [], "a ledge only under a button, a link or a control");
  for (const flat of [".evcard", ".res-card", ".spill-card", ".staff-form", ".ws-panel", ".hubcard", ".dir-head", ".form-head"]) {
    const own = rules.filter((m) => m[1].split(",").some((one) => one.trim() === flat));
    assert.ok(own.length, `${flat} has a rule`);
    for (const m of own) assert.doesNotMatch(m[2], /box-shadow/, `${flat} is flat`);
  }
});

test("Get involved opens on people: up to three photos beside its heading", () => {
  const ways = block(read("join/get-involved/index.html"), "b-gi-ways");
  assert.match(ways, /^<section class="involve band is-page has-photos"/);
  const head = ways.match(/<div class="involve-photos">[\s\S]*?<\/div><\/div>\s*<\/div>/)?.[0] || "";
  const n = [...head.matchAll(/<div class="photo"><picture|<div class="photo"><img/g)].length;
  assert.ok(n >= 1 && n <= 3, `${n} photos`);
});

test("Get involved keeps what the live page said: the hiring steps as a list, what volunteers do, and the Equal Opportunity line", () => {
  const page = read("join/get-involved/index.html");
  const ways = block(page, "b-gi-ways");
  assert.match(ways, /<li class="door[^"]*"><a href="#hiring" class="door-link">/, "the staff door opens the hiring steps");
  const hiring = ways.match(/<section class="more[^"]*" id="hiring"[\s\S]*?<\/section>/)?.[0];
  assert.ok(hiring, "a hiring panel");
  assert.equal([...hiring.match(/<ol class="more-steps">([\s\S]*?)<\/ol>/)[1].matchAll(/<li>/g)].length, 3, "three steps, numbered");
  assert.match(hiring, /<ul class="more-list">/, "what applicants may also send");
  const vol = ways.match(/<section class="more[^"]*" id="volunteering"[\s\S]*?<\/section>/)?.[0];
  assert.ok(vol, "a volunteering panel");
  for (const [name, panel] of [["hiring", hiring], ["volunteering", vol]]) assert.match(panel, /^<section class="more has-photo"[^>]*>\s*<div class="photo"><picture/, `${name}: the live page's photo on top`);
  assert.equal([...vol.match(/<ul class="more-list">([\s\S]*?)<\/ul>/)[1].matchAll(/<li>/g)].length, 3);
  assert.match(block(page, "b-gi-faq"), /<p class="qa-note">[^<]*Equal Opportunity Employer[^<]*<\/p>/);
  assert.doesNotMatch(block(read("index.html"), "b-home-involved"), /class="more"/, "the homepage's compact doors carry no panels");
});

test("an email address in a pill or a closed notice is kept whole, may break before its @, and is still escaped", () => {
  const page = read("join/get-involved/index.html");
  assert.match(page, /<span class="go-label">Email Us at <span class="addr">hello<wbr>@badgersupports\.org<\/span><\/span>/, "the questions pill");
  assert.match(page, /<span class="door-text door-closed">[^<]*<span class="addr">hello<wbr>@badgersupports\.org<\/span>\.<\/span>/, "the closed staff door");
  assert.equal(String(html`${breakAtSign("a<b@c")}`), '<span class="addr">a&lt;b<wbr>@c</span>');
  assert.equal(breakAtSign("no address"), "no address");
});

test("Badger SPILL shows in the hero, in its own band and in every footer, as its own logo that its own motion moves", () => {
  const home = read("index.html");
  const hero = block(home, "b-home-hero");
  const sticker = hero.match(/<a href="https:\/\/badgerspill\.org\/#write"[^>]*class="hero-spill"[\s\S]*?<\/a>/);
  assert.ok(sticker, "the hero's sticker is one link to SPILL's writing page");
  assert.match(sticker[0], /<img class="spill-logo hero-spill-logo" src="\/assets\/brand\/spill-logo-wide-480\.webp"[^>]* alt="" [^>]*loading="eager">/, "the logo has no words of its own and loads with the hero");
  assert.match(sticker[0], /<span class="hero-spill-title">Need to vent\?<\/span>/);
  assert.match(home, /<script type="module" src="\/assets\/js\/[a-z0-9]+\/spill-logo\.js">/);
  for (const [page, id] of [["index.html", "b-home-spill"], ["join/peer-support-groups/index.html", "b-pg-spill"], ["join/get-involved/index.html", "b-gi-spill"]]) {
    const band = block(read(page), id);
    assert.match(band, /<section class="spill-band"/, page);
    assert.match(band, /<img class="spill-logo spill-band-logo"[^>]* alt="" [^>]*loading="lazy">/, page);
    assert.match(band, /href="https:\/\/badgerspill\.org\//, page);
  }
  // every page's footer, so every page loads the motion
  const about = read("about/faq/index.html");
  assert.match(about, /class="footer-spill"[\s\S]*?class="spill-logo footer-spill-logo"/);
  assert.match(about, /\/spill-logo\.js">/);
  for (const w of [240, 480, 720]) assert.ok(fs.existsSync(path.join(OUT, `assets/brand/spill-logo-wide-${w}.webp`)), `${w}w`);
  // the cut along the milk is Badger SPILL's own, character for character
  const css = fs.readFileSync(path.join(ROOT, "src/styles/blocks.css"), "utf8");
  for (const sel of [".logo-bottle", ".logo-milk"]) assert.match(css, new RegExp(`^\\${sel} \\{ transform-origin: [0-9.]+% [0-9.]+%;\\n  clip-path: polygon\\(`, "m"), sel);
});

test("each application, the letter form and the four request forms has a preview page to review it by: every section, its new controls, and none of the notes kept for reviewers", () => {
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const expect = {
    "staff-application": { sections: 11, files: ["resume", "cover_letter"], rank: 4, phone: true },
    "volunteer-application": { sections: 9, files: ["resume"], rank: 0, phone: true },
    "recommendation-letter": { sections: 2, files: ["letter"], rank: 0, phone: true },
    "resource-request": { sections: 2, files: [], rank: 0 },
    "program-request": { sections: 2, files: [], rank: 0 },
    "referral-card-survey": { sections: 1, files: [], rank: 0 },
    "email-list": { sections: 2, files: [], rank: 0 },
  };
  for (const [key, want] of Object.entries(expect)) {
    const def = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "forms", `${key}.json`), "utf8"));
    const page = read(`forms/${key}/preview/index.html`);
    assert.match(page, /<meta name="robots" content="noindex">/, key);
    assert.match(page, new RegExp(`<form class="bss-form"[^>]* data-form="${key}"[^>]* data-preview=""`), key);
    assert.equal([...page.matchAll(/data-section="/g)].length, want.sections, `${key}: sections`);
    assert.deepEqual([...page.matchAll(/<input id="f-([a-z_]+)"[^>]* type="file" accept="application\/pdf"/g)].map((m) => m[1]), want.files, `${key}: files`);
    assert.equal([...page.matchAll(/<select id="f-directorate_rank[^"]*" name="directorate_rank\.[a-z_]+"/g)].length, want.rank, `${key}: one place per directorate`);
    if (want.phone) assert.match(page, /<input id="f-phone" name="phone"[^>]* type="tel"/, key);
    const notes = [];
    const walk = (v, kept) => {
      if (typeof v === "string") { if (kept && v.length >= 12) notes.push(v.slice(0, 40)); return; }
      if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, kept || ["review", "proposed", "source", "workflow"].includes(k));
    };
    walk(def, false);
    assert.ok(notes.length > 5, `${key} has notes to keep out`);
    for (const n of notes) assert.ok(!page.includes(n) && !page.includes(esc(n)), `${key} shows a reviewer's note: ${n}`);
  }
});
