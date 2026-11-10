import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from '../ops/build.mjs';
import {definitionProblems,allQuestions} from '../src/shared/forms.mjs';
import {freshServer,post} from './helpers.mjs';
import {handle} from '../netlify/lib/router.mjs';
import {q,one} from '../netlify/lib/db.mjs';
import {ingestPayload} from '../netlify/lib/deliver.mjs';
const load=()=>JSON.parse(fs.readFileSync(path.join(ROOT,'content/forms/email-list.json')));
test('shared alumni email request remains email-only required private and receipt-free',()=>{
 const def=load();assert.equal(def.state,'open');assert.deepEqual(allQuestions(def).map(({q})=>q.id),['email']);assert.deepEqual(definitionProblems(def),[]);
 for(const change of [d=>{d.sections[0].questions[0].required=false},d=>{d.sections[0].questions[0].type='short'},d=>{d.sections[0].questions.push({id:'name',type:'short',label:'Name'})},d=>{d.workflow.receipt='on'},d=>{d.anonymous=true}]){const d=load();change(d);assert.ok(definitionProblems(d).some(p=>p.code.startsWith('delivery-')));}
});
test('a personal email is refused while switched off, accepted once open and once per reference without claiming membership',async()=>{
 await freshServer();const send=(email,json=true)=>handle(post('/api/forms/email-list/submit',{_form:'email-list',_version:'1',_key:'email-example-reference',email,name:'Discard Example',support_use:'never store this'},{json}),{ip:'198.51.100.24'});
 await q("INSERT INTO form_state(form_key,state,changed_by) VALUES('email-list','closed','fixture')");
 assert.equal((await send('example@example.org')).status,409);
 await q("UPDATE form_state SET state='open' WHERE form_key='email-list'");
 assert.equal((await send('invalid')).status,422);let r=await send('example@example.org');assert.equal(r.status,200);const a=await r.json();const b=await(await send('example@example.org')).json();assert.equal(a.ref,b.ref);
 const row=await one('SELECT * FROM submissions WHERE ref=$1',[a.ref]);assert.deepEqual(row.answers,{email:'example@example.org'});assert.equal((await one('SELECT count(*)::int AS n FROM submissions')).n,1);
 assert.equal((await one("SELECT count(*)::int AS n FROM outbox WHERE kind='mail.receipt'")).n,0);
 const payload=ingestPayload(row,load());assert.equal(payload.form,'email-list');assert.equal(payload.anonymous,false);assert.deepEqual(payload.columns.map(c=>c.id),['email']);assert.deepEqual(payload.answers,{email:'example@example.org'});
 r=await send('example@example.org',false);const body=await r.text();assert.match(body,/Request Received/);assert.match(body,/does not show whether you are subscribed/);assert.doesNotMatch(body,/You are now subscribed|not on the list yet/);
});
