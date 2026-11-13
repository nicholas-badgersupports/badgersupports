import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {build,ROOT} from '../ops/build.mjs';
import {freshPglite,useAdapter,many,q,one} from '../netlify/lib/db.mjs';
import {useContent} from '../netlify/lib/content.mjs';
import {setSwitch,currentForm,submit} from '../netlify/lib/intake.mjs';
import {emptyFormSettings,saveFormSettings,readFormSettings,formInstant} from '../netlify/lib/form-settings.mjs';
import {formsFor} from '../netlify/lib/answers.mjs';
import {programElsewhere,programTopic,formTopicFromAddress} from '../src/shared/program-topic.mjs';
import {useConnect} from '../netlify/lib/connect.mjs';
import {handlePage,useDist} from '../netlify/lib/pages.mjs';
import {handle} from '../netlify/lib/router.mjs';
import {useStore,memoryStore} from '../netlify/lib/published.mjs';
import {forgetShared} from '../netlify/lib/live-content.mjs';
import {post,workshopAnswers} from './helpers.mjs';
const OUT=path.join(ROOT,'local/test-native-pages'),DAY='2026-11-05';
const resources=JSON.parse(fs.readFileSync(path.join(ROOT,'content/fixtures/resources.json'))).resources;
const cfg={url:'https://connect.example.org',keyId:'native-page-fixture',secret:'fictional-native-page-fixture-key-00000001',fetch:async(_url,init)=>{const action=JSON.parse(init.body).action;return{json:async()=>action==='publicEvents'?{ok:true,schema:1,events:[],weekly:[]}:action==='publicResourceExport'?{ok:true,schema:1,resources}:action==='publicTeam'?{ok:true,schema:'bss.team/1',people:[]}:{ok:true,schema:'bss.wall/1',notes:[]}};}};
const missing=['program-request','resource-request','referral-card-survey','staff-application','volunteer-application','recommendation-letter'];
let SERVER;
test.before(async()=>{await build({production:true,connectConfig:cfg,out:OUT,serverDir:path.join(OUT,'_server'),media:false,today:DAY});SERVER=JSON.parse(fs.readFileSync(path.join(OUT,'_server/server.json')));});
async function fresh(){process.env.LOCAL_DB='pglite';useAdapter(await freshPglite());useContent(SERVER);useConnect(cfg);useDist(OUT);const store=memoryStore();useStore(store);forgetShared();return store;}
const get=p=>handlePage(new Request('http://site.test'+p),{today:DAY,now:Date.parse('2026-11-05T12:00:00-06:00')});
test.after(()=>useConnect(null));
test('every definition has a production form page and reply metadata, with no production preview route',async()=>{
 assert.equal(Object.keys(SERVER.formPages).length,14);
 for(const key of Object.keys(SERVER.forms)){
  assert.equal(SERVER.formPages[key].path,`/forms/${key}/`,key);
  assert.ok(fs.existsSync(path.join(OUT,'forms',key,'index.html')),key);
  assert.equal(fs.existsSync(path.join(OUT,'forms',key,'preview','index.html')),false,key);
 }
});
test('without a revision, all six added pages are served open, close and open again from the switch, and closed replies retain current introductions',async()=>{
 const store=await fresh();assert.equal(await store.get('current'),null);
 assert.deepEqual(SERVER.render.builtEdits,JSON.parse(fs.readFileSync(path.join(ROOT,'content/edits.json'))).edits);
 for(const key of missing){
  const p=SERVER.formPages[key],version=SERVER.forms[key].version;
  const shipped=await(await get(p.path)).text();assert.match(shipped,new RegExp(`data-form="${key}"`),key);assert.match(shipped,/<form[^>]*novalidate/,key);
  await setSwitch(key,'closed','fictional');
  const closed=await(await get(p.path)).text();assert.ok(closed.includes(p.closedIntro),key);assert.doesNotMatch(closed,/<form[\s>]/,key);
  await setSwitch(key,'open','fictional');
  const open=await(await get(p.path)).text();assert.match(open,new RegExp(`data-form="${key}"`),key);assert.match(open,/<form[^>]*novalidate/,key);
  await setSwitch(key,'closed','fictional');
  const again=await(await get(p.path)).text();assert.doesNotMatch(again,/<form[\s>]/,key);assert.doesNotMatch(again,/on Google Forms for now|April 26|April 3/);
  const posted=await handle(post(`/api/forms/${key}/submit`,{_form:key,_version:String(version),name:'Fictional Example'},{json:false}),{ip:'192.0.2.40'});
  assert.equal(posted.status,409,key);const text=await posted.text();assert.ok(text.includes(p.closedIntro),key);assert.doesNotMatch(text,/April 26|April 3/,key);
 }
 assert.equal(await store.get('current'),null,'form switches work independently of a published wording revision');
 assert.equal((await many('SELECT count(*)::int AS n FROM submissions'))[0].n,0);
});
test('published closed introduction changes apply to both GET and stale closed POST',async()=>{
 const store=await fresh(),key='staff-application',p=SERVER.formPages[key];
 await setSwitch(key,'closed','fixture');
 await store.set('current',{schema:'bss.revision/1',n:2,stamp:2,at:'2026-11-05T12:00:00Z',edits:{[`page:${p.id}:${p.blockId}/closedIntro`]:'Fictional published closed introduction.'}});
 assert.match(await(await get(p.path)).text(),/Fictional published closed introduction/);
 const res=await handle(post(`/api/forms/${key}/submit`,{_form:key,_version:String(SERVER.forms[key].version)},{json:false}),{ip:'192.0.2.41'});
 assert.equal(res.status,409);assert.match(await res.text(),/Fictional published closed introduction/);
});
test('native recruitment pages retain protected source questions and policy words, and ship open',()=>{
 const staff=JSON.parse(fs.readFileSync(path.join(ROOT,'content/forms/staff-application.json')));
 assert.equal(staff.sections.flatMap(s=>s.questions||[]).find(q=>q.id==='resume').required,true);
 assert.ok(JSON.stringify(staff.sections).includes('/forms/volunteer-application/'));
 assert.match(JSON.stringify(staff.intro),/Equal Opportunity Employer/);
 for(const key of missing)assert.equal(SERVER.forms[key].state,'open');
});

