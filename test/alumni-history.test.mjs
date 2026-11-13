import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {ROOT,build} from '../ops/build.mjs';
import {publicHistory,prepareHistory} from '../src/shared/alumni-history.mjs';
import {alumniNow} from '../netlify/lib/alumni-history.mjs';
import {useStore,memoryStore,noteSet} from '../netlify/lib/published.mjs';
import {useContent} from '../netlify/lib/content.mjs';
import {useConnect} from '../netlify/lib/connect.mjs';
import {handlePage,useDist,previewResponse} from '../netlify/lib/pages.mjs';

const fixture=()=>JSON.parse(fs.readFileSync(path.join(ROOT,'content/fixtures/alumni-history.json')));
const PRIVATE='PRIVATE-RESEARCH-DO-NOT-DISPLAY';
const load=()=>{const d=fixture();d.groups[0].people[0].email='example@example.org';d.groups[0].people[0].researchNotes=PRIVATE;d.workbookUrl='https://docs.google.com/private-review';return d;};
test('public history projects only approved names periods titles and program provenance',()=>{
 const output=publicHistory(load()),person=output.groups[0].people[0];
 assert.equal(person.years,'Within 2021–2023');assert.deepEqual(person.titles,['Peer Facilitator','Programs Coordinator']);
 assert.deepEqual(Object.keys(person),['id','name','years','titles']);assert.ok(!JSON.stringify(output).includes(PRIVATE));assert.doesNotMatch(JSON.stringify(output),/@|workbookUrl|researchNotes/);
 for(const change of [d=>{d.approved=false},d=>{d.asOf='2026-99-99'},d=>{d.groups[0].people[0].years='2027'},d=>{d.groups[0].people[0].titles=['Coordinator 2027']},d=>{d.groups[0].people[0].name='example@example.org'},d=>{d.groups[0].people[0].id=123},d=>{d.groups.push(structuredClone(d.groups[0]))}]){
  const bad=load();change(bad);assert.throws(()=>publicHistory(bad),e=>e.code==='alumni.invalid');
 }
});
function review(){const d=load();d.schema='bss.alumni-review/1';const good={...d.groups[0].people[0],status:'former',displayApproved:true,currentStudentLeader:false};d.groups=[{...d.groups[0],people:[good,...['current','uncertain','onboarding-only'].map((status,i)=>({...good,id:'excluded-'+i,status})),{...good,id:'not-reviewed',displayApproved:false},{...good,id:'current-role',currentStudentLeader:true}]}];return d;}
test('local preparation excludes current uncertain onboarding-only and unapproved display records',()=>{
 const {result,included,excluded}=prepareHistory(review());assert.equal(included,1);assert.equal(excluded,5);assert.equal(result.groups[0].people.length,1);assert.doesNotMatch(JSON.stringify(result),/status|displayApproved|currentStudentLeader|@|PRIVATE-RESEARCH/);
 const pending=review();pending.approved=false;assert.throws(()=>prepareHistory(pending),e=>e.code==='alumni.approval');
});
test('disabled empty current and unavailable runtime sources are distinct without a cached real roster',async()=>{
 useStore({get:async()=>{throw Error('must not read disabled source')}});assert.equal((await alumniNow({enabled:false})).state,'disabled');
 useStore(memoryStore());assert.equal((await alumniNow({enabled:true})).state,'empty');await noteSet('public-alumni-history',load());
 const ready=await alumniNow({enabled:true});assert.equal(ready.state,'ready');assert.doesNotMatch(JSON.stringify(ready),/PRIVATE-RESEARCH|@/);
 const changed=load();changed.revision='changed';changed.groups[0].people[0].name='Updated Example';await noteSet('public-alumni-history',changed);assert.equal((await alumniNow({enabled:true})).value.groups[0].people[0].name,'Updated Example');
 useStore({get:async()=>{throw Error('fictional outage')}});const failed=await alumniNow({enabled:true});assert.equal(failed.state,'unavailable');assert.deepEqual(failed.value.groups,[]);
});
test('local preparation writes no names to its report and refuses output in source or through a source symlink',()=>{
 const dir=fs.mkdtempSync(path.join(path.dirname(ROOT),'alumni-preparation-')),input=path.join(dir,'review.json'),out=path.join(dir,'display.json');fs.writeFileSync(input,JSON.stringify(review()),{mode:0o600});
 const run=extra=>spawnSync(process.execPath,['ops/alumni-history.mjs',input,...extra],{cwd:ROOT,encoding:'utf8'});
 let r=run([]);assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/1 included, 5 excluded/);assert.doesNotMatch(r.stdout+r.stderr,/River|PRIVATE-RESEARCH|example@example/);assert.ok(!fs.existsSync(out));
 r=run(['--out='+out]);assert.equal(r.status,0,r.stderr);assert.doesNotMatch(fs.readFileSync(out,'utf8'),/@|PRIVATE-RESEARCH|status/);assert.equal(fs.statSync(out).mode&0o777,0o600);
 assert.deepEqual(publicHistory(JSON.parse(fs.readFileSync(out,'utf8'))),prepareHistory(review()).result,'the exact CLI output can be validated again by the runtime adapter');
 assert.equal(run(['--out='+out]).status,1,'an existing private file is not overwritten');
 const blocked=path.join(ROOT,'local','forbidden-alumni-display.json');r=run(['--out='+blocked]);assert.equal(r.status,1);assert.ok(!fs.existsSync(blocked));
 const alias=path.join(dir,'source-alias');fs.symlinkSync(path.join(ROOT,'local'),alias,'dir');r=run(['--out='+path.join(alias,'forbidden-alumni-display.json')]);assert.equal(r.status,1);assert.ok(!fs.existsSync(blocked));
});

