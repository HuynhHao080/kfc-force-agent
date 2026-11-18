/* eslint-disable @typescript-eslint/no-require-imports -- Standalone offline evaluation; no inference. */
require('./offline-network-guard.cjs');
require('./register-typescript.cjs');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { z } = require('zod');
const { nluResultSchema, nluContextSchema } = require('../src/lib/validation/nlu.ts');
const { parseNluOutput } = require('../src/lib/agent/nlu/adapter.ts');
const root = path.resolve(__dirname,'..');
const nonempty = z.string().trim().min(1);
const caseSchema = z.strictObject({
  id:nonempty,utterance:nonempty,context:nluContextSchema,expected:nluResultSchema,
  split:z.enum(['train','dev','test']),groupId:nonempty,dialogueId:nonempty.nullable(),turnIndex:z.number().int().positive(),previousTurnIds:z.array(nonempty),
  languageTags:z.array(z.enum(['natural','teencode','abbreviation','unaccented','typo','negation','budget','party_size','delta','absolute','multi_intent','multi_turn','clarification','unsupported','exclusion','volume'])).min(1),
  rationale:nonempty,annotation:z.strictObject({source:z.literal('synthetic_authored'),author:nonempty,reviewStatus:z.literal('pending_human_review'),version:nonempty}),
});
const normalize = value => value.normalize('NFKC').toLowerCase().replace(/[\p{P}\p{Z}\s]+/gu,' ').trim();
function auditDataset(cases,promptExamples){
  const errors=[];if(!Array.isArray(cases)||!Array.isArray(promptExamples))return ['Dataset and prompt examples must be arrays'];
  const ids=new Map(),groups=new Map(),dialogues=new Map(),texts=new Map(),validCases=[];
  for(const row of cases){
    const check=caseSchema.safeParse(row);if(!check.success){errors.push(`${row?.id??'?'}: invalid record: ${check.error.message}`);continue;}
    validCases.push(row);if(ids.has(row.id))errors.push(`Duplicate case ID ${row.id}`);ids.set(row.id,row);
    for(const [map,key] of [[groups,row.groupId],[texts,normalize(row.utterance)],...(row.dialogueId?[[dialogues,row.dialogueId]]:[])]){
      if(map.has(key)&&map.get(key)!==row.split)errors.push(`Split leakage: ${key}`);map.set(key,row.split);
    }
    const gold=parseNluOutput(JSON.stringify(row.expected),row.context);if(!gold.ok)errors.push(`${row.id}: golden annotation rejected: ${gold.error.issues.join('; ')}`);
  }
  const turnKeys=new Set();
  for(const row of cases){
    if(!caseSchema.safeParse(row).success)continue;
    const key=`${row.dialogueId??row.id}:${row.turnIndex}`;if(turnKeys.has(key))errors.push(`Duplicate dialogue turn ${key}`);turnKeys.add(key);
    if(!row.dialogueId&&(row.turnIndex!==1||row.previousTurnIds.length))errors.push(`Invalid standalone turn ${row.id}`);
    const earlier=cases.filter(c=>row.dialogueId&&c.dialogueId===row.dialogueId&&c.turnIndex<row.turnIndex).sort((a,b)=>a.turnIndex-b.turnIndex).map(c=>c.id);
    if(row.dialogueId&&(earlier.length!==row.turnIndex-1||JSON.stringify(earlier)!==JSON.stringify(row.previousTurnIds)))errors.push(`Broken dialogue history ${row.id}`);
  }
  for(const ex of promptExamples){
    if(!ex||typeof ex.utterance!=='string'||typeof ex.groupId!=='string'||typeof ex.caseId!=='string'){errors.push('Invalid prompt example');continue;}
    const own=ids.get(ex.caseId);if(!own||own.split!=='train'||own.utterance!==ex.utterance||own.groupId!==ex.groupId)errors.push(`Prompt example is not a matching train record: ${ex.caseId}`);
    if(validCases.some(c=>c.split!=='train'&&(c.groupId===ex.groupId||normalize(c.utterance)===normalize(ex.utterance))))errors.push(`Prompt leakage: ${ex.caseId}`);
  }
  return [...new Set(errors)].sort();
}
const stable = value => {
  if(Array.isArray(value))return `[${value.map(stable).join(',')}]`;
  if(value&&typeof value==='object')return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
};
const sorted = values => values.map(stable).sort();
const same = (a,b) => stable(a)===stable(b);
function semantic(value){
  if(!value||value.status==='error')return {status:value?.status??'invalid',intents:[],entities:[],quantities:[],negations:[],constraints:[],clarification:null,groups:[]};
  const byId=new Map(value.entities.map(e=>[e.id,e]));
  const entity = (e) => {
    if(!e)return null;
    const result={};for(const [k,v] of Object.entries(e)){
      if(k==='id'||k==='text')continue;
      result[k]=k==='targetId'?(v===null?null:entity(byId.get(v))):v;
    }return result;
  };
  const intent = i => {
    const result={kind:i.kind,polarity:i.polarity};
    if('targetId'in i)result.target=entity(byId.get(i.targetId));
    if('targetIds'in i)result.targets=sorted(i.targetIds.map(ref=>entity(byId.get(ref))));
    if('quantityId'in i)result.quantity=entity(byId.get(i.quantityId));
    return result;
  };
  return {
    status:value.status,intents:sorted(value.intents.map(intent)),entities:sorted(value.entities.map(entity)),
    intentLabels:sorted(value.intents.map(i=>({kind:i.kind,polarity:i.polarity}))),
    quantities:sorted(value.intents.filter(i=>'quantityId'in i).map(intent)),
    negations:sorted([...value.intents.map(i=>({kind:i.kind,polarity:i.polarity,...('targetId'in i?{target:entity(byId.get(i.targetId))}:{})})),...value.entities.filter(e=>e.kind==='preference'&&e.operator==='neq').map(entity)]),
    constraints:sorted(value.entities.filter(e=>['budget','party_size','preference'].includes(e.kind)).map(entity)),
    groups:sorted((value.constraintGroups??[]).map(g=>({operator:g.operator,entities:sorted(g.entityIds.map(ref=>entity(byId.get(ref))))}))),
    clarification:{status:value.status,missingSlots:value.status==='needs_clarification'?[...value.missingSlots].sort():[]},
  };
}
function scorePairs(pairs){
  let tp=0,fp=0,fn=0,intent=0,quantity=0,negation=0,constraints=0,clarification=0,exact=0;
  for(const {gold,pred} of pairs){
    const g=semantic(gold),p=semantic(pred);const valid=pred!==null&&pred!==undefined;
    intent+=valid&&same(g.intentLabels,p.intentLabels)?1:0;
    quantity+=valid&&same(g.quantities,p.quantities)?1:0;negation+=valid&&same(g.negations,p.negations)?1:0;
    constraints+=valid&&same([g.constraints,g.groups],[p.constraints,p.groups])?1:0;
    clarification+=valid&&same(g.clarification,p.clarification)?1:0;
    exact+=valid&&same(g,p)?1:0;
    const remaining=[...p.entities];for(const e of g.entities){const index=remaining.indexOf(e);if(index<0)fn++;else{tp++;remaining.splice(index,1);}}fp+=remaining.length;
  }
  const n=pairs.length,precision=tp+fp?tp/(tp+fp):0,recall=tp+fn?tp/(tp+fn):0;
  return {total:n,intentAccuracy:n?intent/n:0,semanticExactAccuracy:n?exact/n:0,entity:{tp,fp,fn,precision,recall,f1:precision+recall?2*precision*recall/(precision+recall):0},quantityAccuracy:n?quantity/n:0,negationAccuracy:n?negation/n:0,constraintAccuracy:n?constraints/n:0,clarificationAccuracy:n?clarification/n:0};
}
function evaluate(cases,outputs,promptExamples=[]){
  const datasetErrors=auditDataset(cases,promptExamples);
  if(datasetErrors.length)return {evaluationType:'mock_contract_evaluation',realLlmEvaluated:false,datasetErrors,results:[],metrics:scorePairs([]),byLanguage:{},bySplit:{}};
  const results=cases.map(c=>{
    const parsed=parseNluOutput(outputs[c.id],c.context);const pred=parsed.ok?parsed.value:null;
    const match=scorePairs([{gold:c.expected,pred}]).semanticExactAccuracy===1;
    let schemaValid=false;try{schemaValid=nluResultSchema.safeParse(JSON.parse(outputs[c.id])).success;}catch{/* Recorded as a parse failure below. */}
    return {id:c.id,split:c.split,dialogueId:c.dialogueId,turnIndex:c.turnIndex,languageTags:c.languageTags,gold:c.expected,pred,schemaValid,issues:parsed.ok?[]:parsed.error.issues,outcome:parsed.ok?(match?'match':'semantic_mismatch'):parsed.error.kind};
  });
  const byLanguage={};for(const tag of [...new Set(cases.flatMap(c=>c.languageTags))].sort())byLanguage[tag]=scorePairs(results.filter(r=>r.languageTags.includes(tag)));
  const bySplit={};for(const split of ['train','dev','test'])bySplit[split]=scorePairs(results.filter(r=>r.split===split));
  const outputErrors=Object.keys(outputs).filter(id=>!cases.some(c=>c.id===id)).map(id=>`Unknown output case ${id}`);
  const relevant={};
  for(const [name,select] of Object.entries({quantity:r=>semantic(r.gold).quantities.length>0,negation:r=>r.languageTags.includes('negation')||r.languageTags.includes('exclusion'),constraints:r=>semantic(r.gold).constraints.length>0,clarification:r=>r.gold.status==='needs_clarification'}))relevant[name]=scorePairs(results.filter(select));
  const dialogueIds=[...new Set(cases.map(c=>c.dialogueId).filter(Boolean))];
  const dialogues={total:dialogueIds.length,annotationExact:dialogueIds.filter(id=>results.filter(r=>r.dialogueId===id).every(r=>r.outcome==='match')).length};
  return {evaluationType:'mock_contract_evaluation',realLlmEvaluated:false,limitations:['Authored synthetic annotations awaiting human review.','Fixtures are authored model outputs, not inference or generalization evidence.','Entity metrics compare normalized values, not character-span F1.','Split leakage checks cover declared groups and normalized exact text; semantic near-duplicates require human review.','Dialogue annotation exactness is not executed cart state accuracy.'],datasetErrors:outputErrors,schemaValid:results.filter(r=>r.schemaValid).length,metrics:scorePairs(results),relevant,dialogues,byLanguage,bySplit,results};
}
function loadPilot(){
 const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
 return {cases:read('tests/data/nlu/pilot.vi.json'),outputs:read('tests/fixtures/nlu/model-outputs.json'),promptExamples:read('tests/data/nlu/prompt-examples.json')};
}
module.exports={auditDataset,scorePairs,evaluate,loadPilot};
if(require.main===module){
  try{
    const args=process.argv.slice(2);if(args.length&&!(args.length===2&&args[0]==='--report'))throw Error('Usage: node scripts/evaluate-nlu.cjs [--report output/nlu-report.json]');
    const {cases,outputs,promptExamples}=loadPilot();const report=evaluate(cases,outputs,promptExamples);
    report.artifactHashes=Object.fromEntries(['tests/data/nlu/pilot.vi.json','tests/data/nlu/prompt-examples.json','tests/fixtures/nlu/model-outputs.json','src/lib/agent/nlu/adapter.ts','src/lib/validation/nlu.ts','scripts/evaluate-nlu.cjs'].map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]));
    if(args.length){const target=path.resolve(root,args[1]);const allowed=path.join(root,'output');if(!target.startsWith(allowed+path.sep))throw Error('Report destination must stay inside output/');fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(report,null,2)+'\n');}
    console.log(JSON.stringify(report,null,2));
    if(report.datasetErrors.length||report.results.some(r=>r.outcome!=='match'))process.exitCode=1;
  }catch(error){console.error(error.message);process.exitCode=1;}
}
