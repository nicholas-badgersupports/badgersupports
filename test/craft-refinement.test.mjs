import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BLOCKS,renderBlock} from '../src/render/registry.mjs';
import {makeContext} from '../src/render/context.mjs';
import {nextDated} from '../src/render/events.mjs';
import {eventIcs} from '../src/render/ics.mjs';
import {pageStrings,pageValues,applyEdits} from '../src/shared/edits.mjs';
import {emptyStructure,applyChange} from '../src/shared/structure.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url)));
const page=()=>read('content/pages/craft-nights.json');
const text=Object.fromEntries(Object.entries(read('content/text.json').text).map(([k,v])=>[k,v.text]));
const blocks=()=>Object.fromEntries(page().blocks.map(b=>[b.id,b]));
const source=(dated=[])=>({recurring:[],dated,places:{changed:{name:'Changed Example Room',href:'/directions/sac-caucus/'},hub:{name:'Example Hub',href:'/directions/sac-mhh/'}}});
const visit=(id,date='2026-11-03',place='changed')=>({id:id.toLowerCase().replaceAll(' ','-'),title:id,program:'craft',date,start:'17:00',end:'18:00',place,media:'m-people-nostalgic'});
const ctx=(events,{stale=false,now='2026-11-03T12:00:00-06:00'}={})=>makeContext({site:read('content/site.json'),media:read('media/manifest.json'),text,today:'2026-11-03',now:Date.parse(now),builtPaths:['/directions/sac-caucus/','/directions/sac-mhh/','/join/email-list/','/forms/programming-feedback/'],data:{events,eventsState:{stale}}});
const render=(id,events=source(),options={})=>String(renderBlock(blocks()[id],ctx(events,options)));

test('Craft hierarchy keeps original edit paths, people photos and useful anchor destinations',()=>{
 const current=page();
 const currentTargets=new Set([...pageStrings(current),...pageValues(current)].map(r=>r.target));
 const stable=['b-cn-hero/title','b-cn-hero/lead','b-cn-expect/title','b-cn-expect/body/0','b-cn-expect/items/0/text','b-cn-expect/items/1/text','b-cn-expect/items/2/text','b-cn-next/title','b-cn-recent/title','b-cn-cta/title','b-cn-cta/primary/label','b-cn-cta/primary/href','b-cn-access/body/0'];
 for(const path of stable)assert.ok(currentTargets.has(`page:pg-craft-nights:${path}`),path);
 const photos={'b-cn-hero':['m-craft-pots-room','m-craft-painted-pumpkin','m-craft-bead-crafts'],'b-cn-expect':['m-craft-planting-station','m-craft-succulent-table'],'b-cn-cta':['m-people-bedazzle-table']};
 for(const [id,items] of Object.entries(photos))assert.deepEqual(current.blocks.find(b=>b.id===id).photos,items,id);
 const out=current.blocks.map(b=>String(renderBlock(b,ctx(source())))).join('');
 assert.ok(out.includes('id="b-cn-hero"'));
 for(const l of current.blocks[0].links)assert.ok(out.includes(`id="${l.href.slice(1)}"`),l.href);
 assert.match(out,/Ask About Materials/);assert.match(out,/mailto:accessibility@badgersupports.org/);
 assert.doesNotMatch(out,/<input|<textarea|<form|All requests must|5 days before|General Student Services Fund/);
 const target='page:pg-craft-nights:b-cn-access/body/0';
 applyEdits({[target]:'Example saved access wording.'},{pages:[current],site:{},text:{}});
 assert.equal(current.blocks.find(b=>b.id==='b-cn-access').body[0],'Example saved access wording.');
});

test('Craft archive captions are editable, source-associated and retain whole photos',()=>{
 const p=page(),b=p.blocks.find(b=>b.id==='b-cn-past-work');assert.equal(b.variant,'whole');
 assert.equal(b.items[0].photo,'m-craft-nostalgic');assert.equal(b.items[1].photo,'m-people-planter-solo');
 assert.match(b.items[0].title,/Nostalgic/);assert.match(b.items[0].lines.join(' '),/September 2026/);
 assert.match(b.items[1].title,/Planter/);assert.doesNotMatch(JSON.stringify(b.items[1]),/2026-14|November/);
 const words=pageStrings(p),values=pageValues(p);
 assert.ok(words.some(r=>r.target.endsWith('b-cn-past-work/items/0/title')));
 assert.ok(values.some(r=>r.target.endsWith('b-cn-past-work/items/1/photo')&&r.kind==='media'));
 const out=render('b-cn-past-work');assert.match(out,/cards--whole/);assert.match(out,/Nostalgic Crafts/);assert.match(out,/Paint a Planter/);
});

