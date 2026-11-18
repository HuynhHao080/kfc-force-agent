/* eslint-disable @typescript-eslint/no-require-imports -- Offline readiness harness; live mode is not implemented. */
require('./offline-network-guard.cjs');require('./register-typescript.cjs');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {z}=require('zod');
const {auditDataset,scorePairs}=require('./evaluate-nlu.cjs');
const {buildNluEvaluationRequest,parseNluServiceResponse}=require('../src/lib/agent/nlu/evaluation-request.ts');
const {nluResultSchema}=require('../src/lib/validation/nlu.ts');
const stable=value=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const hash=value=>crypto.createHash('sha256').update(stable(value)).digest('hex');
const DEFAULT_LIMITS=Object.freeze({mode:'dry_run',split:'dev',reviewPolicy:'unreviewed_dry_run',maxCases:20,maxCalls:20,maxInputBytes:32768,maxOutputTokens:1500,maxReservedTokens:1000000,concurrency:1,retry:0});
const root=path.resolve(__dirname,'..');
const sourceHash=()=>hash(['scripts/nlu-evaluation-harness.cjs','scripts/evaluate-nlu.cjs','src/lib/agent/nlu/evaluation-request.ts','src/lib/agent/nlu/adapter.ts','src/lib/validation/nlu.ts'].map(file=>[file,fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n')]));
const planHash=p=>hash({limits:p.limits,datasetHash:p.datasetHash,reviewHash:p.reviewHash,schemaHash:p.schemaHash,sourceHash:p.sourceHash,requests:p.requests,caseHashes:p.cases.map(hash)});
const limitsSchema=z.strictObject({mode:z.literal('dry_run'),split:z.enum(['train','dev','test']),reviewPolicy:z.enum(['unreviewed_dry_run','approved_only']),maxCases:z.number().int().min(1).max(140),maxCalls:z.number().int().min(1).max(140),maxInputBytes:z.number().int().min(1).max(65536),maxOutputTokens:z.number().int().min(1).max(2048),maxReservedTokens:z.number().int().positive().max(10000000),concurrency:z.literal(1),retry:z.literal(0),caseIds:z.array(z.string()).min(1).max(140).optional()});
const reviewSchema=z.strictObject({datasetHash:z.string().length(64),records:z.array(z.strictObject({caseId:z.string(),caseHash:z.string().length(64),status:z.enum(['pending','approved','needs_revision','excluded']),reviewer:z.string().min(1).nullable(),reviewedAt:z.iso.datetime().nullable(),note:z.string().min(1).nullable()}))});
function createReviewManifest(cases){return {datasetHash:hash(cases),records:cases.map(c=>({caseId:c.id,caseHash:hash(c),status:'pending',reviewer:null,reviewedAt:null,note:null}))};}
function auditPilot(cases,promptExamples){
 const structuralErrors=auditDataset(cases,promptExamples);const reviewFindings=[];
 for(const c of cases){
  const add=(code,detail)=>reviewFindings.push({caseId:c.id,code,detail});
  if(c.groupId==='single-holdcomp')add('taxonomy_ambiguity','Burger product is labelled ask_combo_contents. Review product-components versus combo intent.');
  if(c.groupId==='single-holdunknown')add('absence_vs_ambiguity','Missing menu product need not imply ambiguous language; review search/no-match versus clarification.');
  if(c.groupId==='dialogue-family-budget'&&c.turnIndex===1)add('clarification_policy','Generic recommendation is marked needs_clarification/meaning; compare understood recommendation records.');
  if(c.dialogueId)add('dialogue_target','Confirm per-turn intent versus accumulated request state and missing assistant clarification history.');
  if(c.expected.entities?.some(e=>e.kind==='budget'))add('budget_operator','N2 encodes amount/scope but not strict < versus <=; avoid penalizing this unrepresentable distinction.');
  if(c.groupId==='single-refmiss'||c.groupId==='dialogue-family-recovery')add('referent_policy','Context contains last-item even for unavailable historical references; reviewer must specify permitted antecedents.');
 }
 return {total:cases.length,pendingHumanReview:cases.filter(c=>c.annotation.reviewStatus==='pending_human_review').length,splitCounts:Object.fromEntries(['train','dev','test'].map(s=>[s,cases.filter(c=>c.split===s).length])),structuralErrors,reviewFindings,annotationApprovedByThisAudit:false};
}
function preparePlan(cases,promptExamples,options,review){
 const limits=limitsSchema.parse(options);const errors=auditDataset(cases,promptExamples);if(errors.length)throw Error(errors.join('\n'));
 const approved=reviewSchema.parse(review);if(approved.datasetHash!==hash(cases)||approved.records.length!==cases.length||new Set(approved.records.map(r=>r.caseId)).size!==cases.length)throw Error('Review dataset hash/inventory mismatch');
 const reviewById=new Map(approved.records.map(r=>[r.caseId,r]));
 for(const c of cases){const r=reviewById.get(c.id);if(!r||r.caseHash!==hash(c))throw Error('Review case hash mismatch');if(r.status==='approved'&&(!r.reviewer||!r.reviewedAt||!r.note))throw Error('Approved review requires human reviewer, timestamp and note');}
 const selectedIds=limits.caseIds;if(selectedIds&&(new Set(selectedIds).size!==selectedIds.length||selectedIds.some(id=>!cases.some(c=>c.id===id&&c.split===limits.split))))throw Error('Invalid case selection or split');
 let selected=cases.filter(c=>c.split===limits.split&&(!selectedIds||selectedIds.includes(c.id))&&(limits.reviewPolicy!=='approved_only'||reviewById.get(c.id).status==='approved'));
 selected.sort((a,b)=>(a.dialogueId??a.id).localeCompare(b.dialogueId??b.id)||a.turnIndex-b.turnIndex);
 if(selectedIds&&selected.length!==selectedIds.length)throw Error('Selected records are not approved');
 selected=selected.slice(0,limits.maxCases);if(!selected.length)throw Error('No approved/evaluable records');
 const requests=selected.map(c=>{
  const prior=c.previousTurnIds.map(id=>cases.find(r=>r.id===id));if(prior.some(r=>!r))throw Error('Missing history');
  if(limits.reviewPolicy==='approved_only'&&prior.some(r=>reviewById.get(r.id).status!=='approved'))throw Error('History also requires approval');
  const request=buildNluEvaluationRequest(c,prior,limits.maxOutputTokens);
  const inputBytes=Buffer.byteLength(request.systemPrompt)+Buffer.byteLength(request.userPrompt);
  if(inputBytes>limits.maxInputBytes)throw Error('Input byte budget exceeded');
  // Deliberately conservative planning proxy, NOT a provider tokenizer or invoice guarantee.
  const reservedTokens=inputBytes+1024+limits.maxOutputTokens;
  return {caseId:c.id,request,requestHash:hash(request),reservedTokens};
 });
 if(requests.length>limits.maxCalls||requests.reduce((n,r)=>n+r.reservedTokens,0)>limits.maxReservedTokens)throw Error('Call/token budget exceeded');
 const schemaHash=hash(z.toJSONSchema(nluResultSchema,{reused:'ref'}));
 const plan={limits,datasetHash:hash(cases),reviewHash:hash(approved),schemaHash,sourceHash:sourceHash(),requests,cases:selected};
 return {...plan,fingerprint:planHash(plan)};
}
const eventSchema=z.discriminatedUnion('state',[
 z.strictObject({state:z.literal('started'),caseId:z.string(),requestHash:z.string().length(64),reservedTokens:z.number().int().positive()}),
 z.strictObject({state:z.literal('completed'),caseId:z.string(),requestHash:z.string().length(64),outcome:z.enum(['match','semantic_mismatch','parse_error','validation_error','context_error','provider_error','budget_exceeded']),prediction:nluResultSchema.nullable(),rawOutput:z.string().max(65536).nullable(),issues:z.array(z.string()),latencyMs:z.number().finite().nonnegative(),usage:z.object({inputTokens:z.number().int().nonnegative().optional(),outputTokens:z.number().int().nonnegative().optional()}).strict().nullable()}),
]);
function assertPlan(plan){
 limitsSchema.parse(plan.limits);
 if(plan.fingerprint!==planHash(plan)||plan.sourceHash!==sourceHash())throw Error('Plan fingerprint changed');
 if(plan.requests.length>Math.min(plan.limits.maxCases,plan.limits.maxCalls)||new Set(plan.requests.map(r=>r.caseId)).size!==plan.requests.length)throw Error('Plan call budget exceeded');
 let tokens=0;for(const r of plan.requests){const bytes=Buffer.byteLength(r.request.systemPrompt)+Buffer.byteLength(r.request.userPrompt);if(r.requestHash!==hash(r.request)||r.request.maxTokens!==plan.limits.maxOutputTokens||bytes>plan.limits.maxInputBytes||r.reservedTokens!==bytes+1024+plan.limits.maxOutputTokens)throw Error('Plan request/token budget changed');tokens+=r.reservedTokens;}
 if(tokens>plan.limits.maxReservedTokens)throw Error('Plan token budget exceeded');
}
function replayJournal(plan,events){
 assertPlan(plan);
 const starts=new Map(),completed=new Map();
 for(const event of events){
  if(!eventSchema.safeParse(event).success)throw Error('Invalid journal event');
  const request=plan.requests.find(r=>r.caseId===event.caseId);if(!request)throw Error('Journal unknown case');
  if(event.state==='started'){
   if(starts.has(event.caseId)||event.requestHash!==request.requestHash||event.reservedTokens!==request.reservedTokens)throw Error('Duplicate/changed journal attempt');starts.set(event.caseId,event);
  }else if(event.state==='completed'){
   if(!starts.has(event.caseId)||completed.has(event.caseId)||event.requestHash!==request.requestHash)throw Error('Orphan/duplicate journal completion');completed.set(event.caseId,event);
   const semantic=['match','semantic_mismatch'].includes(event.outcome);if(semantic!==Boolean(event.prediction))throw Error('Invalid journal prediction');
   if(semantic){const gold=plan.cases.find(c=>c.id===event.caseId).expected;const correct=scorePairs([{gold,pred:event.prediction}]).semanticExactAccuracy===1;if(correct!==(event.outcome==='match'))throw Error('Invalid journal score');}
  }else throw Error('Invalid journal state');
 }
 if(starts.size>plan.limits.maxCalls||[...starts.values()].reduce((n,e)=>n+e.reservedTokens,0)>plan.limits.maxReservedTokens)throw Error('Journal budget exceeded');
 return {starts,completed,uncertain:[...starts.keys()].filter(id=>!completed.has(id))};
}
async function runDry(plan,fixtures,events,persist){
 // No provider argument, SDK, credentials or switch that can enable live inference.
 limitsSchema.parse(plan.limits);const prior=replayJournal(plan,events);let newCalls=0;
 const completed=[...prior.completed.values()];
 if(prior.uncertain.length||completed.some(e=>e.outcome==='budget_exceeded'))return {evaluationType:'mock_contract_evaluation',realLlmEvaluated:false,reviewPolicy:plan.limits.reviewPolicy,completed,newCalls:0,uncertain:prior.uncertain,reservedAttempts:prior.starts.size};
 for(const r of plan.requests){
  if(prior.starts.has(r.caseId))continue;
  const started={state:'started',caseId:r.caseId,requestHash:r.requestHash,reservedTokens:r.reservedTokens};await persist(started);newCalls++;
  const began=performance.now();let reply;
  const fixture=fixtures[r.caseId];
  if(typeof fixture==='string')reply={success:true,response:{content:fixture,role:'assistant'}};
  else reply=fixture;
  const parsed=parseNluServiceResponse(reply,plan.cases.find(c=>c.id===r.caseId).context);
  const gold=plan.cases.find(c=>c.id===r.caseId).expected;
  const budgetExceeded=(parsed.usage?.outputTokens??0)>plan.limits.maxOutputTokens||(parsed.usage?.inputTokens??0)>r.reservedTokens-plan.limits.maxOutputTokens;
  const outcome=budgetExceeded?'budget_exceeded':parsed.outcome==='valid'?(scorePairs([{gold,pred:parsed.value}]).semanticExactAccuracy===1?'match':'semantic_mismatch'):parsed.outcome;
  const raw=reply?.success===true&&typeof reply.response?.content==='string'?reply.response.content:null;
  const rawOutput=raw!==null&&Buffer.byteLength(raw)<=65536?raw:null;
  const entry={state:'completed',caseId:r.caseId,requestHash:r.requestHash,outcome,prediction:budgetExceeded?null:parsed.value,rawOutput,issues:budgetExceeded?['Reported token usage exceeded reservation']:parsed.issues,latencyMs:performance.now()-began,usage:parsed.usage};
  await persist(entry);completed.push(entry);
  if(budgetExceeded)break;
 }
 return {evaluationType:'mock_contract_evaluation',realLlmEvaluated:false,reviewPolicy:plan.limits.reviewPolicy,completed,newCalls,uncertain:prior.uncertain,reservedAttempts:prior.starts.size+newCalls};
}
function openCheckpoint(directory,plan,fixtureHash){
 assertPlan(plan);
 fs.mkdirSync(directory,{recursive:true});const lock=path.join(directory,'run.lock');const lockFd=fs.openSync(lock,'wx');let closed=false;
 const close=()=>{if(!closed){closed=true;fs.closeSync(lockFd);fs.unlinkSync(lock);}};
 try{
  const file=path.join(directory,'manifest.json');const manifest={fingerprint:plan.fingerprint,fixtureHash,evaluationType:'mock_contract_evaluation'};
  if(!fs.existsSync(file)&&fs.existsSync(path.join(directory,'events.jsonl')))throw Error('Journal without manifest');
  if(fs.existsSync(file)){if(stable(JSON.parse(fs.readFileSync(file,'utf8')))!==stable(manifest))throw Error('Checkpoint fingerprint mismatch');}
  else{const fd=fs.openSync(file,'wx');try{fs.writeFileSync(fd,JSON.stringify(manifest));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}
  const journal=path.join(directory,'events.jsonl');let events=[];
  if(fs.existsSync(journal)){const text=fs.readFileSync(journal,'utf8');if(text&&!text.endsWith('\n'))throw Error('Truncated journal');try{events=text.trim()?text.trim().split('\n').map(line=>JSON.parse(line)):[];replayJournal(plan,events);}catch{throw Error('Invalid journal');}}
  const append=event=>{const fd=fs.openSync(journal,'a');try{fs.writeFileSync(fd,JSON.stringify(event)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}events.push(event);};
  return {events,append,close};
 }catch(error){close();throw error;}
}
function estimateCost({calls,inputTokensPerCall,outputTokensPerCall,inputUsdPerMillion,outputUsdPerMillion}){
 for(const v of [calls,inputTokensPerCall,outputTokensPerCall,inputUsdPerMillion,outputUsdPerMillion])if(!Number.isFinite(v)||v<0)throw Error('Invalid cost inputs');
 return {usd:calls*(inputTokensPerCall*inputUsdPerMillion+outputTokensPerCall*outputUsdPerMillion)/1000000,currency:'USD',isBillingGuarantee:false};
}
module.exports={DEFAULT_LIMITS,hash,createReviewManifest,auditPilot,preparePlan,runDry,replayJournal,openCheckpoint,estimateCost};
