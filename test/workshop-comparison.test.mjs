import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {makeContext} from '../src/render/context.mjs';
import {renderBlock,BLOCKS,blockProblems} from '../src/render/registry.mjs';
import {pageStrings,pageValues,applyEdits} from '../src/shared/edits.mjs';
import {emptyStructure,applyChange} from '../src/shared/structure.mjs';
import {topicFromAddress,workshopRequestLink} from '../src/shared/workshop-topic.mjs';
import {workshopProblems} from '../src/render/blocks/workshops.mjs';
import {googleFormUrl} from '../src/shared/forms.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url)));
const catalogue=()=>read('content/pages/request-a-workshop.json');
const TOPICS={ 'b-rw-networks':'support_network','b-rw-selfcare':'stress_self_care','b-rw-advocacy':'self_advocacy','b-rw-housing':'housing' };
const text=Object.fromEntries(Object.entries(read('content/text.json').text).map(([k,v])=>[k,v.text]));
const ctx=({forms={},formTopic=null}={})=>makeContext({site:read('content/site.json'),text,media:read('media/manifest.json'),builtPaths:['/forms/workshop-request/','/join/request-a-workshop/'],formTopic,data:{forms}});
const markup=p=>p.blocks.map(b=>String(renderBlock(b,ctx()))).join('');

test('Each existing workshop detail previews a specific activity without collecting answers and retains its whole slide and chosen topic',()=>{
 for(const [file,short,topic,meaning] of [['btw-support-networks','sn','support_network',/emotional, academic, practical, and professional/],['btw-stress-management-self-care','sc','stress_self_care',/cannot eliminate every problem/],['btw-navigating-housing','nh','housing',/bedroom without a window/]]){
  const p=read('content/pages/'+file+'.json');assert.deepEqual(blockProblems(p),[]);
  const activity=p.blocks.find(b=>b.id===`b-btw-${short}-activity`), closing=p.blocks.at(-1);
  assert.ok(activity,`${file} needs its specific activity`);assert.equal(activity.type,'expect');assert.ok(activity.disclosure);assert.match(activity.preview.join(' '),meaning);
  assert.equal(closing.whole,true);assert.equal(closing.photos.length,1);assert.equal(closing.primary.href,'/forms/workshop-request/?topic='+topic);
  assert.ok(p.blocks.find(b=>b.id===`b-btw-${short}-quote`).body.length>2,'keep the original creator quotation');
  const out=markup(p);assert.match(out,new RegExp(`<details class="expect-preview" id="b-btw-${short}-activity-preview"><summary>`));
  assert.doesNotMatch(out,/<form|<input|<textarea|\bonclick=|<[^>]+\shidden(?:\s|=|>)/);
  const target=`page:${p.id}:b-btw-${short}-activity/preview/0`, old=`page:${p.id}:b-btw-${short}-quote/body/0`;
  const targets=new Set(pageStrings(p).map(x=>x.target));assert.ok(targets.has(target));assert.ok(targets.has(old));
  assert.equal(applyEdits({[target]:'Saved activity sample.',[old]:'Saved original quotation.'},{pages:[p],site:{},text:{}}).problems.length,0);
  const saved=markup(p);assert.match(saved,/Saved activity sample\./);assert.match(saved,/Saved original quotation\./);assert.equal(p.blocks.at(-1).primary.href,'/forms/workshop-request/?topic='+topic);
 }
});

test('Workshop comparison has equal native topic jumps and preserves original targets and people photos',()=>{
 const p=catalogue();assert.deepEqual(blockProblems(p),[]);const h=p.blocks[0],hrefs=h.links?.map(l=>l.href)||[];
 assert.deepEqual(hrefs,Object.keys(TOPICS).map(id=>'#'+id));
 assert.equal(h.primary.href,'/forms/workshop-request/');
 const targets=new Set([...pageStrings(p),...pageValues(p)].map(r=>r.target));
 for(const path of ['b-rw-head/title','b-rw-head/lead','b-rw-head/primary/href','b-rw-networks/body/0','b-rw-networks/items/0/text','b-rw-selfcare/body/0','b-rw-advocacy/items/0/text','b-rw-housing/items/0/text','b-rw-training/links/0/href','b-rw-faq/items/0/a/0','b-rw-access/body/0'])assert.ok(targets.has('page:'+p.id+':'+path),path);
 const photos={'b-rw-head':['m-workshop-training-tables','m-workshop-room','m-workshop-housing-panel-wide'],'b-rw-networks':['m-workshop-herald-table','m-workshop-supplies'],'b-rw-selfcare':['m-workshop-housing-classroom'],'b-rw-advocacy':['m-oh-group-posters'],'b-rw-housing':['m-workshop-housing-panel-screen','m-workshop-housing-panel-close']};
 for(const[id,want]of Object.entries(photos))assert.deepEqual(p.blocks.find(b=>b.id===id).photos,want);
 const out=markup(p);for(const href of hrefs)assert.ok(out.includes(`id="${href.slice(1)}"`),href);
 assert.doesNotMatch(out,/<form|<input|<textarea|Requests must be submitted 5 days|respond within|capacity of/);
});

