import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { build, ROOT } from '../ops/build.mjs';
import { mapTeam, readFeedRules } from '../ops/connect-feed.mjs';
import { teamProblems } from '../src/render/team.mjs';
import { useContent } from '../netlify/lib/content.mjs';
import { useConnect } from '../netlify/lib/connect.mjs';
import { useStore, memoryStore } from '../netlify/lib/published.mjs';
import { handlePage, useDist } from '../netlify/lib/pages.mjs';
import { sharedNow, forgetShared, forgetSharedEverywhere, teamPhotoResponse, SHARED_FRESH_MS, PROFILE_FALLBACK_MS } from '../netlify/lib/live-content.mjs';

const OUT=path.join(ROOT,'local/test-build-shared');
const ID='p'+'1'.repeat(24);
const PHOTO=`https://home.badgersupports.org/p/${ID}`;
const PERSON={id:ID,slug:'avery-example',published:true,name:'Avery Example',title:'Program Coordinator',role:'Coordinator',group:'staff',bio:['A public profile paragraph.'],classYear:'Spring 2028',photo:{url:PHOTO,alt:'Avery Example'}};
const PRIVATE='never-publish-this-account-data';
const RULES={...readFeedRules(ROOT),exports:{team:true,wall:true}};
const baseResources=JSON.parse(fs.readFileSync(path.join(ROOT,'content/fixtures/resources.json'),'utf8'));
const PRODUCER=JSON.parse(fs.readFileSync(path.join(ROOT,'test/fixtures/team-producer.json'),'utf8'));
let reply,offline,photoBytes,calls,clock,realNow,photoType="image/png",photoLength=null;
const cfg={url:'https://home.badgersupports.org',keyId:'fixture',secret:'x'.repeat(40),fetch:async(url,init)=>{
 calls.push({url,method:init.method,headers:init.headers,redirect:init.redirect});
 if(offline)throw new Error('offline');
 if(init.method==='GET')return new Response(photoBytes,{headers:{'content-type':photoType,...(photoLength?{'content-length':String(photoLength)}:{})}});
 const action=JSON.parse(init.body).action;
 return {json:async()=>structuredClone(reply[action]||{ok:false})};
}};
let SERVER;
test.before(async()=>{
 calls=[];offline=false;photoType="image/png";photoLength=null;photoBytes=Buffer.from([137,80,78,71,1]);
 reply={publicEvents:{ok:true,schema:1,events:[],weekly:[]},publicResourceExport:{ok:true,schema:1,resources:baseResources.resources},publicTeam:{ok:true,schema:'bss.team/1',people:[PERSON]},publicWallNotes:{ok:true,schema:'bss.wall/1',notes:[{id:'w1',text:'A moderated public note.'}]}};
 await build({production:true,connectConfig:cfg,feedRules:RULES,out:OUT,serverDir:path.join(OUT,'_server'),media:false,today:'2026-11-03'});
 SERVER=JSON.parse(fs.readFileSync(path.join(OUT,'_server/server.json'),'utf8'));
});
test.beforeEach(()=>{
 realNow=Date.now;clock=realNow();Date.now=()=>clock;
 calls=[];offline=false;photoType="image/png";photoLength=null;photoBytes=Buffer.from([137,80,78,71,1]);
 reply={publicEvents:{ok:true,schema:1,events:[],weekly:[]},publicResourceExport:{ok:true,schema:1,resources:baseResources.resources},publicTeam:{ok:true,schema:'bss.team/1',people:[structuredClone(PERSON)]},publicWallNotes:{ok:true,schema:'bss.wall/1',notes:[{id:'w1',text:'A moderated public note.'}]}};
 useContent(SERVER);useDist(OUT);useStore(memoryStore());useConnect(cfg);forgetShared();
});
test.afterEach(()=>{Date.now=realNow;useConnect(null);forgetShared()});
const get=p=>handlePage(new Request('https://site.test'+p),{today:'2026-11-03'});
const quietly=async f=>{const old=console.error;console.error=()=>{};try{return await f()}finally{console.error=old}};

