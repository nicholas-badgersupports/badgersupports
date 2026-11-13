import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { freshServer, post } from './helpers.mjs';
import { handle } from '../netlify/lib/router.mjs';
import { q, one, many } from '../netlify/lib/db.mjs';
import { currentForm, setSwitch } from '../netlify/lib/intake.mjs';
import { readFormSettings } from '../netlify/lib/form-settings.mjs';
import { saveFormSetup } from '../netlify/lib/form-setup.mjs';
import { formsFor } from '../netlify/lib/answers.mjs';
import { usePurger } from '../netlify/lib/published.mjs';
import { serverContent } from '../netlify/lib/content.mjs';
import { allQuestions } from '../src/shared/forms.mjs';

async function session(scopes) {
  const id=crypto.randomBytes(32).toString('base64url');
  await q("INSERT INTO staff_sessions(id_hash,sub,name,scopes,expires_at) VALUES($1,'fictional-setup','Fictional Setup',$2::jsonb,now()+interval '1 hour')",[crypto.createHash('sha256').update(id).digest('hex'),JSON.stringify(scopes)]);
  return `bss_staff=${id}`;
}
const send=(key,body,cookie)=>handle(post(`/api/staff/forms/${key}/setup`,body,{headers:{cookie}}),{ip:'192.0.2.95'});
const bodyFor=async(key,more={})=>{const f=await currentForm(key);return {settings:{...f.settings},state:'keep',expectedState:f.manualState,formVersion:f.def.version,...more};};

test('every current form is configurable and can open through the atomic setup operation',async()=>{
 await freshServer();const cookie=await session(['site.edit','forms.switch:*']);
 const forms=(await formsFor({scopes:['site.edit','forms.switch:*']})).forms;assert.equal(forms.length,14);
 for(const form of forms){
  assert.ok(form.settings);assert.ok(form.definitionVersion);assert.ok(form.workflow.destination);
  await setSwitch(form.key,'closed','fixture');const body=await bodyFor(form.key,{state:'open',confirm:form.key});
  body.settings.title=`Fictional ${form.key}`;
  const response=await send(form.key,body,cookie);assert.equal(response.status,200,form.key);
  const result=await response.json(),saved=result.forms.find(f=>f.key===form.key);
  assert.equal(saved.manualState,'open',form.key);assert.equal(saved.title,body.settings.title,form.key);
  assert.equal((await readFormSettings(form.key)).version,1);
 }
 assert.equal((await many('SELECT * FROM form_settings_history')).length,14);
 assert.equal((await one('SELECT count(*)::int AS n FROM submissions')).n,0);
});

test('preview reads and keep-availability saves preserve the original alternate and do not insert a switch',async()=>{
 await freshServer();const key='workshop-request',before=await currentForm(key),cookie=await session(['site.edit']);
 await formsFor({scopes:['site.edit']});assert.equal((await many('SELECT * FROM form_settings_history')).length,0);
 const body=await bodyFor(key);body.settings.title='Fictional title';
 assert.equal((await send(key,body,cookie)).status,200);
 assert.equal((await many('SELECT * FROM form_state')).length,0);
 assert.equal((await currentForm(key)).def.elsewhere,before.def.elsewhere);
});

test('setup permissions match full settings and switches; no denied operation partly saves',async()=>{
 await freshServer();const key='staff-application';
 const reader=await session(['forms.read:*']),editor=await session(['site.edit']),switcher=await session([`forms.switch:${key}`]),other=await session(['forms.switch:workshop-request']);
 const base=await bodyFor(key);const open={...base,state:'open',confirm:key};
 assert.equal((await send(key,open,reader)).status,403);
 assert.equal((await send(key,open,editor)).status,403);
 assert.equal((await send(key,open,other)).status,403);
 assert.equal((await send(key,{...base,settings:{...base.settings,title:'Changed'}},switcher)).status,403);
 assert.equal((await one('SELECT count(*)::int AS n FROM form_settings_history')).n,0);
 assert.equal((await send(key,{...open,settings:{...base.settings,opensAt:'2099-01-01T12:00',closesAt:''}},switcher)).status,200,'a later opening clears the shipped close date with it');
 assert.equal((await currentForm(key)).stateReason,'scheduled');
 const now=await bodyFor(key);assert.equal((await send(key,{...now,settings:{...now.settings,title:'Edited words'}},editor)).status,200);
 assert.equal((await currentForm(key)).manualState,'open');
 assert.equal((await currentForm(key)).settings.opensAt,'2099-01-01T12:00');
});

test('invalid, unconfirmed and stale setup requests leave both settings and availability unchanged',async()=>{
 await freshServer();const key='recommendation-letter';await setSwitch(key,'closed','fixture');const cookie=await session(['site.edit','forms.switch:*']);const base=await bodyFor(key,{state:'open',confirm:key});
 for(const body of [{...base,confirm:''},{...base,formVersion:999},{...base,settings:{...base.settings,opensAt:'2027-03-14T02:30'}},{...base,unexpected:true}]){
  const r=await send(key,body,cookie);assert.ok([400,409].includes(r.status));
  assert.equal((await readFormSettings(key)).version,0);assert.equal((await currentForm(key)).manualState,'closed');
 }
 const first=await bodyFor(key);first.settings.title='First edit';assert.equal((await send(key,first,cookie)).status,200);
 assert.equal((await send(key,base,cookie)).status,409);
 assert.equal((await currentForm(key)).manualState,'closed');assert.equal((await readFormSettings(key)).title,'First edit');
 assert.equal((await many('SELECT * FROM form_settings_history')).length,1);
});

test('a switch conflict after the settings write rolls back its version and immutable history',async()=>{
 await freshServer();const key='workshop-request';await setSwitch(key,'closed','fixture');
 const request=await bodyFor(key,{state:'open',confirm:key});request.expectedState='open';request.settings.title='Must roll back';
 await assert.rejects(saveFormSetup(key,request,'fictional'),{code:'settings.conflict'});
 assert.equal((await readFormSettings(key)).version,0);assert.equal((await many('SELECT * FROM form_settings_history')).length,0);
 assert.equal((await currentForm(key)).manualState,'closed');
});

test('a cache failure reports saved setup without undoing it or retrying delivery',async()=>{
 await freshServer();const key='programming-feedback',cookie=await session(['forms.switch:*']);const body=await bodyFor(key,{state:'open',confirm:key});
 usePurger(async()=>{throw Object.assign(new Error('fictional purge failure'),{code:'purge.unavailable'});});
 try{const r=await send(key,body,cookie);assert.equal(r.status,200);assert.equal((await r.json()).purgeError,'purge.unavailable');assert.equal((await currentForm(key)).manualState,'open');assert.equal((await many('SELECT * FROM outbox')).length,0);}finally{usePurger(null);}
});

test('an open resource form can still be closed after its selectable resources disappear',async()=>{
 await freshServer();const key='resource-problem',cookie=await session(['forms.switch:*']);await setSwitch(key,'open','fixture');
 for(const {q:question} of allQuestions(serverContent().forms[key]))if(question.type==='resource')question.resources=[];
 const before=await currentForm(key);assert.equal(before.manualState,'open');assert.equal(before.state,'closed');assert.equal(before.stateReason,'unavailable');
 const close=await bodyFor(key,{state:'closed'});assert.equal((await send(key,close,cookie)).status,200);assert.equal((await currentForm(key)).manualState,'closed');
 const open=await bodyFor(key,{state:'open',confirm:key});const response=await send(key,open,cookie);assert.equal(response.status,409);assert.equal((await response.json()).error,'switch.empty');assert.equal((await currentForm(key)).manualState,'closed');
});
