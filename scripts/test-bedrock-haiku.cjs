/* eslint-disable @typescript-eslint/no-require-imports -- Offline config/trace tests; no live inference. BedrockService guardrails live in test-bedrock-guardrails.cjs. */
require('./offline-network-guard.cjs');
require('./register-typescript.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {BedrockService}=require('../src/lib/aws/bedrock.ts');
const {DEFAULT_HAIKU_MODEL_ID,DEFAULT_BEDROCK_REGION,resolveBedrockConfig,bedrockConfigIssue,getOfflineLlmStatus}=require('../src/lib/aws/bedrock-config.ts');
const expectedId='global.anthropic.claude-haiku-5-5';
const env={AI_PROVIDER:'bedrock',BEDROCK_MODEL_ID:expectedId,AWS_REGION:'ap-southeast-1'};
function transport(){
 const calls=[];
 return {calls,client:{send:async(command,options)=>{
  calls.push({input:command.input,body:JSON.parse(Buffer.from(command.input.body).toString('utf8')),options});
  return {body:new TextEncoder().encode(JSON.stringify({content:[{type:'text',text:'{"kind":"conversation","act":"greeting"}'}],usage:{input_tokens:11,output_tokens:7}}))};
 }}};
}
function withRegion(region,fn){const prev=process.env.AWS_REGION;process.env.AWS_REGION=region;return Promise.resolve(fn()).finally(()=>{if(prev===undefined)delete process.env.AWS_REGION;else process.env.AWS_REGION=prev;});}
test('01 documented defaults match the team Haiku 5.5 / Singapore standard',()=>{
 assert.equal(DEFAULT_HAIKU_MODEL_ID,expectedId);assert.equal(DEFAULT_BEDROCK_REGION,'ap-southeast-1');
 assert.equal(getOfflineLlmStatus({}).provider,'mock');
});
test('02 resolve never invents model or region (fail-closed)',()=>{
 const c=resolveBedrockConfig({});
 assert.equal(c.modelId,'');assert.equal(c.region,undefined);assert.equal(c.temperature,undefined);assert.equal(c.topP,undefined);
 assert.match(bedrockConfigIssue(c),/BEDROCK_MODEL_ID/);
 assert.match(bedrockConfigIssue({...c,modelId:expectedId}),/AWS_REGION/);
});
test('03 explicit model and region are trimmed and preserved',()=>{
 const c=resolveBedrockConfig({BEDROCK_MODEL_ID:' '+expectedId+' ',AWS_REGION:' ap-southeast-1 '});
 assert.equal(c.modelId,expectedId);assert.equal(c.region,'ap-southeast-1');assert.equal(bedrockConfigIssue(c),null);
});
test('04 Haiku 5.5 rejects sampling parameters at config level',()=>{
 const c=resolveBedrockConfig(env);
 assert.match(bedrockConfigIssue({...c,temperature:0.1}),/sampling/);
 assert.match(bedrockConfigIssue({...c,topP:0.9}),/sampling/);
 assert.match(bedrockConfigIssue({...c,maxTokens:4096}),/maxTokens/);
 assert.match(bedrockConfigIssue({...c,region:'Singapore'}),/AWS_REGION/);
});
test('05 resolved config produces a Haiku 5.5 request with thinking disabled and no sampling',()=>withRegion('ap-southeast-1',async()=>{
 const f=transport();const r=await new BedrockService(resolveBedrockConfig(env),f.client).generateResponse('system','synthetic');
 assert.equal(r.success,true);assert.equal(f.calls.length,1);const c=f.calls[0];
 assert.equal(c.input.modelId,expectedId);assert.deepEqual(c.body.thinking,{type:'disabled'});
 assert.equal(c.body.temperature,undefined);assert.equal(c.body.top_p,undefined);assert.equal(c.body.max_tokens,2048);
 assert.equal(r.response.modelId,expectedId);assert.equal(r.response.region,'ap-southeast-1');
}));
test('06 offline doctor reports mode honestly and never leaks credentials',()=>{
 const r=getOfflineLlmStatus({...env,AWS_ACCESS_KEY_ID:'SECRET',AWS_SECRET_ACCESS_KEY:'SECRET'});
 assert.equal(r.configValid,true);assert.equal(r.modelId,expectedId);assert.equal(r.mode,'purchase_assistant');
 assert.equal(r.liveInference,'not_run');assert.equal(r.credentials,'not_checked_offline');assert.ok(!JSON.stringify(r).includes('SECRET'));
 assert.equal(getOfflineLlmStatus({...env,KFC_AGENT_MODE:'read-only'}).mode,'read_only');
 assert.equal(getOfflineLlmStatus({AI_PROVIDER:'invalid'}).configValid,false);
 assert.equal(getOfflineLlmStatus({...env,BEDROCK_MODEL_ID:''}).configValid,false);
 assert.equal(getOfflineLlmStatus({...env,AWS_REGION:''}).configValid,false);
});
test('07 provider failure remains failure without retry or mock fallback',async()=>{
 let count=0;const r=await new BedrockService(resolveBedrockConfig(env),{send:async()=>{count++;throw Error('synthetic failure');}}).generateResponse('system','synthetic');
 assert.equal(r.success,false);assert.equal(count,1);
});
test('08 read-only chat trace carries model identity from actual adapter (fake SDK)',()=>withRegion('ap-southeast-1',async()=>{
 const {ReadOnlyAgent}=require('../src/lib/agent/read-only/agent.ts');const f=transport();
 const a=new ReadOnlyAgent(new BedrockService(resolveBedrockConfig(env),f.client),async()=>{throw Error('no tools for greeting');});
 const r=await a.run('synthetic',[],{userId:'synthetic',sessionId:'synthetic',confirmed:false});
 assert.equal(r.ai.modelId,expectedId);assert.equal(r.ai.region,'ap-southeast-1');assert.equal(r.ai.calls,1);assert.equal(r.ai.error,undefined);
}));