test('the actual team contract omits invented fields and tolerates missing display details',()=>{
 const row={...PERSON,email:PRIVATE,ssid:PRIVATE,credentials:PRIVATE,order:77,aliases:[PRIVATE]};
 for(const field of ['name','title','role','pronouns','classYear','bio','contact','photo']){
  const incomplete={...row};delete incomplete[field];
  const mapped=mapTeam({people:[incomplete]}).team;
  assert.equal(mapped.people.length,1,field);assert.deepEqual(teamProblems(mapped,{production:true}),[],field);
  assert.ok(!JSON.stringify(mapped).includes(PRIVATE));
 }
 assert.equal(mapTeam({people:[{...row,bio:undefined}]}).team.people[0].bio.length,0);
 const mapped=mapTeam({people:[{...row,slug:'not a valid path'},row,{...row,id:'p'+'2'.repeat(24)}]});
 assert.equal(mapped.team.people.length,1,'one corrupt identity or duplicate does not stop valid people');
 assert.ok(mapped.dropped.some(x=>/invalid or duplicate identity/.test(x)));
 for(const published of [false,'true',1,undefined])assert.equal(mapTeam({people:[{...PERSON,published}]}).team.people.length,0);
});
test('a production profile photo is never copied to immutable media or sent as a private URL',()=>{
 const html=fs.readFileSync(path.join(OUT,'about/our-team/index.html'),'utf8');
 assert.match(html,new RegExp(`/api/team-photo/${ID}`));
 assert.doesNotMatch(html,/https:\/\/home\.badgersupports\.org\/p\//);
 assert.equal(SERVER.render.team.people[0].photo.link,PHOTO);
 assert.equal(SERVER.render.data.team.people[0].classYear,'Spring 2028');
});
test('add, edit and remove profiles after the build without publishing',async()=>{
 await get('/about/our-team/');
 reply.publicTeam.people=[{...PERSON,name:'Avery Updated',title:'',role:'',bio:[]},{...PERSON,id:'p'+'2'.repeat(24),slug:'new-person',name:'New Person',photo:undefined}];
 clock+=SHARED_FRESH_MS+1;
 const list=await(await get('/about/our-team/')).text();assert.match(list,/Avery Updated|New Person/);
 const own=await get('/about/our-team/new-person/');assert.equal(own.status,200);assert.match(await own.text(),/New Person/);
 const changed=await(await get('/about/our-team/avery-example/')).text();assert.match(changed,/Avery Updated/);assert.doesNotMatch(changed,/Avery Updated is  at/);
 reply.publicTeam.people=[];clock+=SHARED_FRESH_MS+1;
 assert.equal((await get('/about/our-team/avery-example/')).status,404);
 assert.equal((await get('/about/our-team/new-person/')).status,404);
 const empty=await(await get('/about/our-team/')).text();assert.doesNotMatch(empty,/Avery Updated|New Person/);
});
test('the page plus source-cache freshness stays inside thirty minutes',async()=>{
 const res=await get('/about/our-team/');const cache=res.headers.get('netlify-cdn-cache-control');
 const max=Number(cache.match(/s-maxage=(\d+)/)[1]),swr=Number(cache.match(/stale-while-revalidate=(\d+)/)[1]);
 assert.ok((max+swr)*1000+SHARED_FRESH_MS<=30*60_000);
});
test('last-good catalogues survive a cold instance; failed reads are distinct from empty success',async()=>{
 await get('/about/our-team/');
 offline=true;clock+=SHARED_FRESH_MS+1;forgetShared();
 const old=await quietly(()=>sharedNow(SERVER.render));assert.equal(old.team.stale,true);assert.equal(old.team.value.people.length,1);assert.equal(old.resources.value.resources.length,baseResources.resources.length);
 clock+=PROFILE_FALLBACK_MS+1;forgetShared();
 const expired=await quietly(()=>sharedNow(SERVER.render));assert.equal(expired.team.unavailable,true);assert.equal(expired.team.value.people.length,0);assert.ok(expired.resources.value.resources.length>0);
 offline=false;reply.publicTeam.people=[];clock+=SHARED_FRESH_MS+1;forgetShared();
 const empty=await sharedNow(SERVER.render);assert.equal(empty.team.stale,false);assert.equal(empty.team.value.people.length,0);
});
test('resources and moderated notes change between publishes and never include unpublished team fields',async()=>{
 await get('/resources/');
 reply.publicResourceExport.resources=[{...baseResources.resources[0],name:'A Later Approved Resource'}];
 reply.publicWallNotes.notes=[{id:'w2',text:'A newer moderated note.'}];
 reply.publicTeam.people=[{...PERSON,email:PRIVATE,phone:PRIVATE,permissions:[PRIVATE]}];
 clock+=SHARED_FRESH_MS+1;
 const resources=await(await get('/resources/')).text();assert.match(resources,/A Later Approved Resource/);
 const home=await(await get('/')).text();assert.match(home,/A newer moderated note/);assert.doesNotMatch(home,/A moderated public note/);
 const list=await(await get('/about/our-team/')).text();assert.ok(!list.includes(PRIVATE));
});
test('Refresh Now reaches another warm function without waiting for its held catalogue',async()=>{
 const other=await import('../netlify/lib/live-content.mjs?second-function');
 const before=await other.sharedNow(SERVER.render);assert.equal(before.team.value.people[0].name,'Avery Example');
 reply.publicTeam.people=[{...PERSON,name:'Avery Refreshed'}];
 await forgetSharedEverywhere();
 const after=await other.sharedNow(SERVER.render);assert.equal(after.team.value.people[0].name,'Avery Refreshed');
});
test('photo changes use a bounded source bucket, refuse arbitrary destinations, and stop after removal',async()=>{
 const req=new Request(`https://site.test/api/team-photo/${ID}`);
 let first=await teamPhotoResponse(req,ID);assert.equal(first.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await first.arrayBuffer()),photoBytes);
 const firstUrl=calls.find(x=>x.method==='GET').url;
 clock+=SHARED_FRESH_MS+1;photoBytes=Buffer.from([137,80,78,71,2]);
 const next=await teamPhotoResponse(req,ID);assert.deepEqual(Buffer.from(await next.arrayBuffer()),photoBytes);
 assert.notEqual(calls.filter(x=>x.method==='GET').at(-1).url,firstUrl);
 assert.equal(calls.filter(x=>x.method==='GET').at(-1).headers,undefined,'no browser cookies or service headers go to the image');
 assert.equal(calls.filter(x=>x.method==='GET').at(-1).redirect,'error');
 reply.publicTeam.people=[{...PERSON,photo:{url:'https://home.badgersupports.org/some-other-path'}}];clock+=SHARED_FRESH_MS+1;
 const fallback=await teamPhotoResponse(req,ID);assert.equal(fallback.headers.get('content-type'),'image/svg+xml');
 reply.publicTeam.people=[];clock+=SHARED_FRESH_MS+1;
 assert.equal((await teamPhotoResponse(req,ID)).status,404);
 assert.equal((await teamPhotoResponse(new Request(req.url+'?url=https://example.org'),ID)).status,404);
});

