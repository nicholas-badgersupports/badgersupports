import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { BLOCKS, renderBlock, blockProblems } from "../src/render/registry.mjs";
import { makeContext } from "../src/render/context.mjs";
import { pageStrings, pageValues, applyEdits, parseTarget } from "../src/shared/edits.mjs";
import { ribbonProblems } from "../src/render/blocks/ribbons.mjs";
import { freshServer } from "./helpers.mjs";
import { saveEdit, editEntry, editHistory, editsFile } from "../netlify/lib/edits.mjs";

const read = file => JSON.parse(fs.readFileSync(new URL("../" + file, import.meta.url)));
const page = () => read("content/pages/ribbons.json");
const context = () => makeContext({ site: read("content/site.json"), media: read("media/manifest.json"), text: {}, builtPaths: ["/directions/sac-mhh/", "/join/peer-support-groups/"], data: {} });
const key = suffix => `page:pg-ribbons:${suffix}`;
const gallery = p => p.blocks.find(b => b.id === "b-rb-causes");

test("27 native ribbons retain BSS meanings and exclude all requested patterns", () => {
  const p=page(), b=gallery(p), html=String(renderBlock(b,context()));
  assert.equal((html.match(/<details class="ribbon-card"/g)||[]).length,27);
  assert.match(html,/class="ribbon-grid"/);assert.match(html,/<dialog/);
  assert.match(html,/Teal &amp; Purple/);assert.match(html,/Suicide awareness and prevention/);
  assert.doesNotMatch(html,/Zebra|Houndstooth|Explore the Full Reference/);assert.match(html,/Blue Denim/);
  assert.doesNotMatch(html,/Red, white and blue|Orange and black|<input|<form|data-track/i);
  assert.match(html,/In Colors of Support/);assert.match(html,/Associated Causes/);
  assert.doesNotMatch(html,/ribbon-references|Wikipedia ribbon reference|Disabled World ribbon chart|wikipedia\.org|disabled-world\.com/);
  assert.equal(b.analytics,undefined);assert.equal(BLOCKS.ribbons.analytics,"none");
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
  assert.deepEqual(blockProblems(p),[]);assert.deepEqual(ribbonProblems(b),[]);
});

test("a plain saved override receives no positional reference association", () => {
  const p=page(), applied=applyEdits({[key("b-rb-causes/items/0/text")]:"A custom approved cause"},{pages:[p],site:read("content/site.json"),text:{}});
  assert.deepEqual(applied.problems,[]);
  const html=String(renderBlock(gallery(p),context()));
  assert.match(html,/<li class="ribbon-card ribbon-plain"><p>A custom approved cause<\/p><\/li>/);
  assert.equal((html.match(/<details class="ribbon-card"/g)||[]).length,26);
});

test("explicit color edits use that color's reference group and all cause markup is escaped", () => {
  const p=page();gallery(p).items[0].text="Pink — An approved local meaning";
  const html=String(renderBlock(gallery(p),context()));
  assert.match(html,/An approved local meaning/);assert.equal((html.match(/Breast-cancer awareness/g)||[]).length,2);
  gallery(p).meanings.pink.causes[0]="<script>unsafe</script>";
  const escaped=String(renderBlock(gallery(p),context()));assert.doesNotMatch(escaped,/<script>/);assert.match(escaped,/&lt;script&gt;/);
  const bad=structuredClone(gallery(p));bad.meanings.pink.references[0].href="javascript:alert(1)";assert.ok(ribbonProblems(bad).length);
  const cloud=String(BLOCKS.words.render({id:"b-example",type:"words",title:"Example",items:[{text:"A plain cloud",size:2}]},context()));
  assert.match(cloud,/word-cloud/);assert.doesNotMatch(cloud,/ribbon-card/);
});

test("old item and link paths plus every new reference target use the existing editor grammar", () => {
  const p=page(),strings=pageStrings(p),values=pageValues(p),targets=new Set([...strings,...values].map(x=>x.target));
  for(const path of ["b-rb-head/body/0","b-rb-head/body/1","b-rb-head/links/0/label","b-rb-making/title","b-rb-pickup/primary/label",...Array.from({length:14},(_,i)=>`b-rb-causes/items/${i}/text`)])assert.ok(targets.has(key(path)),path);
  for(const target of targets)assert.ok(parseTarget(target),target);
  assert.ok(targets.has(key("b-rb-causes/meanings/teal_purple/causes/0")));
  assert.ok(targets.has(key("b-rb-causes/meanings/two_tone_blue/references/0/href")));
  for(const path of ["b-rb-head/whole","b-rb-making/whole","b-rb-pickup/quiet","b-rb-pickup/whole"])assert.equal(values.find(v=>v.target===key(path))?.kind,"boolean",path);
});

test("a multicolor cause saves, rejects stale writes, renders, and restores through immutable history", async () => {
  const db=await freshServer();
  try {
    const target=key("b-rb-causes/meanings/teal_purple/causes/0"), original=await editEntry(target), who={sub:"fictional-editor",name:"Fictional Editor"};
    assert.ok(original);const changed="An edited approved cause";
    await saveEdit(who,{target,expected:original.current,value:changed});
    await assert.rejects(()=>saveEdit(who,{target,expected:original.current,value:"Stale edit"}),e=>e.status===409||e.code==="edit.conflict");
    const p=page(),doc=await editsFile();assert.deepEqual(applyEdits(doc.edits,{pages:[p],site:read("content/site.json"),text:{}}).problems,[]);
    assert.match(String(renderBlock(gallery(p),context())),/An edited approved cause/);
    const first=await editHistory(target);assert.equal(first.versions.length,1);
    await saveEdit(who,{target,expected:changed,value:original.current});
    const restored=await editHistory(target);assert.equal(restored.versions.length,2);assert.equal(restored.versions[1].id,first.versions[0].id);assert.equal(restored.versions[0].value,original.current);
  } finally { await db.end(); }
});

test("pickup remains an availability inquiry, station hosting is quieter, and all photos remain", () => {
  const p=page(),head=p.blocks[0],station=p.blocks.find(b=>b.id==="b-rb-pickup");
  assert.equal(head.primary.href,"mailto:hello@badgersupports.org");assert.equal(head.links[0].href,"/directions/sac-mhh/");
  assert.ok(head.body.some(t=>/current pickup locations/.test(t)));
  assert.ok(p.blocks.every(b=>!/coming soon|Free ribbons are available/.test(JSON.stringify(b))));
  assert.equal(station.primary.href,"/forms/resource-request/");assert.equal(station.quiet,true);
  assert.deepEqual(p.blocks.flatMap(b=>b.photos||[]),["m-peer-ribbon","m-openhouse-ribbon-bowls","m-ribbons-bowls","m-ribbons-table"]);
});