test('native program links preserve the offered request type and its original Google fallback without broadening overrides',async()=>{
 await fresh();const key='program-request';
 for(const type of ['peer_support_group','volunteer_training']){
  await fresh();useContent({...SERVER,forms:{...SERVER.forms,[key]:{...SERVER.forms[key],state:'closed'}}}); // shipped closed, no switch row: its Google fallback shows
  const closed=await(await get(`/forms/program-request/?topic=${type}`)).text();
  const topic=programTopic(SERVER.forms[key],type),alternate=new URL(programElsewhere(SERVER.forms[key],topic));
  assert.equal(alternate.searchParams.get('entry.70593572'),topic.label);assert.ok(closed.includes(alternate.href.replaceAll('&','&amp;')));
  await setSwitch(key,'open','fixture');
  assert.match(await(await get(`/forms/program-request/?topic=${type}`)).text(),new RegExp(`name="request_type"[^>]*value="${type}"[^>]*checked`));
  await setSwitch(key,'closed','fixture');
 }
 assert.equal(formTopicFromAddress(new URLSearchParams('topic=peer_support_group&topic=volunteer_training')),null);
 assert.equal(formTopicFromAddress(new URLSearchParams('topic=unoffered')),null);
 const override={...SERVER.forms[key],elsewhere:'https://example.org/alternate'};
 assert.equal(programElsewhere(override,programTopic(override,'peer_support_group')),override.elsewhere);
});

test('intake settings enforce exact Chicago boundaries while priority deadlines keep rolling intake open',async()=>{
 await fresh();await setSwitch('workshop-request','open','fixture');
 assert.equal((await currentForm('workshop-request')).state,'open');
 const settings={...emptyFormSettings(),version:0,opensAt:'2027-03-14T01:30',closesAt:'2027-03-14T03:30',deadline:'2027-03-14T01:45'};
 await saveFormSettings('workshop-request',settings,'fixture');
 for(const [time,state] of [['2027-03-14T01:29:59-06:00','closed'],['2027-03-14T01:30:00-06:00','open'],['2027-03-14T03:00:00-05:00','open'],['2027-03-14T03:30:00-05:00','closed']])assert.equal((await currentForm('workshop-request',{now:Date.parse(time)})).state,state,time);
 assert.equal((await submit('workshop-request',workshopAnswers(),{now:new Date('2027-03-14T03:00:00-05:00')})).ok,true);
 assert.equal((await submit('workshop-request',workshopAnswers(),{now:new Date('2027-03-14T03:30:00-05:00')})).error,'form.closed');
 await setSwitch('workshop-request','closed','fixture');assert.equal((await currentForm('workshop-request',{now:Date.parse('2027-03-14T03:00:00-05:00')})).state,'closed');
 assert.throws(()=>formInstant('2027-03-14T02:30'),{code:'settings.date'});
 assert.throws(()=>formInstant('2027-02-30T12:00'),{code:'settings.date'});
 assert.equal(formInstant('2027-11-07T01:30'),Date.parse('2027-11-07T01:30:00-05:00'));
 await assert.rejects(saveFormSettings('workshop-request',{...settings,version:1,closesAt:'2027-03-14T01:00'},'fixture'),{code:'settings.order'});
 assert.equal((await readFormSettings('workshop-request')).version,1);
});