test('approved history is read from Connect on each draw, stays runtime-only and independent of the email request and private preview',async()=>{
 const resources=JSON.parse(fs.readFileSync(path.join(ROOT,'content/fixtures/resources.json'))).resources;
 let alumniReply={ok:true,schema:'bss.alumni-history/1',groups:[]},down=false;
 const cfg={url:'https://home.badgersupports.org',keyId:'fixture',secret:'x'.repeat(40),fetch:async(url,init)=>{if(down)throw TypeError('fictional outage');return {json:async()=>({publicAlumniHistory:alumniReply,publicEvents:{ok:true,schema:1,events:[],weekly:[]},publicResourceExport:{ok:true,schema:1,resources},publicTeam:{ok:true,schema:'bss.team/1',people:[]},publicWallNotes:{ok:true,schema:'bss.wall/1',notes:[]}}[JSON.parse(init.body).action])}}};
 const out=path.join(ROOT,'local/test-alumni-runtime');await build({production:true,connectConfig:cfg,out,serverDir:path.join(out,'_server'),media:false,today:'2026-11-03'});
 const server=JSON.parse(fs.readFileSync(path.join(out,'_server/server.json')));assert.equal(server.render.alumniSource.enabled,true);assert.doesNotMatch(fs.readFileSync(path.join(out,'join/alumni/index.html'),'utf8'),/River Example|Casey Sample/);
 server.render.alumniSource.enabled=true;useContent(server);useConnect(cfg);useDist(out);useStore(memoryStore());
 alumniReply={ok:true,...prepareHistory(review()).result};
 const get=()=>handlePage(new Request('https://site.test/join/alumni/'),{today:'2026-11-03'});
 let r=await get();assert.equal(r.status,200);let body=await r.text();assert.match(body,/<details open>/);assert.match(body,/Within 2021–2023/);assert.match(body,/Badger Support Network/);assert.match(body,/River Example/);assert.doesNotMatch(body,/PRIVATE-RESEARCH|example@example/);assert.match(body,/href="\/forms\/email-list\/"/);
 r=await previewResponse('pg-alumni',{edits:{},structure:null,today:'2026-11-03'});assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.match(await r.text(),/River Example/);
 alumniReply={ok:true,...fixture(),groups:[]};body=await(await get()).text();assert.match(body,/No alumni history is published here yet/);assert.doesNotMatch(body,/River Example/);
 down=true;const old=console.error;console.error=()=>{};try{r=await get();body=await r.text();assert.match(body,/Alumni history could not be loaded/);assert.doesNotMatch(body,/River Example/);assert.equal(r.headers.get('cache-control'),'no-store');}finally{console.error=old;useConnect(null);}
});
