import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {build,ROOT} from '../ops/build.mjs';
import {useConnect} from '../netlify/lib/connect.mjs';
import {useContent} from '../netlify/lib/content.mjs';
import {handlePage,useDist,previewResponse} from '../netlify/lib/pages.mjs';
import {useStore,memoryStore} from '../netlify/lib/published.mjs';
import {forgetShared} from '../netlify/lib/live-content.mjs';

const OUT=path.join(ROOT,'local/test-team-reconciled'),ID='p'+'a'.repeat(24);
const PERSON={id:ID,slug:'fixture-profile',name:'Fixture Person',group:'staff',published:true,bio:[]};
const resources=JSON.parse(fs.readFileSync(path.join(ROOT,'content/fixtures/resources.json'))).resources;
let people=[PERSON],down=false;
const cfg={url:'https://home.badgersupports.org',keyId:'fixture',secret:'x'.repeat(40),fetch:async(url,init)=>{
 const action=JSON.parse(init.body).action;
 if(down&&action==='publicTeam')throw Error('fictional team unavailable');
 return {json:async()=>action==='publicTeam'?{ok:true,schema:'bss.team/1',people}:action==='publicEvents'?{ok:true,schema:1,events:[],weekly:[]}:action==='publicResourceExport'?{ok:true,schema:1,resources}:{ok:true,schema:'bss.wall/1',notes:[]}};
}};
let SERVER;
test.before(async()=>{await build({production:true,connectConfig:cfg,out:OUT,serverDir:path.join(OUT,'_server'),media:false,today:'2026-11-03'});SERVER=JSON.parse(fs.readFileSync(path.join(OUT,'_server/server.json')));});
test.beforeEach(()=>{people=[structuredClone(PERSON)];down=false;useContent(SERVER);useConnect(cfg);useDist(OUT);useStore(memoryStore());forgetShared();});
test.after(()=>useConnect(null));
const get=p=>handlePage(new Request('https://site.test'+p),{today:'2026-11-03'});
test('production keeps public people out of immutable HTML, sitemap, person paths and snapshots',()=>{
 for(const file of ['about/our-team/index.html','sitemap.xml','_server/server.json']){
  const value=fs.readFileSync(path.join(OUT,file),'utf8');assert.ok(!value.includes(PERSON.name),file);assert.ok(!value.includes(PERSON.slug),file);
 }
 assert.ok(!fs.existsSync(path.join(OUT,'about/our-team',PERSON.slug,'index.html')));
});
test('each origin profile draw uses current eligibility without a warm roster fallback',async()=>{
 await get('/about/our-team/');people=[];
 assert.equal((await get('/about/our-team/fixture-profile/')).status,404);
 assert.ok(!(await(await get('/about/our-team/')).text()).includes(PERSON.name));
});
test('public and private team views fail safely with truthful status while unrelated pages remain available',async()=>{
 await get('/about/our-team/');down=true;
 const old=console.error;console.error=()=>{};
 try {
  for(const url of ['/about/our-team/','/about/our-team/fixture-profile/']){const r=await get(url);assert.equal(r.status,503);assert.equal(r.headers.get('cache-control'),'no-store');assert.ok(!(await r.text()).includes(PERSON.name));}
  const r=await previewResponse('pg-about-team',{edits:{'page:pg-about-team:b-team/title':'Draft Team Heading'},structure:null,today:'2026-11-03'});
  assert.equal(r.status,503);assert.equal(r.headers.get('cache-control'),'no-store');assert.match(await r.text(),/Draft Team Heading/);
  assert.equal((await get('/about/faq/')).status,200);
 } finally{console.error=old;}
});
test('current canonical person routes win over old group catch-alls',async()=>{
 people=[{...PERSON,slug:'directors'}];
 const r=await get('/about/our-team/directors/');assert.equal(r.status,200);assert.match(await r.text(),/Fixture Person/);
 assert.doesNotMatch(fs.readFileSync(path.join(OUT,'_redirects'),'utf8'),/\/about\/our-team\/directors\/\*/);
 assert.equal((await get(['','about','our-team','directors','retired-profile',''].join('/'))).status,301);
});