test('dated GETs and state replies cannot cache across opening, and scheduled uploads refuse intake',async()=>{
 await fresh();await setSwitch('recommendation-letter','open','fixture');
 await saveFormSettings('recommendation-letter',{...emptyFormSettings(),version:0,opensAt:'2027-01-01T12:00',closesAt:'2027-02-01T12:00'},'fixture');
 const before=await handlePage(new Request('http://site.test/forms/recommendation-letter/'),{today:DAY,now:Date.parse('2027-01-01T11:59-06:00')});assert.equal(before.headers.get('netlify-cdn-cache-control'),'no-store');assert.doesNotMatch(await before.text(),/<form[\s>]/);
 const after=await handlePage(new Request('http://site.test/forms/recommendation-letter/'),{today:DAY,now:Date.parse('2027-01-01T12:00-06:00')});assert.match(await after.text(),/<form[\s>]/);
 const state=await handle(new Request('http://site.test/api/forms/recommendation-letter/state'));assert.equal(state.headers.get('netlify-cdn-cache-control'),'no-store');
 const upload=await handle(new Request('http://site.test/api/forms/recommendation-letter/files?q=letter',{method:'POST',headers:{origin:'http://site.test','content-type':'application/pdf',accept:'application/json'},body:Buffer.from('%PDF-1.4\n')}),{ip:'192.0.2.44'});assert.equal(upload.status,409);assert.equal((await one('SELECT count(*)::int AS n FROM uploads')).n,0);
});

async function session(scopes){const id=crypto.randomBytes(32).toString('base64url');await q("INSERT INTO staff_sessions(id_hash,sub,name,scopes,expires_at) VALUES($1,'fictional-editor','Fictional Example',$2::jsonb,now()+interval '1 hour')",[crypto.createHash('sha256').update(id).digest('hex'),JSON.stringify(scopes)]);return `bss_staff=${id}`;}
test('settings save preserves grants, detects stale versions, and records only successful changes',async()=>{
 await fresh();const key='staff-application',base={...emptyFormSettings(),version:0,closesAt:'2026-12-18T23:59'}; // the shipped window is the unsaved starting point
 await setSwitch(key,'closed','fixture');
 const reader=await session(['forms.read:*']),editor=await session(['site.edit']),switcher=await session([`forms.switch:${key}`]),both=await session(['site.edit',`forms.switch:${key}`]);
 const save=(body,cookie)=>handle(post(`/api/staff/forms/${key}/settings`,body,{headers:{cookie}}),{ip:'192.0.2.45'});
 assert.equal((await save({...base,opensAt:'2026-12-01T12:00'},reader)).status,403);
 assert.equal((await save({...base,opensAt:'2026-12-01T12:00'},editor)).status,403);
 assert.equal((await save({...base,title:'Fictional Title'},switcher)).status,403);
 assert.equal((await readFormSettings(key)).version,0);
 assert.equal((await save({...base,title:'Fictional Title',introduction:'Fictional introduction.',closedMessage:'Fictional closed message.'},editor)).status,200);
 assert.equal((await save({...base,opensAt:'2026-12-01T12:00'},both)).status,409);
 const current=await readFormSettings(key);assert.equal(current.version,1);
 assert.equal((await save({...current,opensAt:'2026-12-01T12:00',deadline:'2026-12-08T12:00'},switcher)).status,200);
 assert.equal((await save({...await readFormSettings(key),unexpected:true},both)).status,400);
 assert.equal((await many('SELECT * FROM form_settings_history')).length,2);
 assert.equal((await currentForm(key)).manualState,'closed');
 const html=await(await get('/forms/staff-application/')).text();assert.match(html,/<h1[^>]*>Fictional Title<\/h1>/);assert.match(html,/<title>Fictional Title/);assert.match(html,/Fictional introduction/);assert.match(html,/Fictional closed message/);assert.match(html,/Priority Deadline/);assert.doesNotMatch(html,/April 3|April 26/);
 const posted=await handle(post(`/api/forms/${key}/submit`,{_version:'3'},{json:false}),{ip:'192.0.2.46'});assert.match(await posted.text(),/<h1[^>]*>Fictional Title/);
 const cards=(await formsFor({scopes:['site.edit']})).forms;assert.equal(cards.length,14);assert.ok(cards.every(f=>!f.canRead&&f.total===0&&f.latest===null));
});