test('non-string identities are isolated before rendering or generating paths',()=>{
 for(const value of [123,true,{},[]])for(const field of ['id','slug']){
  const mapped=mapTeam({people:[{...PERSON,[field]:value},PERSON]});
  assert.equal(mapped.team.people.length,1);assert.equal(mapped.team.people[0].slug,PERSON.slug);
 }
});
test('an unavailable editorial store never resurrects opted-out built profiles',async()=>{
 reply.publicTeam.people=[];
 useStore({kind:'broken',get:async()=>{throw new Error('store unavailable')},set:async()=>{throw new Error('store unavailable')}});
 const list=await get('/about/our-team/');assert.equal(list.headers.get('cache-control'),'no-store');assert.doesNotMatch(await list.text(),/Avery Example/);
 const profile=await get('/about/our-team/avery-example/');assert.equal(profile.status,404);assert.doesNotMatch(await profile.text(),/Avery Example/);
});
test('stale personal HTML cannot extend the fallback lifetime through the CDN',async()=>{
 await get('/about/our-team/');offline=true;clock+=PROFILE_FALLBACK_MS-1000;forgetShared();
 const stale=await quietly(()=>get('/about/our-team/'));assert.equal(stale.headers.get('netlify-cdn-cache-control'),'no-store');assert.match(await stale.text(),/Avery Example/);
 clock+=1001;
 const expired=await quietly(()=>get('/about/our-team/'));assert.equal(expired.headers.get('cache-control'),'no-store');assert.doesNotMatch(await expired.text(),/Avery Example/);
});
test('a successful empty resource export renders an explicit state without breaking the build',async()=>{
 reply.publicResourceExport.resources=[];
 const out=path.join(ROOT,'local/test-build-empty-catalogue');
 await build({production:true,connectConfig:cfg,feedRules:RULES,out,serverDir:path.join(out,'_server'),media:false,today:'2026-11-03'});
 assert.match(fs.readFileSync(path.join(out,'resources/index.html'),'utf8'),/No resources are listed right now/);
 const page=await(await get('/resources/')).text();assert.match(page,/No resources are listed right now/);
});


