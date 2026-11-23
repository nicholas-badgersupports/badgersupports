import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {ROOT,build} from '../ops/build.mjs';

test('the email list page carries its form under its own heading, and every way in lands on the form',async()=>{
 const resources=JSON.parse(fs.readFileSync(path.join(ROOT,'content/fixtures/resources.json'))).resources;
 const cfg={url:'https://home.badgersupports.org',keyId:'fixture',secret:'x'.repeat(40),fetch:async(url,init)=>({json:async()=>({publicAlumniHistory:{ok:true,schema:'bss.alumni-history/1',groups:[]},publicEvents:{ok:true,schema:1,events:[],weekly:[]},publicResourceExport:{ok:true,schema:1,resources},publicTeam:{ok:true,schema:'bss.team/1',people:[]},publicWallNotes:{ok:true,schema:'bss.wall/1',notes:[]}}[JSON.parse(init.body).action])})};
 const out=path.join(ROOT,'local/test-email-list-direct');await build({production:true,connectConfig:cfg,out,serverDir:path.join(out,'_server'),media:false,today:'2026-11-13'});
 const page=fs.readFileSync(path.join(out,'join/email-list/index.html'),'utf8');
 assert.equal((page.match(/<h1[\s>]/g)||[]).length,1,'one h1 on the page');
 assert.match(page,/<section class="form-page" id="b-form-email-list"/,'the form section carries the anchor the ways in land on');
 assert.match(page,/<h2 class="form-title" id="b-form-email-list-h">Request Email Updates<\/h2>/);
 assert.match(page,/action="\/api\/forms\/email-list\/submit"/);
 assert.match(page,/data-form="email-list" data-version="1" data-level="2"/);
 assert.match(page,/name="email"/);
 assert.ok(page.indexOf('data-block="b-el-head"')<page.indexOf('data-block="b-form-email-list"'),'the form follows the page head');
 assert.ok(page.indexOf('data-block="b-form-email-list"')<page.indexOf('data-block="b-el-add"'),'the form stands before the Google Groups help, not below it');
 const head=page.slice(page.indexOf('data-block="b-el-head"'),page.indexOf('data-block="b-form-email-list"'));
 assert.match(head,/href="#b-form-email-list"/,'the page head button jumps straight to the form on the same page');
 const home=fs.readFileSync(path.join(out,'index.html'),'utf8');
 assert.match(home,/href="\/join\/email-list\/#b-form-email-list"/,'the home page way in lands on the form');
 assert.doesNotMatch(home,/href="\/join\/email-list\/?"/,'no way in on the home page stops at the top of the email list page');
 const own=fs.readFileSync(path.join(out,'forms/email-list/index.html'),'utf8');
 assert.equal((own.match(/<h1[\s>]/g)||[]).length,1);
 assert.match(own,/<h1 id="b-form-email-list-h">Request Email Updates<\/h1>/,'the form keeps its own page, where it is the heading');
});
