/* eslint-disable @typescript-eslint/no-require-imports -- Offline tests with scripted transports, not language accuracy tests. */
require('./offline-network-guard.cjs');require('./register-typescript.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {ReadOnlyAgent}=require('../src/lib/agent/read-only/agent.ts');
const menu=[{id:'sku-a',name:'Món demo A',price:40000,currency:'VND',isActive:true,isAvailable:true,metadata:{spicy:false},updatedAt:'2026-01-01T00:00:00Z'},{id:'sku-b',name:'Món demo B',price:60000,currency:'VND',isActive:true,isAvailable:true,metadata:{spicy:true},updatedAt:'2026-01-01T00:00:00Z'}];
const constraints=()=>({budget:null,partySize:null,spicy:null,unverified:[]});
const read=(extra={})=>({kind:'read',intents:['recommendation'],requests:[{id:'read-1',type:'LIST_MENU',parameters:{}}],constraints:constraints(),...extra});
const recommendation=(items=[{itemId:'sku-a',quantity:2}])=>({kind:'recommendation',items});
function fixture(replies,toolData={items:menu}){
 const calls=[],tools=[];const service={generateResponse:async(systemPrompt,userPrompt,history)=>{calls.push({systemPrompt,userPrompt,history});const value=replies.shift();if(value instanceof Error)throw value;return typeof value==='string'?{success:true,response:{content:value,role:'assistant'}}:value?.success===false?value:{success:true,response:{content:JSON.stringify(value),role:'assistant',usage:{inputTokens:100,outputTokens:20}}};}};
 const execute=async actions=>{tools.push(...structuredClone(actions));return actions.map(a=>({actionId:a.id,actionType:a.type,decision:'ALLOW',executed:true,reason:'fixture',data:toolData}));};
 return {agent:new ReadOnlyAgent(service,execute),calls,tools};
}
const ctx={userId:'synthetic',sessionId:'synthetic',confirmed:false};
test('01 scripted service boundary makes two calls and gives model tool evidence',async()=>{const f=fixture([read(),recommendation()]);const r=await f.agent.run('synthetic input',[],ctx);assert.equal(f.calls.length,2);assert.equal(f.tools.length,1);assert.match(f.calls[1].userPrompt,/sku-a/);assert.match(r.reply,/80\.000/);assert.equal(r.requiresConfirmation,false);assert.equal(r.ai.provider,'bedrock');assert.equal(r.ai.calls,2);});
test('02 only read actions can cross the existing policy executor boundary',async()=>{const v=read();v.requests[0]={id:'write',type:'CLEAR_CART',parameters:{}};const f=fixture([v]);const r=await f.agent.run('input',[],ctx);assert.equal(f.tools.length,0);assert.equal(r.ai.error,'validation_error');});
test('03 unknown fields, tool operations and model prices are rejected',async()=>{for(const patch of [v=>v.requests[0].parameters.operation='clear',v=>v.constraints.price=1,v=>v.confirmed=true]){const v=read();patch(v);const f=fixture([v]);assert.equal((await f.agent.run('input',[],ctx)).ai.error,'validation_error');assert.equal(f.tools.length,0);}});
test('04 transport failure never becomes mock success or exposes provider secrets',async()=>{for(const response of [{success:false,error:{type:'bedrock_error',message:'SECRET_VALUE'}},new Error('SECRET_VALUE')]){const f=fixture([response]);const r=await f.agent.run('input',[],ctx);assert.equal(r.ai.error,'provider_error');assert.equal(f.calls.length,1);assert.equal(f.tools.length,0);assert.ok(!JSON.stringify(r).includes('SECRET_VALUE'));}});
test('05 valid no-tool clarification and conversation survive',async()=>{for(const [plan,expected]of [[{kind:'clarification',slot:'budget_scope'},'ngân sách'],[{kind:'conversation',act:'greeting'},'Chào'],[{kind:'unsupported',reason:'cart_mutation'},'giỏ']]){const f=fixture([plan]);const r=await f.agent.run('input',[],ctx);assert.match(r.reply,new RegExp(expected,'i'));assert.equal(f.calls.length,1);assert.equal(f.tools.length,0);assert.equal(r.ai.error,undefined);}});
test('06 budget arithmetic is server-derived with strict lt versus lte',async()=>{for(const [operator,ok]of [['lt',false],['lte',true]]){const c=constraints();c.budget={amount:80000,currency:'VND',operator,scope:'total',approximate:false};const f=fixture([read({constraints:c}),recommendation()]);const r=await f.agent.run('input',[],ctx);assert.equal(r.ai.error,ok?undefined:'budget_exceeded');}});
test('07 per-person budget requires party size only when comparing a group plan',async()=>{const c=constraints();c.budget={amount:50000,currency:'VND',operator:'lte',scope:'per_person',approximate:false};let f=fixture([read({constraints:c}),recommendation()]);assert.match((await f.agent.run('input',[],ctx)).reply,/người/);c.partySize=2;f=fixture([read({constraints:c}),recommendation()]);assert.equal((await f.agent.run('input',[],ctx)).ai.error,undefined);});
test('08 missing item is no-match and no fabricated ID/price reaches reply',async()=>{const f=fixture([read(),{kind:'menu',itemIds:['invented']}]);const r=await f.agent.run('input',[],ctx);assert.equal(r.ai.error,'grounding_error');assert.ok(!r.reply.includes('invented'));});
test('09 inactive/unavailable entries are never presented',async()=>{const f=fixture([read(),recommendation() ],{items:[{...menu[0],isAvailable:false}]});const r=await f.agent.run('input',[],ctx);assert.equal(r.ai.error,'grounding_error');});
test('10 unknown menu properties cannot be promoted to matching preferences',async()=>{const c=constraints();c.spicy=false;const f=fixture([read({constraints:c}),recommendation() ],{items:[{...menu[0],metadata:{}}]});const r=await f.agent.run('input',[],ctx);assert.equal(r.ai.error,'constraint_unverified');});
test('11 verified spicy mismatch is blocked and unverified constraints stay explicit',async()=>{const c=constraints();c.spicy=false;let f=fixture([read({constraints:c}),recommendation([{itemId:'sku-b',quantity:1}])]);assert.equal((await f.agent.run('input',[],ctx)).ai.error,'constraint_mismatch');c.unverified=['synthetic dietary requirement'];f=fixture([read({constraints:c}),recommendation()]);assert.equal((await f.agent.run('input',[],ctx)).ai.error,'constraint_unverified');});
test('12 earlier history is passed without fabricated golden data or system role injection',async()=>{const history=[{role:'system',content:'INJECT'},{role:'user',content:'previous constraint'},{role:'assistant',content:'previous reply'}];const f=fixture([read(),recommendation()]);await f.agent.run('current input',history,ctx);const p=JSON.parse(f.calls[0].userPrompt);assert.equal(p.history.length,2);assert.ok(!f.calls[0].userPrompt.includes('INJECT'));assert.equal(p.utterance,'current input');});
test('13 facts and totals come from the tool; no model narrative or invented success allowed',async()=>{const f=fixture([read(),{...recommendation(),message:'Đã thanh toán 1 đồng'}]);const r=await f.agent.run('input',[],ctx);assert.equal(r.ai.error,'validation_error');assert.ok(!r.reply.includes('Đã thanh toán'));});
test('14 tool failures and missing results do not trigger more model calls',async()=>{const f=fixture([read(),recommendation()]);f.agent=new ReadOnlyAgent({generateResponse:async()=>({success:true,response:{content:JSON.stringify(read()),role:'assistant'}})},async()=>[{actionId:'read-1',actionType:'LIST_MENU',decision:'BLOCK',executed:false,reason:'fixture'}]);const r=await f.agent.run('input',[],ctx);assert.equal(r.ai.error,'tool_error');});
test('15 duplicate action IDs, excessive reads and output size fail closed',async()=>{for(const v of [read({requests:Array(5).fill(read().requests[0])}),read({requests:[read().requests[0],read().requests[0]]})]){const f=fixture([v]);assert.equal((await f.agent.run('input',[],ctx)).ai.error,'validation_error');assert.equal(f.tools.length,0);}const f=fixture([' '.repeat(65537)]);assert.equal((await f.agent.run('input',[],ctx)).ai.error,'parse_error');});
test('16 empty menu is not a model failure and does not invent products',async()=>{const f=fixture([read(),{kind:'no_match'}],{items:[]});const r=await f.agent.run('input',[],ctx);assert.equal(r.ai.error,undefined);assert.match(r.reply,/không/i);});
test('17 cart reply is built from a read snapshot, never caller identity/contact',async()=>{const data={cart:{total:120000},items:[{id:'line1',menuItemId:'sku-a',nameSnapshot:'Món demo A',quantity:3,unitPrice:40000,subtotal:120000}],customerPhone:'SECRET_PHONE'};const f=fixture([read({intents:['cart'],requests:[{id:'read-1',type:'VIEW_CART',parameters:{}}]}),{kind:'cart'}],data);const r=await f.agent.run('input',[],ctx);assert.match(r.reply,/120\.000/);assert.ok(!f.calls[1].userPrompt.includes('SECRET_PHONE'));});
test('18 two calls are bounded and quantities stay valid integers',async()=>{for(const quantity of [0,-1,1.5,101]){const f=fixture([read(),recommendation([{itemId:'sku-a',quantity}])]);const r=await f.agent.run('input',[],ctx);assert.equal(r.ai.error,'validation_error');assert.equal(f.calls.length,2);}});
test('19 chat service routes to read-only LLM, retains history, policy and unchanged cart',async()=>{
 process.env.AI_PROVIDER='mock';process.env.PERSISTENCE_DRIVER='mock';process.env.SESSION_SECRET='synthetic-read-only-unit-signing-secret-2026';
 const {services,executeProposedActions}=require('../src/lib/agent/agent-core.ts');
 const oldAgent=services.readOnlyAgent,oldProvider=services.llmProvider;
 const userId='readonly-'+crypto.randomUUID();
 const before=await services.cartService.getCartView(userId);
 const items=await services.menuService.getAvailableMenuItems();assert.ok(items.length);
 const f=fixture([read(),{kind:'menu',itemIds:[items[0].id]},{kind:'clarification',slot:'reference'}]);
 f.agent=new ReadOnlyAgent({generateResponse:async(...args)=>{f.calls.push({userPrompt:args[1]});const p=f.calls.length===1?read({intents:['menu']}):f.calls.length===2?{kind:'menu',itemIds:[items[0].id]}:{kind:'clarification',slot:'reference'};return {success:true,response:{content:JSON.stringify(p),role:'assistant'}};}},executeProposedActions);
 services.readOnlyAgent=f.agent;services.llmProvider={generateResponse:async()=>{throw Error('legacy provider must not execute');}};
 try{
 const send=message=>services.chatService.processChat({platform:'web',userId,sessionId:'ignored',message});
 const r=await send('synthetic read request');assert.equal(r.ai?.mode,'read_only');assert.ok(r.reply.includes(items[0].name));assert.equal(r.execution[0].decision,'ALLOW');
 const next=await send('synthetic reference');assert.equal(next.ai.calls,1);assert.ok(JSON.parse(f.calls[2].userPrompt).history.some(t=>t.content==='synthetic read request'));
 assert.deepEqual(await services.cartService.getCartView(userId),before);assert.equal(r.requiresConfirmation,false);
 }finally{services.readOnlyAgent=oldAgent;services.llmProvider=oldProvider;}
});
test('20 explicit provider config selects real adapter; mock stays offline',()=>{
 const {services,ServiceContainer}=require('../src/lib/agent/agent-core.ts');const {toolRegistry}=require('../src/lib/agent/tools/tool-registry.ts');
 assert.equal(services.readOnlyAgent,null);
 process.env.AI_PROVIDER='bedrock';
 try{
  // Purchase assistant stays the default for bedrock; read-only is opt-in.
  assert.equal(new ServiceContainer().readOnlyAgent,null);
  process.env.KFC_AGENT_MODE='read-only';
  assert.ok(new ServiceContainer().readOnlyAgent instanceof ReadOnlyAgent);
 }finally{process.env.AI_PROVIDER='mock';delete process.env.KFC_AGENT_MODE;toolRegistry.register(services.menuTool);toolRegistry.register(services.cartTool);}
});
test('21 actual Bedrock serializer carries structured plans and grounded evidence (fake SDK only)',async()=>{
 const {BedrockService}=require('../src/lib/aws/bedrock.ts');const commands=[];
 const responses=[read(),recommendation()];
 const service=new BedrockService({modelId:'synthetic-model',maxTokens:2048},{send:async(command,options)=>{assert.ok(options.abortSignal);commands.push(JSON.parse(command.input.body));return {body:new TextEncoder().encode(JSON.stringify({content:[{type:'text',text:JSON.stringify(responses.shift())}],usage:{input_tokens:10,output_tokens:5}}))};}});
 const f=fixture([]);const agent=new ReadOnlyAgent(service,async actions=>actions.map(a=>({actionId:a.id,actionType:a.type,decision:'ALLOW',executed:true,reason:'fixture',data:{items:menu}})));
 const r=await agent.run('synthetic input',[],ctx);assert.equal(commands.length,2);assert.match(commands[1].messages[0].content[0].text,/sku-a/);assert.equal(commands[0].max_tokens,2048);assert.equal(commands[0].tools,undefined);assert.equal(r.ai.inputTokens,20);assert.equal(r.ai.outputTokens,10);assert.equal(r.ai.error,undefined);assert.equal(f.calls.length,0);
});
test('22 multi-intent limitation is explicit and missing menu payload is a tool error',async()=>{
 let f=fixture([read({intents:['menu','cart']}),{kind:'menu',itemIds:['sku-a']}]);let r=await f.agent.run('input',[],ctx);assert.match(r.reply,/từng yêu cầu/);
 f=fixture([read(),{kind:'no_match'}],{});r=await f.agent.run('input',[],ctx);assert.equal(r.ai.error,'tool_error');assert.equal(f.calls.length,1);
});
test('23 a single fenced JSON response is accepted at both model stages',async()=>{
 for(const fence of ['json','JSON','']){
  const f=fixture(['\uFEFF  ```'+fence+'\r\n'+JSON.stringify(read())+'\r\n```  ','```json\n'+JSON.stringify(recommendation())+'\n```']);
  const r=await f.agent.run('synthetic input',[],ctx);assert.equal(r.ai.error,undefined);assert.equal(f.tools.length,1);assert.match(r.reply,/80\.000/);
 }
});
test('24 fenced output still passes strict validation, never bypasses mutation gates',async()=>{
 const v=read();v.requests[0].type='CLEAR_CART';const f=fixture(['```json\n'+JSON.stringify(v)+'\n```']);
 const r=await f.agent.run('synthetic',[],ctx);assert.equal(r.ai.error,'validation_error');assert.equal(f.tools.length,0);
});
test('25 prose, multiple objects, malformed and incomplete fences are not repaired or executed',async()=>{
 for(const content of ['text '+JSON.stringify(read()),JSON.stringify(read())+'\n'+JSON.stringify(read()),'```json\n'+JSON.stringify(read()),'```json\n{broken}\n```']){
  const f=fixture([content]);const r=await f.agent.run('synthetic',[],ctx);assert.equal(r.ai.error,'parse_error');assert.equal(r.ai.failure.stage,'understanding');assert.equal(f.tools.length,0);assert.equal(f.calls.length,1);
 }
});
test('26 parse diagnostics identify stage/shape without exposing content or extra calls',async()=>{
 const f=fixture([read(),'SECRET_RESPONSE']);const r=await f.agent.run('synthetic',[],ctx);
 assert.equal(r.ai.error,'parse_error');assert.equal(r.ai.failure.stage,'answer');assert.equal(r.ai.failure.code,'invalid_json');assert.equal(r.ai.failure.outputBytes,15);assert.equal(r.ai.failure.outputFormat,'other');assert.ok(!JSON.stringify(r).includes('SECRET_RESPONSE'));assert.equal(f.calls.length,2);
});
const clarificationPlan=(c)=>({kind:'clarification',slot:'budget_scope',constraints:c,intents:['recommendation']});
const ambiguousBudget=()=>({...constraints(),budget:{amount:90000,currency:'VND',operator:'lte',scope:'unspecified',approximate:false}});
test('27 clarification preserves known constraints and pending slot for the next LLM turn',async()=>{
 const c=ambiguousBudget();const resolved={...c,partySize:1,budget:{...c.budget,scope:'total'}};
 const f=fixture([clarificationPlan(c),read({constraints:resolved}),recommendation()]);
 const first=await f.agent.run('synthetic initial',[],ctx);assert.equal(first.ai.error,undefined);assert.equal(first.dialogueState.pendingSlot,'budget_scope');assert.equal(first.dialogueState.constraints.budget.amount,90000);
 const next=await f.agent.run('synthetic follow-up',[],ctx,first.dialogueState);assert.equal(next.ai.error,undefined);assert.match(next.reply,/80\.000/);
 const p=JSON.parse(f.calls[1].userPrompt);assert.equal(p.dialogue.pendingSlot,'budget_scope');assert.equal(p.dialogue.constraints.budget.amount,90000);assert.equal(next.dialogueState.pendingSlot,null);
});
test('28 a resolved clarification slot resumes the pending read task instead of repeating it',async()=>{
 const c=ambiguousBudget();const resolved={...c,partySize:1,budget:{...c.budget,scope:'total'}};
 const f=fixture([clarificationPlan(c),clarificationPlan(resolved),recommendation()]);
 const first=await f.agent.run('synthetic initial',[],ctx);const next=await f.agent.run('synthetic follow-up',[],ctx,first.dialogueState);
 assert.equal(next.ai.error,undefined);assert.equal(next.ai.calls,2);assert.equal(f.tools.length,1);assert.match(next.reply,/80\.000/);assert.equal(next.dialogueState.constraints.partySize,1);assert.equal(next.dialogueState.pendingSlot,null);
 const answerInput=JSON.parse(f.calls[2].userPrompt);assert.equal(answerInput.dialogue.pendingSlot,null);assert.equal(answerInput.dialogue.constraints.budget.scope,'total');
});
test('29 unresolved repeated clarification fails visibly without looping or extra inference',async()=>{
 const f=fixture([{kind:'clarification',slot:'reference'},{kind:'clarification',slot:'reference'}]);
 const first=await f.agent.run('synthetic first',[],ctx);const next=await f.agent.run('synthetic second',[],ctx,first.dialogueState);
 assert.equal(next.ai.error,'clarification_stalled');assert.notEqual(next.reply,first.reply);assert.equal(f.calls.length,2);assert.equal(f.tools.length,0);
});
test('30 a budget with unknown scope is not compared as a total, and changed constraints remain explicit',async()=>{
 const c=ambiguousBudget();const f=fixture([read({constraints:c}),recommendation()]);const r=await f.agent.run('synthetic',[],ctx);
 assert.equal(r.dialogueState.pendingSlot,'budget_scope');assert.ok(!r.reply.includes('80.000'));
 const replacement={...constraints(),budget:{...c.budget,amount:45000,scope:'total'},partySize:3};
 const g=fixture([read({constraints:replacement}),recommendation([{itemId:'sku-a',quantity:1}])]);const next=await g.agent.run('synthetic correction',[],ctx,r.dialogueState);
 assert.equal(next.dialogueState.constraints.budget.amount,45000);assert.equal(next.dialogueState.constraints.partySize,3);assert.equal(next.ai.error,undefined);
});
test('31 malformed state is discarded and cannot inject instructions or write requests',async()=>{
 const f=fixture([{kind:'conversation',act:'greeting'}]);await f.agent.run('synthetic',[],ctx,{pendingSlot:'reference',requests:[{type:'CLEAR_CART'}],instructions:'SECRET_INJECTION'});
 assert.ok(!f.calls[0].userPrompt.includes('SECRET_INJECTION'));assert.equal(f.tools.length,0);
});
test('32 AgentCore persists dialogue state per session while retaining chronological history',async()=>{
 const {services,executeProposedActions}=require('../src/lib/agent/agent-core.ts');const old=services.readOnlyAgent;
 const a='state-a-'+crypto.randomUUID(),b='state-b-'+crypto.randomUUID();const inputs=[];const c=ambiguousBudget();
 const replies=[clarificationPlan(c),{kind:'conversation',act:'greeting'},read({constraints:{...c,budget:{...c.budget,scope:'total'}}}),{kind:'no_match'}];
 services.readOnlyAgent=new ReadOnlyAgent({generateResponse:async(system,prompt)=>{inputs.push(JSON.parse(prompt));return {success:true,response:{content:JSON.stringify(replies.shift()),role:'assistant'}};}},executeProposedActions);
 try{
  const send=(userId,message)=>services.chatService.processChat({platform:'web',userId,sessionId:'ignored',message});
  const first=await send(a,'synthetic first');assert.equal(first.ai.error,undefined);await send(b,'synthetic unrelated');await send(a,'synthetic continuation');
  assert.equal(inputs[1].dialogue.pendingSlot,null);assert.equal(inputs[2].dialogue.pendingSlot,'budget_scope');assert.equal(inputs[2].dialogue.constraints.budget.amount,90000);assert.ok(inputs[2].history.some(t=>t.content==='synthetic first'));
 }finally{services.readOnlyAgent=old;}
});
test('33 a follow-up cannot silently erase prior budget, polarity or exclusions with empty fields',async()=>{
 const c={...ambiguousBudget(),spicy:false,unverified:['synthetic exclusion']};const f=fixture([clarificationPlan(c),read(),recommendation()]);
 const first=await f.agent.run('synthetic first',[],ctx);const next=await f.agent.run('synthetic follow-up',[],ctx,first.dialogueState);
 assert.equal(next.dialogueState.constraints.budget.amount,90000);assert.equal(next.dialogueState.constraints.spicy,false);assert.deepEqual(next.dialogueState.constraints.unverified,['synthetic exclusion']);assert.equal(next.ai.error,'constraint_unverified');
});
test('34 an explicit semantic clear removes previous constraints without cart mutations',async()=>{
 const c={...ambiguousBudget(),spicy:false,unverified:['synthetic exclusion']};const f=fixture([clarificationPlan(c),read({clearConstraints:['budget','spicy','unverified']}),recommendation()]);
 const first=await f.agent.run('synthetic first',[],ctx);const next=await f.agent.run('synthetic withdrawal',[],ctx,first.dialogueState);
 assert.equal(next.ai.error,undefined);assert.equal(next.dialogueState.constraints.budget,null);assert.equal(next.dialogueState.constraints.spicy,null);assert.deepEqual(next.dialogueState.constraints.unverified,[]);assert.ok(f.tools.every(t=>t.type==='LIST_MENU'));
});
