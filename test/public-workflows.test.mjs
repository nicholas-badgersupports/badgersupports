import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { definitionProblems, withResources, allQuestions, validateAnswers } from '../src/shared/forms.mjs';
import { freshServer, post } from './helpers.mjs';
import { handle } from '../netlify/lib/router.mjs';
import { q, one } from '../netlify/lib/db.mjs';
import { ingestPayload } from '../netlify/lib/deliver.mjs';
import { ROOT } from '../ops/build.mjs';
import { copyable } from '../src/shared/structure.mjs';
import { BLOCKS } from '../src/render/registry.mjs';
import { makeContext } from '../src/render/context.mjs';
import { resolveText } from '../src/shared/text.mjs';

const load=k=>JSON.parse(fs.readFileSync(path.join(ROOT,`content/forms/${k}.json`),'utf8'));
const resources=JSON.parse(fs.readFileSync(path.join(ROOT,'content/fixtures/resources.json'),'utf8')).resources;
const t=resolveText(JSON.parse(fs.readFileSync(path.join(ROOT,'content/text.json'),'utf8')));

test('downstream mandatory fields cannot change type, become optional, or become conditional',()=>{
 for(const key of ['resource-problem','resource-update','resource-suggestion','wall-note']){
  const def=withResources(load(key),resources);
  for(const {q:field}of allQuestions(def).filter(({q})=>q.required))for(const mode of ['optional','type','conditional','section']){
   const bad=structuredClone(def),target=allQuestions(bad).find(({q})=>q.id===field.id);
   if(mode==='optional')target.q.required=false;
   if(mode==='type')target.q.type=field.type==='short'?'long':'short';
   if(mode==='conditional')target.q.showIf={id:'not-a-field',equals:['yes']};
   if(mode==='section')target.section.showIf={id:'not-a-field',equals:['yes']};
   assert.ok(definitionProblems(bad).some(p=>p.code.startsWith('delivery-')),`${key}/${field.id}/${mode}`);
  }
  const extra=structuredClone(def);extra.sections[0].questions.push({id:'sender_name',type:'short',label:'Your name'});
  assert.ok(definitionProblems(extra).some(p=>p.code==='delivery-fields'));
 }
});
test('missing resource-report answers are rejected before any submission or outbox work',async()=>{
 await freshServer();
 for(const key of ['resource-problem','resource-update','resource-suggestion'])await q("INSERT INTO form_state(form_key,state,changed_by) VALUES($1,'open','test')",[key]);
 const cases=[['resource-problem',{resource:'foodshare',problem:'   '}],['resource-problem',{problem:'Wrong link'}],['resource-update',{resource:'foodshare',field:'hours',words:' '}],['resource-update',{field:'hours',words:'Updated hours'}],['resource-suggestion',{name:'  '}]];
 for(const [key,answers]of cases)for(const json of [true,false]){
  const res=await handle(post(`/api/forms/${key}/submit`,{_form:key,_version:'1',...answers},{json}),{ip:'198.51.100.10'});
  assert.equal(res.status,422,`${key}/${json}`);
 }
 assert.equal((await one('SELECT count(*)::int AS n FROM submissions')).n,0);
 assert.equal((await one('SELECT count(*)::int AS n FROM outbox')).n,0);
});
test('the Wall stays closed, then accepts one anonymous moderated note once when opened locally',async()=>{
 await freshServer();
 const send=(note,key='wall-example-key')=>handle(post('/api/forms/wall-note/submit',{_form:'wall-note',_version:'1',_key:key,note,email:'discard@example.org',name:'Not a stored sender'}),{ip:'198.51.100.11'});
 assert.equal((await send('A note')).status,409);
 await q("INSERT INTO form_state(form_key,state,changed_by) VALUES('wall-note','open','test')");
 for(const note of ['', '   ','x'.repeat(281)])assert.equal((await send(note)).status,422);
 assert.equal((await one('SELECT count(*)::int AS n FROM submissions')).n,0);
 const a=await(await send('x'.repeat(280))).json(),b=await(await send('x'.repeat(280))).json();assert.equal(a.ref,b.ref);assert.match(a.ref,/^WN-/);
 const row=await one('SELECT * FROM submissions WHERE ref=$1',[a.ref]);assert.equal(row.anonymous,true);assert.deepEqual(Object.keys(row.answers),['note']);
 assert.equal((await one("SELECT count(*)::int AS n FROM outbox WHERE kind='mail.receipt'")).n,0);
 const payload=ingestPayload(row,load('wall-note'));assert.equal(payload.anonymous,true);assert.deepEqual(payload.columns.map(x=>x.id),['note']);
 assert.equal((await one('SELECT count(*)::int AS n FROM submissions')).n,1);
});
test('an empty library is valid only for a safely closed resource form',()=>{
 const closed=withResources({...load('resource-problem'),state:'open'},[]);
 assert.equal(closed.state,'closed');assert.deepEqual(definitionProblems(closed),[]);
 assert.ok(definitionProblems({...closed,state:'open'}).some(p=>p.code==='resources-missing'));
});
test('static cards remain copyable while dynamic day cards do not',()=>{
 assert.equal(copyable('cards',{type:'cards',variant:'activities'}),true);
 assert.equal(copyable('cards',{type:'cards',source:'events',variant:'days'}),false);
});
test('day cards respect date bounds, skips, different rooms and new weekdays',()=>{
 const base={id:'b-test-days',type:'cards',variant:'days',source:'events',program:'peer',title:'Groups',items:[{id:'monday',title:'Monday',icon:'calendar'}],links:[{label:'Updates',href:'/join/email-list/'}]};
 const events={tz:'America/Chicago',places:{one:{name:'First Room',detail:'Floor 3',href:'/directions/sac-mhh/'},two:{name:'Second Room',href:'/directions/sac-caucus/'}},recurring:[{id:'a',program:'peer',weekday:1,start:'17:00',end:'18:00',place:'one'},{id:'b',program:'peer',weekday:1,start:'19:00',end:'20:00',place:'two'},{id:'c',program:'peer',weekday:5,start:'16:00',end:'17:00',place:'one'},{id:'skip',program:'peer',weekday:2,start:'12:00',end:'13:00',skip:['2026-11-03']},{id:'future',program:'peer',weekday:3,start:'10:00',end:'11:00',from:'2026-11-11'},{id:'expired',program:'peer',weekday:4,start:'08:00',end:'09:00',until:'2026-10-31'},{id:'craft',program:'craft',weekday:3,start:'06:00',end:'07:00'}],dated:[]};
 const render=e=>String(BLOCKS.cards.render(base,makeContext({site:{},data:{events:e},text:t,today:'2026-11-02',builtPaths:['/join/email-list/','/directions/sac-mhh/','/directions/sac-caucus/']})));
 const out=render(events);assert.match(out,/First Room/);assert.match(out,/Second Room/);assert.match(out,/Floor 3/);assert.match(out,/Friday/);assert.match(out,/ended-tag/);assert.match(out,/Updates/);
 assert.doesNotMatch(out,/day-2026-11-03|day-2026-11-04|day-2026-11-05/);
 const empty=render({...events,recurring:[]});assert.match(empty,/next seven days/);assert.doesNotMatch(empty,/Nothing is scheduled yet/);
});
test('operations invoked through symbolic links actually run',()=>{
 const dir=path.join(ROOT,'local/test-direct-ops');fs.mkdirSync(dir,{recursive:true});
 const linked=path.join(dir,'editable.mjs');if(!fs.existsSync(linked))fs.symlinkSync(path.join(ROOT,'ops/editable.mjs'),linked);
 const direct=spawnSync(process.execPath,[path.join(ROOT,'ops/editable.mjs')],{encoding:'utf8'}),viaLink=spawnSync(process.execPath,[linked],{encoding:'utf8'});
 assert.equal(direct.status,0);assert.equal(viaLink.status,0);assert.ok(viaLink.stdout.length>30);assert.equal(viaLink.stdout,direct.stdout);
});


test("a program hero with no upcoming event offers updates rather than a dead end", () => {
  const block = { id: "no-events", type: "eventhero", source: "events", title: "Craft Nights", program: "craft" };
  const out = String(BLOCKS.eventhero.render(block, makeContext({site:{},data:{events:{dated:[],recurring:[]}},text:t,today:"2026-11-03",builtPaths:["/join/email-list/"]})));
  assert.match(out, /Nothing is scheduled yet/); assert.match(out, /href="\/join\/email-list\/"/);
});


test("resource suggestions cannot be edited to deliver multiple links", () => {
  for (const limit of [2, null, undefined]) {
    const def = load("resource-suggestion"), link = allQuestions(def).find(({ q }) => q.id === "link").q;
    if (limit === undefined) delete link.maxLinks; else link.maxLinks = limit;
    assert.ok(definitionProblems(def).some(p => p.code === "delivery-links"), `unsafe link limit: ${limit}`);
  }
});