test('Workshop activity previews use native disclosures with distinct editable audience and sample content',()=>{
 const p=catalogue();
 const samples={'b-rw-networks':/emotional, academic, practical, and professional/,'b-rw-selfcare':/bingo/,'b-rw-advocacy':/copying the diagrams/,'b-rw-housing':/floor plan/};
 for(const id of Object.keys(TOPICS)){
  const b=p.blocks.find(b=>b.id===id);assert.ok(b.audience);assert.ok(b.disclosure);assert.equal(b.preview.length,2);
  const out=String(renderBlock(b,ctx()));
  assert.match(out,new RegExp(`<details class="expect-preview" id="${id}-preview"><summary>`));
  assert.ok(out.includes(b.disclosure));assert.ok(out.includes(b.audience));assert.match(out,samples[id]);
  assert.doesNotMatch(out,/<input|<textarea|<form|\bonclick=|<[^>]+\shidden(?:\s|=|>)/);
 }
 const b=p.blocks.find(b=>b.id==='b-rw-networks');
 const out=String(renderBlock({...b,anchor:'example-custom',preview:'One sample paragraph.'},ctx()));
 assert.match(out,/id="example-custom-preview"/);assert.match(out,/<p>One sample paragraph\.<\/p>/);
 const plain=String(renderBlock({...b,preview:undefined},ctx()));assert.doesNotMatch(plain,/<details/);
});

test('Workshop catalogue request actions preselect each current topic while retaining changeable native choices',()=>{
 const p=catalogue(),def=read('content/forms/workshop-request.json');
 for(const[id,topic]of Object.entries(TOPICS)){
  const b=p.blocks.find(b=>b.id===id),l=b.links.find(l=>l.href.startsWith('/forms/workshop-request/'));
  assert.equal(l.href,'/forms/workshop-request/?topic='+topic);
  const selected=topicFromAddress(new URL(l.href,'https://example.org').searchParams);assert.equal(selected,topic);
  const html=String(BLOCKS.form.render({id:'b-form',type:'form',form:def.key},ctx({forms:{[def.key]:def},formTopic:selected})));
  const inputs=[...html.matchAll(/<input\b[^>]*>/g)].map(x=>x[0]).filter(x=>x.includes('name="topics"'));
  assert.equal(inputs.length,4);assert.equal(inputs.filter(x=>/\bchecked\b/.test(x)).length,1);
  assert.ok(inputs.some(x=>x.includes(`value="${topic}"`)&&/\bchecked\b/.test(x)));assert.ok(inputs.every(x=>x.includes('type="checkbox"')&&!/\bdisabled\b|readonly/.test(x)));
 }
});

test('Workshop native closure, trusted Google fallback and manually closed request states stay distinct',()=>{
 const def=read('content/forms/workshop-request.json');def.state='closed';
 for(const topic of Object.values(TOPICS)){
  def.elsewhere=googleFormUrl(def);
  let out=String(BLOCKS.form.render({id:'b-form',type:'form',form:def.key},ctx({forms:{[def.key]:def},formTopic:topic})));
  assert.match(out,/data-form-elsewhere/);assert.match(out,/Google sign-in is required/);assert.match(out,/mailto:directors@badgersupports.org/);assert.match(out,/Request by Email/);assert.match(out,/entry\.1411124785=/);assert.doesNotMatch(out,/<form|type="checkbox"/);
  delete def.elsewhere;
  out=String(BLOCKS.form.render({id:'b-form',type:'form',form:def.key},ctx({forms:{[def.key]:def},formTopic:topic})));
  assert.doesNotMatch(out,/entry\.1411124785=|data-form-elsewhere|<form/);assert.match(out,/Workshop requests are paused right now/);assert.doesNotMatch(out,/Google sign-in is required|Request by Email/);
 }
});

