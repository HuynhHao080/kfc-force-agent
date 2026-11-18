/* eslint-disable @typescript-eslint/no-require-imports -- Offline-only entry point. */
require('./offline-network-guard.cjs');
const fs=require('node:fs'),path=require('node:path');
const {loadPilot,scorePairs}=require('./evaluate-nlu.cjs');
const {DEFAULT_LIMITS,hash,preparePlan,runDry,openCheckpoint}=require('./nlu-evaluation-harness.cjs');

async function main(){
 const args=process.argv.slice(2);const limits={...DEFAULT_LIMITS};let runDir='output/nlu-readiness-dev',planOnly=false;
 for(let i=0;i<args.length;i++){
  const key=args[i];if(key==='--approved-only'){limits.reviewPolicy='approved_only';continue;}
  if(key==='--plan-only'){planOnly=true;continue;}
  if(!['--mode','--split','--max-cases','--run-dir'].includes(key)||i+1>=args.length)throw Error('Usage: node scripts/evaluate-nlu-readiness.cjs [--mode dry_run] [--split train|dev|test] [--max-cases N] [--approved-only] [--run-dir output/name]');
  const value=args[++i];if(key==='--mode')limits.mode=value;else if(key==='--split')limits.split=value;else if(key==='--max-cases')limits.maxCases=Number(value);else runDir=value;
 }
 if(limits.mode!=='dry_run')throw Error('Live inference is not implemented or authorized in N3.1');
 const root=path.resolve(__dirname,'..'),allowed=path.join(root,'output'),directory=path.resolve(root,runDir);
 if(!directory.startsWith(allowed+path.sep))throw Error('Run directory must be inside output/');
 // Refuse links/junctions and hard-linked existing files before any report writes.
 const verify=p=>{if(!fs.existsSync(p))return;const s=fs.lstatSync(p);if(s.isSymbolicLink()||(!s.isDirectory()&&s.nlink>1))throw Error('Linked checkpoint paths are forbidden');};
 let parent=directory;while(parent!==root){verify(parent);parent=path.dirname(parent);}
 for(const name of ['manifest.json','events.jsonl','report.json','run.lock'])verify(path.join(directory,name));
 const {cases,outputs,promptExamples}=loadPilot();
 const review=JSON.parse(fs.readFileSync(path.join(root,'tests/data/nlu/review-manifest.json'),'utf8'));
 const plan=preparePlan(cases,promptExamples,limits,review);
 if(planOnly){console.log(JSON.stringify({mode:'dry_run',liveEnabled:false,planFingerprint:plan.fingerprint,caseIds:plan.requests.map(r=>r.caseId),reservedTokenProxy:plan.requests.reduce((n,r)=>n+r.reservedTokens,0),limits},null,2));return;}
 const checkpoint=openCheckpoint(directory,plan,hash(outputs));
 try{
  const result=await runDry(plan,outputs,checkpoint.events,checkpoint.append);
  const pairs=result.completed.map(r=>({gold:cases.find(c=>c.id===r.caseId).expected,pred:r.prediction}));
  const report={...result,plannedCases:plan.requests.length,planFingerprint:plan.fingerprint,provider:'offline_fixture',latencyScope:'mock response processing, not real inference',usageSource:'mock_fixture_or_unknown',metrics:scorePairs(pairs),byLanguage:{},labelReviewRequired:limits.reviewPolicy!=='approved_only'};
  for(const tag of [...new Set(plan.cases.flatMap(c=>c.languageTags))].sort())report.byLanguage[tag]=scorePairs(result.completed.filter(r=>cases.find(c=>c.id===r.caseId).languageTags.includes(tag)).map(r=>({gold:cases.find(c=>c.id===r.caseId).expected,pred:r.prediction})));
  fs.writeFileSync(path.join(directory,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({evaluationType:report.evaluationType,realLlmEvaluated:false,plannedCases:report.plannedCases,newCalls:report.newCalls,completed:report.completed.length,uncertain:report.uncertain,metrics:report.metrics,report:path.relative(root,path.join(directory,'report.json'))},null,2));
  if(report.uncertain.length||report.completed.some(r=>r.outcome!=='match'))process.exitCode=1;
 }finally{checkpoint.close();}
}
main().catch(()=>{console.error('Readiness run rejected: invalid configuration, review, checkpoint or offline result. No live inference is available.');process.exitCode=1;});