test("photo proxy refuses a different approved host and non-raster or oversized responses", async () => {
  const req = new Request(`https://site.test/api/team-photo/${ID}`);
  reply.publicTeam.people = [{...PERSON,photo:{url:`https://badgerspill.org/p/${ID}`}}];
  assert.equal((await teamPhotoResponse(req,ID)).headers.get("content-type"),"image/svg+xml");
  assert.equal(calls.filter(c=>c.method==='GET').length,0);
  reply.publicTeam.people = [PERSON]; clock += SHARED_FRESH_MS+1;
  photoType="text/html";photoBytes=Buffer.from("untrusted-html");
  assert.equal((await teamPhotoResponse(req,ID)).headers.get("content-type"),"image/svg+xml");
  photoType="image/png";photoLength=6*1024*1024;photoBytes=Buffer.from([137,80,78,71]);
  assert.equal((await teamPhotoResponse(req,ID)).headers.get("content-type"),"image/svg+xml");
  photoLength=null;photoBytes=Buffer.alloc(5*1024*1024+1);
  assert.equal((await teamPhotoResponse(req,ID)).headers.get("content-type"),"image/svg+xml");
});

test("the frozen fictional producer fixture renders incomplete profiles and versioned photos", async () => {
  reply.publicTeam = structuredClone(PRODUCER);
  const mapped = mapTeam(PRODUCER).team;
  assert.equal(mapped.people.length, PRODUCER.people.length);
  const list = await (await get('/about/our-team/')).text();
  for (const p of PRODUCER.people) {
    assert.ok(list.includes(p.name || 'Team Member'));
    assert.equal((await get(`/about/our-team/${p.slug}/`)).status, 200);
  }
  const p = PRODUCER.people.find(p => p.photo), req = new Request(`https://site.test/api/team-photo/${p.id}`);
  assert.equal((await teamPhotoResponse(req,p.id)).headers.get('content-type'),'image/png');
  const first = new URL(calls.filter(c=>c.method==='GET').at(-1).url);
  assert.equal(first.searchParams.get('v'),new URL(p.photo.url).searchParams.get('v'));
  clock += SHARED_FRESH_MS+1;
  assert.equal((await teamPhotoResponse(req,p.id)).headers.get('content-type'),'image/png');
  const next = new URL(calls.filter(c=>c.method==='GET').at(-1).url);
  assert.notEqual(first.searchParams.get('_bss'),next.searchParams.get('_bss'));
});

test("photo source version queries cannot add other or repeated parameters", async () => {
  for (const suffix of ['?v=invalid', '?v='+ 'a'.repeat(32)+'&url=https://example.org', '?v='+ 'a'.repeat(32)+'&v='+ 'b'.repeat(32), '?url=https://example.org']) {
    reply.publicTeam.people=[{...PERSON,photo:{url:PHOTO+suffix}}];
    clock+=SHARED_FRESH_MS+1;
    const response=await teamPhotoResponse(new Request(`https://site.test/api/team-photo/${ID}`),ID);
    assert.equal(response.headers.get('content-type'),'image/svg+xml',suffix);
  }
  assert.equal(calls.filter(c=>c.method==='GET').length,0);
});
