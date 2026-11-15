/* eslint-disable @typescript-eslint/no-require-imports -- Explicit, bounded Bedrock evaluation CLI. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const datasetPath = path.join(root, 'tests/data/llm-evaluation.vi.json');
const labels = ['SEARCH_MENU', 'VIEW_CART', 'ADD_TO_CART', 'UPDATE_CART', 'REMOVE_FROM_CART', 'CLEAR_CART', 'UNKNOWN'];
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function validateDataset(cases, developmentCases) {
  if (!Array.isArray(cases) || cases.length !== 24) throw new Error('Evaluation requires exactly 24 reviewed cases.');
  const ids = new Set(), messages = new Set();
  const normalize = text => text.normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ');
  const development = new Set(developmentCases.map(row => normalize(row.message)));
  for (const row of cases) {
    if (!row || typeof row.id !== 'string' || !/^LLM-\d{3}$/.test(row.id) || ids.has(row.id) ||
        typeof row.message !== 'string' || !row.message.trim() || row.message.length > 1000 ||
        !labels.includes(row.expectedAction) || Object.keys(row).some(key => !['id', 'message', 'expectedAction', 'expectedQuantity'].includes(key)) ||
        (row.expectedQuantity !== undefined && (!Number.isInteger(row.expectedQuantity) || row.expectedQuantity < 1 || row.expectedQuantity > 100)))
      throw new Error('Invalid evaluation case.');
    const message = normalize(row.message);
    if (messages.has(message) || development.has(message)) throw new Error('Evaluation cases must be distinct from development cases.');
    ids.add(row.id); messages.add(message);
  }
  return cases;
}

function summarize(rows) {
  const total = rows.length;
  const intentCorrect = rows.filter(row => row.actualAction === row.expectedAction).length;
  const jointCorrect = rows.filter(row => row.actualAction === row.expectedAction &&
    (row.expectedQuantity === undefined || row.actualQuantity === row.expectedQuantity)).length;
  return { attempted: total, intentCorrect, jointCorrect,
    intentAccuracy: total ? intentCorrect / total : null,
    jointAccuracy: total ? jointCorrect / total : null };
}

function parseArgs(values) {
  const args = { invoke: false };
  for (let index = 0; index < values.length; index++) {
    if (values[index] === '--invoke') { args.invoke = true; continue; }
    const names = { '--expected-account': 'account', '--run-id': 'runId' };
    if (!names[values[index]] || !values[index + 1] || values[index + 1].startsWith('--')) throw new Error('Unknown or incomplete evaluation argument.');
    args[names[values[index]]] = values[++index];
  }
  if (args.invoke && (!/^\d{12}$/.test(args.account ?? '') || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(args.runId ?? '')))
    throw new Error('Invoking requires the approved account and a new UUID --run-id.');
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dataset = fs.readFileSync(datasetPath);
  const cases = validateDataset(JSON.parse(dataset), JSON.parse(fs.readFileSync(path.join(root, 'tests/data/intent-cases.vi.json'))));
  const sources = ['scripts/evaluate-llm.cjs', 'src/lib/aws/bedrock.ts', 'src/lib/agent/prompts/system-prompt.ts', 'src/lib/types/agent.ts']
    .map(name => ({ path: name, sha256: digest(fs.readFileSync(path.join(root, name))) }));
  const plan = { checkedAt: new Date().toISOString(), model: 'global.anthropic.claude-haiku-5-5', region: 'ap-southeast-1',
    profile: 'default', datasetSha256: digest(dataset), sources, plannedRequests: cases.length, maxOutputTokens: 512,
    maxInputBytes: 32000, datasetUse: 'New synthetic evaluation set authored after development, distinct from the 50 development cases; requires human label review. No user study.',
    scope: 'Strict JSON schema, intent and quantity extraction. Menu read actions grouped as SEARCH_MENU. Product resolution, policy, HTTP and tool execution are evaluated separately.',
    inferenceCalls: 0 };
  const output = path.join(root, 'output/evaluation');
  fs.mkdirSync(output, { recursive: true });
  if (!args.invoke) {
    const name = 'llm-plan-' + plan.checkedAt.replace(/[:.]/g, '-') + '.json';
    fs.writeFileSync(path.join(output, name), JSON.stringify(plan, null, 2), { flag: 'wx' });
    console.log(JSON.stringify(plan, null, 2));
    return;
  }
  const identity = JSON.parse(execFileSync('aws', ['sts', 'get-caller-identity', '--profile', plan.profile, '--region', plan.region, '--output', 'json', '--no-cli-pager'],
    { encoding: 'utf8', windowsHide: true, timeout: 30000 }));
  if (identity.Account !== args.account) throw new Error('Evaluation AWS account mismatch.');
  const ledger = path.join(root, '.local/llm-evaluation');
  fs.mkdirSync(ledger, { recursive: true });
  fs.writeFileSync(path.join(ledger, args.runId + '.attempt.json'), JSON.stringify({ ...plan, accountLast4: args.account.slice(-4) }, null, 2), { flag: 'wx', mode: 0o600 });
  process.env.AWS_PROFILE = plan.profile;
  process.env.AWS_REGION = plan.region;
  process.env.LOCAL_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'kfc-llm-evaluation-'));
  process.env.BEDROCK_DAILY_REQUEST_LIMIT = String(cases.length);
  require('./register-typescript.cjs');
  const { BedrockService } = require('../src/lib/aws/bedrock.ts');
  const { AgentResponseSchema } = require('../src/lib/types/agent.ts');
  const { systemPrompt } = require('../src/lib/agent/prompts/system-prompt.ts');
  const service = new BedrockService({ modelId: plan.model, maxTokens: 512 });
  const rows = [];
  let halted = false;
  for (const example of cases) {
    const started = performance.now();
    const userPrompt = `Tin nhắn hiện tại: ${example.message}\nPhân tích ý định và chỉ trả JSON theo schema.\nUSER_MESSAGE_JSON:${JSON.stringify(example.message)}`;
    const result = await service.generateResponse(systemPrompt, userPrompt);
    let actualAction = 'INVALID', actualQuantity, invalidOutput = false;
    if (result.success) {
      try {
        const response = AgentResponseSchema.parse(JSON.parse(result.response.content));
        const action = response.actions[0];
        actualAction = response.actions.length > 1 ? 'MULTIPLE' : action?.type ?? 'UNKNOWN';
        if (['LIST_MENU', 'GET_MENU_ITEM'].includes(actualAction)) actualAction = 'SEARCH_MENU';
        actualQuantity = action?.parameters.quantity;
      } catch { invalidOutput = true; }
    }
    rows.push({ id: example.id, expectedAction: example.expectedAction, expectedQuantity: example.expectedQuantity,
      actualAction, actualQuantity, milliseconds: performance.now() - started, invalidOutput,
      ...(result.success ? { usage: result.response.usage } : { error: result.error }) });
    if (!result.success) halted = true;
    const budgetPath = path.join(process.env.LOCAL_DATA_DIR, 'bedrock-usage.json');
    const report = { ...plan, runId: args.runId, generatedAt: new Date().toISOString(),
      inferenceCalls: fs.existsSync(budgetPath) ? JSON.parse(fs.readFileSync(budgetPath)).used : 0,
      complete: rows.length === cases.length && !halted, stoppedOnProviderFailure: halted,
      overall: summarize(rows), results: rows };
    fs.writeFileSync(path.join(output, 'llm-result-' + args.runId + '.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ caseId: example.id, actualAction, providerSucceeded: result.success }));
    if (halted) break;
  }
  if (halted) process.exitCode = 1;
}

module.exports = { validateDataset, summarize, parseArgs };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
