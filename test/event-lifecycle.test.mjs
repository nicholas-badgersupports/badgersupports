import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from '../ops/build.mjs';
import {nextDated,lastDated} from '../src/render/events.mjs';
import {makeContext} from '../src/render/context.mjs';
import {BLOCKS} from '../src/render/registry.mjs';
import {eventState} from '../src/shared/event-state.mjs';
import {rowsBetween} from '../src/render/events.mjs';
const text=Object.fromEntries(Object.entries(JSON.parse(fs.readFileSync(path.join(ROOT,'content/text.json'))).text).map(([k,v])=>[k,v.text]));
const event=(id,date,start='17:00',end='18:00')=>({id,program:'craft',title:id,date,start,end,place:'room'});
const source=dated=>({dated,recurring:[],places:{room:{name:'Example Room',href:'/directions/sac-mhh/'}}});
const hero=(events,at,today='2026-11-03')=>String(BLOCKS.eventhero.render({id:'b-clock',type:'eventhero',source:'events',title:'Craft Nights',program:'craft'},makeContext({site:{},text,data:{events},builtPaths:['/directions/sac-mhh/','/join/email-list/'],today,now:Date.parse(at)})));
test('an ended event leaves upcoming and reaches recent on its actual end rather than midnight',()=>{
 const events=source([event('Earlier Today','2026-11-03'),event('Tomorrow Visit','2026-11-04')]),at=Date.parse('2026-11-03T18:00:00-06:00');
 assert.equal(nextDated(events,'2026-11-03',1,{program:'craft'},at)[0].event,'Tomorrow Visit');
 assert.equal(lastDated(events,'2026-11-03',1,{program:'craft'},at)[0].event,'Earlier Today');
 const out=hero(events,'2026-11-03T18:00:00-06:00');assert.match(out,/Tomorrow Visit/);assert.doesNotMatch(out,/Earlier Today/);
});
test('missing end times stay unknown rather than disappearing at their start',()=>{
 const events=source([event('Unknown Duration','2026-11-03','17:00',null)]),now=Date.parse('2026-11-03T18:00:00-06:00');
 const row=nextDated(events,'2026-11-03',1,null,now)[0];assert.equal(row.event,'Unknown Duration');assert.equal(row.endsAt,null);assert.equal(eventState(row,now),'unknown');assert.equal(lastDated(events,'2026-11-03',1,null,now).length,0);
});
test('recess exclusions and ordinary afternoon events across Chicago daylight saving use source days',()=>{
 const events={...source([]),recurring:[{id:'w1',title:'Example Group',program:'peer',weekday:0,start:'17:00',end:'18:00',from:'2026-03-01',until:'2026-03-15',skip:['2026-03-15']}]};
 assert.equal(rowsBetween(events,'2026-03-01',1)[0].startsAt,'2026-03-01T17:00:00-06:00');
 assert.equal(rowsBetween(events,'2026-03-08',1)[0].startsAt,'2026-03-08T17:00:00-05:00');
 assert.equal(rowsBetween(events,'2026-03-15',1).length,0);
});
test('before during exact-end next-day and no-upcoming states give an honest next action',()=>{
 const events=source([event('Example Night','2026-11-03')]);
 assert.doesNotMatch(hero(events,'2026-11-03T16:59:59-06:00'),/class="evcard is-feature is-happening/);
 assert.match(hero(events,'2026-11-03T17:00:00-06:00'),/class="evcard is-feature is-happening/);
 for(const [at,today] of [['2026-11-03T18:00:00-06:00','2026-11-03'],['2026-11-04T00:00:00-06:00','2026-11-04']]){const out=hero(events,at,today);assert.match(out,/Nothing is scheduled yet/);assert.match(out,/href="\/join\/email-list\/"/);assert.doesNotMatch(out,/class="feature-actions"/);}
});
