import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { BLOCKS } from "../src/render/registry.mjs";
import { makeContext } from "../src/render/context.mjs";
import { picture } from "../src/render/media.mjs";

const read = file => JSON.parse(fs.readFileSync(new URL("../" + file, import.meta.url)));
const media = read("media/manifest.json");
const photos = media.items.slice(0, 3).map(item => item.id);
const text = Object.fromEntries(Object.entries(read("content/text.json").text).map(([key, value]) => [key, value.text]));
const context = () => makeContext({ site: read("content/site.json"), media, text, today: "2026-11-04", builtPaths: ["/", "/join/email-list/"], data: { events: { dated: [], recurring: [] }, forms: {} } });
const images = body => [...body.matchAll(/<picture\b[^>]*>[\s\S]*?<\/picture>/g)].flatMap(match => [...match[0].matchAll(/<img\b[^>]*>/g)].map(image => image[0]));

test("opening photo groups are discoverable together with one high-priority image", () => {
  const cases = [
    { type: "hero", title: "Example", primary: { href: "/", label: "Example" }, circles: photos.map(media => ({ media, href: "/", label: "Example" })) },
    { type: "pagehead", title: "Example", photos },
    { type: "eventhero", title: "Example", photos, source: "events", program: "craft" },
    { type: "involve", title: "Example", heading: "h1", photos, items: [] },
  ];
  for (const block of cases) {
    const tags = images(String(BLOCKS[block.type].render({ id: "photo-example", ...block }, context())));
    assert.equal(tags.length, 3, block.type);
    assert.equal(tags.filter(tag => /fetchpriority="high"/.test(tag)).length, 1, block.type);
    for (const tag of tags) {
      assert.match(tag, /\ssrc=/, block.type);
      assert.match(tag, /\ssrcset=/, block.type);
      assert.match(tag, /\ssizes=/, block.type);
      assert.doesNotMatch(tag, /loading="lazy"|data-src=|fetchpriority="low"/, block.type);
    }
  }
  const secondary = images(String(BLOCKS.involve.render({ id: "secondary-example", type: "involve", title: "Example", photos, items: [] }, context())));
  assert.ok(secondary.every(tag => /loading="lazy"/.test(tag)), "ordinary secondary photo groups remain deferred");
});

test("normal-priority eager loading preserves every image representation and geometry attribute", () => {
  const ctx = context(), options = { sizes: "(max-width: 860px) 44vw, 16rem" };
  const lazy = String(picture(ctx, photos[0], options));
  const eager = String(picture(ctx, photos[0], { ...options, eager: true, priority: null }));
  const content = value => value.replace(/\s(?:loading|decoding|fetchpriority)="[^"]*"/g, "");
  assert.equal(content(eager), content(lazy));
  assert.doesNotMatch(eager, /loading="lazy"|fetchpriority=/);
  assert.match(lazy, /loading="lazy"/);
});
