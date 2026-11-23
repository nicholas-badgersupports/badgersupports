import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { blockProblems, renderBlock } from "../src/render/registry.mjs";
import { makeContext } from "../src/render/context.mjs";
import { pageStrings, pageValues, applyEdits } from "../src/shared/edits.mjs";
const read = name => JSON.parse(fs.readFileSync(new URL("../"+name,import.meta.url)));
const page = () => read("content/pages/about-history.json");
const context = () => makeContext({site:read("content/site.json"),media:read("media/manifest.json"),text:Object.fromEntries(Object.entries(read("content/text.json").text).map(([k,v])=>[k,v.text])),builtPaths:["/about/history/","/about/what-we-do/","/join/get-involved/","/join/request-a-workshop/"]});
const markup = p => p.blocks.map(b=>String(renderBlock(b,context()))).join("");

test("History preserves the approved training passage and tells all eras as readable sections in three chapters, drawn as one timeline",()=>{
 const p=page();assert.deepEqual(blockProblems(p),[]);assert.equal(p.blocks.length,12);assert.equal(p.blocks[0].type,"pagehead");
 const eras=p.blocks.filter(b=>b.type==="text");assert.equal(eras.length,8);assert.ok(eras.every(b=>b.variant==="era"&&b.title&&b.body.length));
 const chapters=p.blocks.filter(b=>b.type==="chapter");assert.equal(chapters.length,3);assert.deepEqual(chapters.map(b=>b.title),["2019\u20132021","2025","2026"]);
 assert.ok(chapters.every(b=>b.items.length&&b.items.every(l=>l.href.startsWith("#"))));
 assert.equal((markup(p).match(/<span class="era-when">/g)||[]).length,8,"each era shows its when on the line");
 const training=p.blocks.flatMap(b=>b.body||[]).find(s=>s.startsWith("As Badger Supports grew"));
 assert.ok(training);assert.equal(createHash("sha256").update(training).digest("hex"),"891ae5839df43c9053ec8e437c97999021b66989ce064193a9d89181eea596ee");
 const html=markup(p);assert.equal((html.match(/<h1\b/g)||[]).length,1);assert.equal((html.match(/<h2\b/g)||[]).length,11);
 assert.equal((html.match(/<details class="era-more">/g)||[]).length,7,"each long era folds behind Read more; the closing era stays whole");
 assert.doesNotMatch(html,/<input|<textarea|<form|<script|<[^>]+\shidden(?:=|\s|>)/);
 assert.equal((html.match(/The Support Network/g)||[]).length,1);assert.doesNotMatch(p.blocks[0].lead,/2009/);
 assert.doesNotMatch(html,/docs\.google|mail\.google|HISTORY-EVIDENCE|GSSF|copyright|registration renewal|Recognize, Respond, Refer/);
});

test("History has public-only sources, current actions and discoverable About navigation",()=>{
 const p=page(),links=p.blocks.flatMap(b=>b.links||[]);
 assert.equal(links[0].href,"/about/what-we-do/");
 assert.deepEqual(links.filter(l=>l.href.startsWith("https:")).map(l=>new URL(l.href).hostname),["badgerherald.com"]);
 assert.deepEqual(p.blocks.at(-1).links.map(l=>l.href),["/about/what-we-do/","/join/get-involved/","/join/request-a-workshop/"]);
 assert.ok(read("content/site.json").nav.find(n=>n.id==="nav-about").children.some(n=>n.id==="nav-history"&&n.href===p.path));
 assert.ok(read("content/pages/about-what-we-do.json").blocks[0].links.some(l=>l.href===p.path));
 assert.ok(read("content/routes.json").routes.some(r=>r.path===p.path&&r.disposition==="new"));
});

test("History title, introduction, eras, paragraphs and actions keep existing editable targets",()=>{
 const p=page(),targets=new Set([...pageStrings(p),...pageValues(p)].map(r=>r.target));
 for(const path of ["b-history-head/title","b-history-head/lead","b-history-head/links/0/label","b-history-head/links/0/href","b-history-era-1/title","b-history-era-6/body/1","b-history-era-8/links/0/label","b-history-era-8/links/0/href"])assert.ok(targets.has("page:pg-about-history:"+path),path);
 const edits={"page:pg-about-history:b-history-era-1/title":"Example saved era","page:pg-about-history:b-history-era-1/body/0":"Example saved narrative."};
 assert.deepEqual(applyEdits(edits,{pages:[p],site:{},text:{}}).problems,[]);assert.match(markup(p),/Example saved era/);assert.match(markup(p),/Example saved narrative\./);
});
