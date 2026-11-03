import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from '../ops/build.mjs';
import {makeContext} from '../src/render/context.mjs';
import {BLOCKS} from '../src/render/registry.mjs';
import {valueProblem} from '../src/shared/edits.mjs';
import {googleFormUrl} from '../src/shared/forms.mjs';
import {topicFromAddress} from '../src/shared/workshop-topic.mjs';
import {freshServer,post,workshopAnswers} from './helpers.mjs';
import {handle} from '../netlify/lib/router.mjs';

const load=()=>JSON.parse(fs.readFileSync(path.join(ROOT,'content/forms/workshop-request.json')));
const text=Object.fromEntries(Object.entries(JSON.parse(fs.readFileSync(path.join(ROOT,'content/text.json'))).text).map(([k,v])=>[k,v.text]));
const render=(def,topic)=>String(BLOCKS.form.render({id:'b-form',type:'form',form:'workshop-request'},makeContext({site:{},text,data:{forms:{'workshop-request':def}},formTopic:topic})));
const checked=out=>[...out.matchAll(/<input\b[^>]*>/g)].map(m=>m[0]).filter(s=>s.includes('name="topics"')&&/\bchecked\b/.test(s)).map(s=>s.match(/value="([^"]+)"/)?.[1]);
test('URL context accepts exactly one offered stable topic and no arbitrary query content',()=>{
 for(const raw of ['topic=housing&topic=housing','topic=housing&topic=support_network','topic=https://example.org','topic=__proto__','topic=Housing','topic=',''])assert.equal(topicFromAddress(new URLSearchParams(raw)),null,raw);
 assert.equal(topicFromAddress(new URLSearchParams('topic=stress_self_care&return=/elsewhere/')),'stress_self_care');
});
test('internal query and fragment links keep a local normalized path and editable topic IDs',()=>{
 const ctx=makeContext({site:{liveOrigin:'https://www.badgersupports.org',connectOrigin:'https://home.badgersupports.org'},text,builtPaths:['/forms/workshop-request/']});
 assert.deepEqual(ctx.link('/forms/workshop-request?topic=stress_self_care#request'),{href:'/forms/workshop-request/?topic=stress_self_care#request'});
 assert.equal(valueProblem('link','/forms/workshop-request/?topic=stress_self_care'),null);
 assert.equal(valueProblem('link','/forms/workshop-request/?topic=javascript:alert(1)'),'edit.link');
});
test('initial native workshop context preselects only its current offered topic without cross-request mutation',()=>{
 const def=load(),before=JSON.stringify(def);
 assert.deepEqual(checked(render(def,'housing')),['housing']);
 assert.deepEqual(checked(render(def,'support_network')),['support_network']);
 assert.deepEqual(checked(render(def,'unknown')),[]);
 assert.deepEqual(checked(render(def,null)),[]);
 assert.equal(JSON.stringify(def),before);
 const q=def.sections.flatMap(s=>s.questions).find(q=>q.id==='topics');q.options=q.options.filter(o=>o.id!=='housing');
 assert.deepEqual(checked(render(def,'housing')),[]);
});
test('closed trusted Google workshop fallback carries the choice without opening a manual closure',()=>{
 const def=load();def.state='closed';def.elsewhere=googleFormUrl(def);
 let out=render(def,'housing');assert.match(out,/entry\.1411124785=Navigating\+Housing/);assert.equal(def.elsewhere,googleFormUrl(def));
 delete def.elsewhere;out=render(def,'housing');assert.doesNotMatch(out,/entry\.1411124785|data-form-elsewhere/);
 def.source.publishedId='changed-source';def.elsewhere='https://docs.google.com/forms/d/e/changed-source/viewform';
 assert.doesNotMatch(render(def,'housing'),/entry\.1411124785/);
});
test('no-JavaScript error recovery preserves a changed or cleared choice instead of applying URL context again',async()=>{
 await freshServer();
 for(const topics of [['self_advocacy'],[]]){
  const r=await handle(post('/api/forms/workshop-request/submit?topic=housing',workshopAnswers({name:'',topics}),{json:false}),{ip:'198.51.100.25'});
  assert.equal(r.status,422);assert.deepEqual(checked(await r.text()),topics);
 }
 const r=await handle(post('/api/forms/workshop-request/submit?topic=housing',workshopAnswers({_version:'0',name:'',topics:['stress_self_care']}),{json:false}),{ip:'198.51.100.26'});
 assert.equal(r.status,422);assert.deepEqual(checked(await r.text()),['stress_self_care']);
});
