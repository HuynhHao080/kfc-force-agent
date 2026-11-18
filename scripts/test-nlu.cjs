/* eslint-disable @typescript-eslint/no-require-imports -- Offline acceptance runner. */
require('./offline-network-guard.cjs');
require('./register-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { parseNluOutput } = require('../src/lib/agent/nlu/adapter.ts');
const { nluResultSchema } = require('../src/lib/validation/nlu.ts');
const { evaluate, auditDataset, scorePairs, loadPilot } = require('./evaluate-nlu.cjs');
const context = { classification:'seed_demo', menuVersion:'test-v1', storeId:'demo-a', channel:'pickup', products:[{id:'demo-pepsi',name:'Pepsi',options:[{id:'size',values:['small','large']}]}],cart:{revision:'r1',lines:[{id:'line1',productId:'demo-pepsi',quantity:3,optionValueIds:[]}]},references:[{id:'last-item',productId:'demo-pepsi'}] };
const product = {id:'p',kind:'product',text:'Pepsi',productId:'demo-pepsi'};
const quantity = {id:'q',kind:'quantity',text:'hai',mode:'delta',value:2};
const add = () => ({status:'understood',intents:[{id:'i',kind:'add_item',polarity:'affirmed',targetId:'p',quantityId:'q'}],entities:structuredClone([product,quantity])});
const parse = (value, ctx=context) => parseNluOutput(JSON.stringify(value),ctx);
const pilot = () => loadPilot();

test('01 strict JSON, unknown fields, discriminators and invalid quantities fail closed',()=>{
  assert.equal(parseNluOutput('{',context).error.kind,'parse_error');
  for(const value of [{...add(),tool:{operation:'clear'}},{...add(),finalQuantity:5},{...add(),status:'guess'}, {...add(),entities:[product,{...quantity,value:1.5}]}]) assert.equal(parse(value).ok,false);
});
test('02 scoped action negation differs from excluded preference',()=>{
 const {cases,outputs}=pilot(); const ids=['N2-NEG-01','N2-PREF-01'];
 const results=ids.map(id=>parseNluOutput(outputs[id],cases.find(c=>c.id===id).context).value);
 assert.equal(results[0].intents[0].polarity,'negated');
 assert.equal(results[1].entities.find(e=>e.kind==='preference').operator,'neq');
});
test('03 delta and absolute remain operations; model cannot supply final quantity',()=>{
 assert.equal(parse(add()).value.entities[1].mode,'delta');
 const set=add();set.intents[0].kind='set_quantity';set.entities[1]={...quantity,mode:'absolute',value:2};assert.equal(parse(set).ok,true);
 assert.equal(parse({...set,finalQuantity:2}).ok,false);
 assert.equal(parse({...add(),intents:[{...add().intents[0],kind:'set_quantity'}]}).ok,false);
});
test('04 volume preserved separately from count',()=>{
 const v=add();v.entities.push({id:'v',kind:'volume',text:'1.5L',value:1500,unit:'ml',targetId:'p'});
 assert.equal(parse(v).value.entities.find(e=>e.kind==='quantity').value,2);
});
test('05 budgets, party size and multiple constraints survive',()=>{
 const {cases,outputs}=pilot();const c=cases.find(c=>c.id==='N2-CON-01');const r=parseNluOutput(outputs[c.id],c.context);
 assert.equal(r.ok,true);assert.equal(r.value.entities.filter(e=>['budget','party_size','preference'].includes(e.kind)).length,4);
});
test('06 ambiguous teencode requires explicit missing slots',()=>{
 const v={status:'needs_clarification',intents:[],entities:[],missingSlots:['meaning'],reason:'Ambiguous shorthand'};
 assert.equal(parse(v).value.status,'needs_clarification');assert.equal(parse({...v,missingSlots:[]}).ok,false);
});
test('07 multi-turn references validate; unresolved reference is retained',()=>{
 const v=add();v.entities[0]={id:'p',kind:'reference',text:'món đó',referentId:'last-item'};assert.equal(parse(v).ok,true);
 v.entities[0].referentId=null;v.status='needs_clarification';v.missingSlots=['reference'];v.reason='No antecedent';assert.equal(parse(v).value.entities[0].referentId,null);
});
test('08 corrected turn is validated against supplied context without changing it',()=>{
 const before=JSON.stringify(context);const v=add();v.entities[1].value=4;const r=parse(v);
 assert.equal(r.value.entities[1].value,4);assert.equal(JSON.stringify(context),before);
});
test('09 multi-intent arrays preserve every operation and require unique IDs',()=>{
 const v=add();v.intents.push({id:'j',kind:'view_cart',polarity:'affirmed'});assert.equal(parse(v).value.intents.length,2);
 v.intents[1].id='i';assert.equal(parse(v).ok,false);
});
test('10 untrusted IDs/options/prices and wrong scopes cannot pass',()=>{
 for(const mutate of [v=>v.entities[0].productId='invented',v=>v.entities.push({id:'o',kind:'option',text:'size',targetId:'p',optionId:'invented',valueId:'large'}),v=>v.entities[0].price=25000]){const v=add();mutate(v);assert.equal(parse(v).ok,false);}
 const v=add();v.entities.push({id:'o',kind:'option',text:'large',targetId:'p',optionId:'size',valueId:'large'});assert.equal(parse(v).ok,true);
 assert.equal(parse(v,{...context,storeId:42}).ok,false);
});
test('11 assent has no execution or authorization surface',()=>{
 const v={status:'understood',intents:[{id:'i',kind:'express_assent',polarity:'affirmed'}],entities:[]};assert.equal(parse(v).ok,true);
 assert.equal(parse({...v,confirmed:true}).ok,false);
});
test('12 fixture adapter consumes output, never matches utterances',()=>{
 assert.equal(parseNluOutput('Pepsi',context).ok,false);
 assert.deepEqual(parse(add()),parse(add()));
});
test('13 no runtime imports, network, menu upgrades or side effects',()=>{
 const files=['src/lib/agent/nlu/adapter.ts','src/lib/validation/nlu.ts','src/lib/types/nlu.ts'];
 for(const file of files)assert.doesNotMatch(fs.readFileSync(file,'utf8'),/fetch\(|writeFile|agent-core|ToolRegistry|@aws-sdk|kfc_verified/);
 assert.equal(parse(add(),{...context,classification:'kfc_verified'}).ok,false);
});
test('14 metrics match golden confusion counts and leakage is detected',()=>{
 const a=add(),b=add();b.entities[1].value=3;
 const scores=scorePairs([{gold:a,pred:a},{gold:a,pred:b},{gold:a,pred:null}]);
 assert.equal(scores.intentAccuracy,2/3);assert.equal(scores.entity.tp,3);assert.equal(scores.entity.fp,1);assert.equal(scores.entity.fn,3);
 assert.equal(scores.entity.precision,3/4);assert.equal(scores.entity.recall,1/2);assert.equal(scores.entity.f1,0.6);
 const {cases,promptExamples}=pilot();const dup=structuredClone(cases[0]);dup.id='duplicate';dup.split=cases[0].split==='test'?'train':'test';
 assert.ok(auditDataset([...cases,dup],promptExamples).some(e=>e.includes('leakage')));
});
test('15 existing menu and acquisition regression remain separate required gates',()=>{
 for(const p of ['scripts/test-menu-foundation.cjs','scripts/test-menu-acquisition.cjs','scripts/test-chat.cjs'])assert.ok(fs.existsSync(p));
});
test('16 heldout text and paraphrase groups never overlap prompt examples',()=>{
 const {cases,promptExamples}=pilot();assert.deepEqual(auditDataset(cases,promptExamples),[]);
 const c=cases.find(c=>c.split==='test');assert.ok(auditDataset(cases,[{caseId:c.id,groupId:c.groupId,utterance:c.utterance}]).length);
});
test('17 syntactically valid wrong semantics counts as mismatch',()=>{
 const {cases,outputs,promptExamples}=pilot();const changed=structuredClone(outputs);const c=cases.find(c=>c.id==='N2-ADD-01');const p=JSON.parse(changed[c.id]);p.entities.find(e=>e.kind==='quantity').value=9;changed[c.id]=JSON.stringify(p);
 const report=evaluate(cases,changed,promptExamples);assert.equal(report.results.find(r=>r.id===c.id).outcome,'semantic_mismatch');assert.ok(report.metrics.quantityAccuracy<1);
});
test('18 report is explicitly mock contract evaluation with no real model accuracy claim',()=>{
 const {cases,outputs,promptExamples}=pilot();const report=evaluate(cases,outputs,promptExamples);
 assert.equal(report.evaluationType,'mock_contract_evaluation');assert.equal(report.realLlmEvaluated,false);assert.ok(Object.keys(report.byLanguage).length>=8);
});
test('19 silently dropped second intent is penalized',()=>{
 const a=add();a.intents.push({id:'j',kind:'view_cart',polarity:'affirmed'});const b=add();assert.equal(scorePairs([{gold:a,pred:b}]).intentAccuracy,0);
});
test('20 dataset requires rationale and split/group/annotation provenance',()=>{
 const {cases,promptExamples}=pilot();assert.ok(cases.length>=80);assert.ok(new Set(cases.filter(c=>c.dialogueId).map(c=>c.dialogueId)).size>=20);
 const bad=structuredClone(cases);delete bad[0].rationale;assert.ok(auditDataset(bad,promptExamples).length);
 for(const c of cases)assert.equal(nluResultSchema.safeParse(c.expected).success,true,c.id);
});
test('21 malformed, schema-invalid and valid-but-wrong predictions are separate errors',()=>{
 const {cases,outputs,promptExamples}=pilot();const ids=cases.slice(0,3).map(c=>c.id);const changed={...outputs};changed[ids[0]]='{';changed[ids[1]]=JSON.stringify({...cases[1].expected,tool:'clear'});const wrong=JSON.parse(changed[ids[2]]);wrong.entities.find(e=>e.kind==='quantity').value=8;changed[ids[2]]=JSON.stringify(wrong);
 const r=evaluate(cases,changed,promptExamples);assert.deepEqual(ids.map(id=>r.results.find(row=>row.id===id).outcome),['parse_error','validation_error','semantic_mismatch']);
});
test('22 product questions need a target and dangling links cannot be understood',()=>{
 assert.equal(parse({status:'understood',intents:[{id:'i',kind:'ask_price',polarity:'affirmed',targetIds:[]}],entities:[]}).ok,false);
 const v=add();v.intents[0].targetId='missing';assert.equal(parse(v).ok,false);
});
test('23 options cannot cross product ownership and references cannot cross context',()=>{
 const v=add();v.entities.push({id:'o',kind:'option',text:'large',targetId:'p',optionId:'size',valueId:'large'});
 const other={...context,products:[{id:'demo-pepsi',name:'Pepsi',options:[]},{id:'other',name:'Other',options:[{id:'size',values:['large']}]}]};assert.equal(parse(v,other).ok,false);
 const r=add();r.entities[0]={id:'p',kind:'reference',text:'đó',referentId:'another-store-ref'};assert.equal(parse(r).ok,false);
});
test('24 local ID renaming, field/array order and reason wording do not change semantics',()=>{
 const a=add(),b=add();b.entities[0].id='renamed';b.intents[0].targetId='renamed';b.entities.reverse();assert.equal(scorePairs([{gold:a,pred:b}]).semanticExactAccuracy,1);
});
test('25 scoped exclusions, logical groups and absolute mode errors are counted',()=>{
 const a=add();a.entities.push({id:'f',kind:'preference',text:'không cay',targetId:'p',attribute:'spice',operator:'neq',value:'hot'});a.constraintGroups=[{operator:'all',entityIds:['f']}];const b=structuredClone(a);b.entities[2].operator='eq';b.constraintGroups[0].operator='any';const r=scorePairs([{gold:a,pred:b}]);assert.equal(r.negationAccuracy,0);assert.equal(r.constraintAccuracy,0);
});
test('26 missing/extra outputs and invalid dialogue histories are rejected',()=>{
 const {cases,outputs,promptExamples}=pilot();const missing={...outputs};delete missing[cases[0].id];assert.equal(evaluate(cases,missing,promptExamples).results[0].outcome,'parse_error');
 assert.ok(evaluate(cases,{...outputs,extra:'{}'},promptExamples).datasetErrors.length);
 const bad=structuredClone(cases);bad.find(c=>c.turnIndex===2).previousTurnIds=[];assert.ok(auditDataset(bad,promptExamples).some(e=>e.includes('history')));
});
test('27 result output is byte bounded and fallback has no semantic operation',()=>{
 const r=parseNluOutput(' '.repeat(65537),context);assert.equal(r.error.kind,'parse_error');assert.equal(r.fallback.status,'error');assert.equal('intents'in r.fallback,false);
});
test('28 entity metrics handle duplicates and empty denominators',()=>{
 const a=add(),b=add();b.entities.push({...quantity,id:'q2'});const r=scorePairs([{gold:a,pred:b}]);assert.equal(r.entity.tp,2);assert.equal(r.entity.fp,1);assert.equal(r.entity.fn,0);assert.equal(r.entity.f1,0.8);
 assert.deepEqual(scorePairs([]).entity,{tp:0,fp:0,fn:0,precision:0,recall:0,f1:0});
});
