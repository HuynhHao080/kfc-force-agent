/* eslint-disable @typescript-eslint/no-require-imports -- Reproducible offline review inventory. */
require('./offline-network-guard.cjs');
const fs=require('node:fs'),path=require('node:path');
const {loadPilot}=require('./evaluate-nlu.cjs');
const {auditPilot,hash}=require('./nlu-evaluation-harness.cjs');
const root=path.resolve(__dirname,'..');
const normalized=s=>s.normalize('NFKC').toLowerCase().replace(/[\p{P}\p{Z}\s]+/gu,' ').trim();
function audit(){
 const {cases,promptExamples}=loadPilot();const report=auditPilot(cases,promptExamples);
 const grams=s=>{const v=normalized(s);return new Set(Array.from({length:Math.max(0,v.length-2)},(_,i)=>v.slice(i,i+3)));};
 const pairs=[];for(let i=0;i<cases.length;i++)for(let j=i+1;j<cases.length;j++){
  const a=cases[i],b=cases[j];if(a.split===b.split)continue;
  const ga=grams(a.utterance),gb=grams(b.utterance);const intersection=[...ga].filter(v=>gb.has(v)).length;const similarity=intersection/Math.max(new Set([...ga,...gb]).size,1);
  if(similarity>=0.5)pairs.push({a:a.id,b:b.id,similarity});
 }
 const legacy=['intent-cases.vi.json','language-safety.vi.json'].flatMap(file=>JSON.parse(fs.readFileSync(path.join(root,'tests/data',file),'utf8')).map(c=>({...c,file})));
 return {...report,datasetHash:hash(cases),promptExamples:promptExamples.length,entityEvidencePolicy:'whole utterance; no token-span annotations',duplicateRationaleCount:cases.length-new Set(cases.map(c=>c.rationale)).size,nearDuplicateCandidates:pairs.sort((a,b)=>b.similarity-a.similarity||a.a.localeCompare(b.a)).slice(0,25),nearDuplicateThreshold:0.5,legacyExactOverlap:cases.flatMap(c=>legacy.filter(l=>normalized(l.message)===normalized(c.utterance)).map(l=>({caseId:c.id,legacyId:l.id,file:l.file}))),records:cases.map(c=>({caseId:c.id,split:c.split,groupId:c.groupId,dialogueId:c.dialogueId,reviewStatus:'pending',flags:report.reviewFindings.filter(f=>f.caseId===c.id).map(f=>f.code)}))};
}
module.exports={audit};
if(require.main===module){const report=audit();const directory=path.join(root,'output');fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(path.join(directory,'nlu-readiness-review.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({total:report.total,pendingHumanReview:report.pendingHumanReview,structuralErrors:report.structuralErrors,reviewFindings:report.reviewFindings.length,nearDuplicateCandidates:report.nearDuplicateCandidates.length,legacyExactOverlap:report.legacyExactOverlap.length,report:'output/nlu-readiness-review.json'},null,2));if(report.structuralErrors.length)process.exitCode=1;}