test('Craft hero room and calendar describe the same current occurrence',()=>{
 const events=source([visit('Example Current'),visit('Example Next','2026-11-05','hub')]);
 const out=render('b-cn-hero',events),row=nextDated(events,'2026-11-03',1,{program:'craft'},Date.parse('2026-11-03T12:00:00-06:00'))[0];
 assert.match(out,/Example Current/);assert.match(out,/href="\/directions\/sac-caucus\/" class="btn btn--big"/);
 assert.ok(out.includes(`href="/calendar/${row.event}.ics"`));
 const ics=eventIcs(row,{place:row.place,origin:'https://example.org',stamp:'20261103T000000Z'});
 assert.match(ics,/SUMMARY:Example Current/);assert.match(ics,/LOCATION:Changed Example Room/);assert.match(ics,/DTEND:20261104T000000Z/);
 const more=render('b-cn-next',events);assert.match(more,/Example Next/);assert.doesNotMatch(more,/Example Current/);
});

test('Craft exact end promotes the next night and captions the ended event without attendance actions',()=>{
 const events=source([visit('Example Ended'),visit('Example Next','2026-11-05','hub')]),options={now:'2026-11-03T18:00:00-06:00'};
 const hero=render('b-cn-hero',events,options);assert.match(hero,/Example Next/);assert.doesNotMatch(hero,/Example Ended/);
 const recent=render('b-cn-recent',events,options);assert.match(recent,/Example Ended/);assert.match(recent,/evshot-date/);assert.match(recent,/m-people-nostalgic/);
 assert.doesNotMatch(recent,/calendar\/|class="drop"|class="btn/);
 const withoutPhoto=render('b-cn-recent',source([{...visit('Example Text Recap','2026-11-02'),media:null}]),options);assert.match(withoutPhoto,/Example Text Recap/);assert.doesNotMatch(withoutPhoto,/calendar\/|class="drop"/);
});

test('Craft empty, unresolved-time and missing-room states offer honest alternatives',()=>{
 const empty=render('b-cn-hero');assert.ok(empty.includes(text['events.none']));assert.match(empty,/href="\/join\/email-list\/"/);assert.doesNotMatch(empty,/class="btn btn--big"|calendar\//);
 const missing=render('b-cn-hero',source([{...visit('Example Missing'),place:'absent'}]));assert.match(missing,/Ask About the Location/);assert.doesNotMatch(missing,/class="btn btn--big"/);
 const unknown=render('b-cn-hero',source([{...visit('Example Unresolved'),end:'16:00'}]));assert.match(unknown,/Confirm the Time/);assert.doesNotMatch(unknown,/calendar\/|class="btn btn--big"/);
});

test('Craft stale feeds suppress current actions while retaining captioned history',()=>{
 const events=source([visit('Example Past','2026-11-02'),visit('Example Future','2026-11-05')]);
 const hero=render('b-cn-hero',events,{stale:true});assert.match(hero,/couldn’t confirm the current event schedule/);assert.match(hero,/href="\/join\/email-list\/"/);assert.doesNotMatch(hero,/Example Future|calendar\/|class="btn btn--big"/);
 for(const show of ['upcoming','all','recent']){
  const b={...blocks()['b-cn-recent'],show,skip:0},out=String(renderBlock(b,ctx(events,{stale:true})));
  assert.doesNotMatch(out,/Example Future|calendar\/|class="drop"/);
  if(show!=='recent')assert.match(out,/couldn’t confirm the current event schedule/);
  if(show!=='upcoming')assert.match(out,/Example Past/);
 }
});

test('Craft linked anchors protect sections and quiet CTAs keep their destination',()=>{
 const p=page(),site=read('content/site.json');
 for(const section of ['b-cn-expect','b-cn-past-work','b-cn-cta']){
  const context={pages:[p],site,authored:new Set([p.id]),links:[{from:{page:p.id,block:'b-cn-hero'},href:'#'+section}]};
  assert.throws(()=>applyChange(emptyStructure(),{action:'sectionRetire',page:p.id,section},context),e=>e.code==='section.linked');
 }
 const out=String(BLOCKS.cta.render({...blocks()['b-cn-cta'],quiet:true,photos:[]},ctx(source())));assert.match(out,/id="b-cn-cta"/);
});


test('Craft multiday visit and calendar retain the same original start and final end',()=>{
 const events=source([{...visit('Example Weekend','2026-11-02'),endDate:'2026-11-04'}]);
 const out=render('b-cn-hero',events),row=nextDated(events,'2026-11-03',1,{program:'craft'},Date.parse('2026-11-03T12:00:00-06:00'))[0];
 assert.match(out,/data-starts="2026-11-02T17:00:00-06:00"/);assert.match(out,/data-ends="2026-11-04T18:00:00-06:00"/);
 const ics=eventIcs(row,{place:row.place,origin:'https://example.org',stamp:'20261103T000000Z'});assert.match(ics,/DTSTART:20261102T230000Z/);assert.match(ics,/DTEND:20261105T000000Z/);
});