test('Workshop old and new saved word paths render independently without changing selected topic actions',()=>{
 const p=catalogue(),target=path=>'page:'+p.id+':b-rw-networks/'+path;
 const edits={[target('body/0')]:'Saved original overview.',[target('audience')]:'Saved audience guidance.',[target('disclosure')]:'Saved activity heading.',[target('preview/0')]:'Saved activity sample.'};
 const rows=new Set(pageStrings(p).map(r=>r.target));for(const key of Object.keys(edits))assert.ok(rows.has(key),key);
 const before=p.blocks.find(b=>b.id==='b-rw-networks').links.map(l=>l.href);
 const result=applyEdits(edits,{pages:[p],site:{},text:{}});assert.equal(result.problems.length,0);
 const out=markup(p);for(const phrase of Object.values(edits))assert.ok(out.includes(phrase),phrase);
 assert.deepEqual(p.blocks.find(b=>b.id==='b-rw-networks').links.map(l=>l.href),before);
});

test('Workshop comparison and disclosure fragments protect linked sections and copied sections get unique IDs',()=>{
 const p=catalogue(),site=read('content/site.json');
 for(const fragment of ['b-rw-networks','b-rw-networks-preview']){
  const context={pages:[p],site,authored:new Set([p.id]),links:[{from:{page:p.id,block:'b-rw-head'},href:'#'+fragment}]};
  assert.throws(()=>applyChange(emptyStructure(),{action:'sectionRetire',page:p.id,section:'b-rw-networks'},context),e=>e.code==='section.linked',fragment);
 }
 const context={pages:[p],site,authored:new Set([p.id]),links:[]};
 const result=applyChange(emptyStructure(),{action:'sectionCopy',page:p.id,section:'b-rw-networks'},context);
 const copy=result.doc.pages[p.id].sections.made[result.section],out=String(renderBlock(copy,ctx()));
 assert.match(out,new RegExp(`id="${copy.id}-preview"`));assert.doesNotMatch(out,/id="b-rw-networks-preview"/);
 assert.ok(out.includes('/forms/workshop-request/?topic=support_network'));
});


test('Workshop sign-in guidance is limited to the verified trusted fallback and never replaces an open native form',()=>{
 const def=read('content/forms/workshop-request.json'),render=()=>String(BLOCKS.form.render({id:'b-form',type:'form',form:def.key},ctx({forms:{[def.key]:def},formTopic:'housing'})));
 def.elsewhere=googleFormUrl(def);assert.doesNotMatch(render(),/Google sign-in is required|Request by Email/);
 def.state='closed';assert.match(render(),/Google sign-in is required/);
 def.source.publishedId='changed-source';def.elsewhere=googleFormUrl(def);assert.doesNotMatch(render(),/Google sign-in is required|Request by Email|entry\.1411124785=/);
});


test('Home workshop previews carry their own topic while preserving saved primary labels and alternate destinations',()=>{
 const p=read('content/pages/home.json'),b=p.blocks.find(b=>b.type==='workshops');
 assert.deepEqual(b.items.map(w=>w.topic),Object.values(TOPICS));assert.deepEqual(workshopProblems(b),[]);
 const invalid=structuredClone(b);invalid.items[0].topic='not-offered';assert.ok(workshopProblems(invalid).some(x=>/supported workshop request choice/.test(x)));
 const out=String(renderBlock(b,ctx()));
 for(const topic of Object.values(TOPICS))assert.ok(out.includes('/forms/workshop-request/?topic='+topic),topic);
 const strings=new Set(pageStrings(p).map(r=>r.target));assert.ok(strings.has('page:pg-home:b-home-workshops/primary/label'));assert.ok(![...strings].some(k=>k.endsWith('/topic')));
 const saved={...b,primary:{label:'Saved Workshop Action',href:'mailto:directors@badgersupports.org'}};
 const manual=String(renderBlock(saved,ctx()));assert.equal((manual.match(/Saved Workshop Action/g)||[]).length,4);assert.equal((manual.match(/mailto:directors@badgersupports.org/g)||[]).length,4);
 for(const href of ['/forms/workshop-request/?topic=housing','/forms/workshop-request/?topic=housing&topic=self_advocacy','/different-form/','https://example.org/forms/workshop-request/','//example.org/forms/workshop-request/',String.raw`/\example.net/forms/workshop-request/`,String.raw`/\example.net:invalid/forms/workshop-request/`])assert.equal(workshopRequestLink(href,'support_network'),href);
 assert.equal(workshopRequestLink('/forms/workshop-request?return=/join/#request','self_advocacy'),'/forms/workshop-request?return=%2Fjoin%2F&topic=self_advocacy#request');
 assert.equal(workshopRequestLink('/forms/workshop-request/','not-offered'),'/forms/workshop-request/');
});
