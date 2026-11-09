/* eslint-disable @typescript-eslint/no-require-imports -- Explicit AWS canary CLI. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const MODEL = 'us.anthropic.claude-haiku-4-5-20251001-v1:0';
function parseArgs(values) {
  const result = { profile: 'default', region: 'us-west-2', model: MODEL, invoke: false };
  for (let index = 0; index < values.length; index++) {
    const flag = values[index];
    if (flag === '--invoke') { result.invoke = true; continue; }
    const names = { '--profile': 'profile', '--region': 'region', '--expected-account': 'account', '--request-id': 'requestId' };
    if (!names[flag] || !values[index + 1] || values[index + 1].startsWith('--')) throw new Error('Unknown or incomplete canary argument.');
    result[names[flag]] = values[++index];
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(result.profile)) throw new Error('Invalid AWS profile name.');
  if (!['us-west-2', 'us-east-1', 'us-east-2'].includes(result.region)) throw new Error('Select an approved US region for this inference profile.');
  if (result.invoke && (!/^\d{12}$/.test(result.account ?? '') || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(result.requestId ?? '')))
    throw new Error('--invoke requires --expected-account and a new UUID --request-id.');
  return result;
}
function aws(args, operation) {
  return JSON.parse(execFileSync('aws', [...operation, '--profile', args.profile, '--region', args.region, '--output', 'json', '--no-cli-pager'], {
    encoding: 'utf8', windowsHide: true, env: { ...process.env, AWS_MAX_ATTEMPTS: '1', AWS_PAGER: '' },
    stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000,
  }));
}
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const identity = aws(args, ['sts', 'get-caller-identity']);
  if (args.account && identity.Account !== args.account) throw new Error('AWS account mismatch.');
  const profile = aws(args, ['bedrock', 'get-inference-profile', '--inference-profile-identifier', args.model]);
  const availability = aws(args, ['bedrock', 'get-foundation-model-availability', '--model-id', args.model.replace(/^us\./, '')]);
  assert.equal(profile.status, 'ACTIVE');
  assert.equal(availability.authorizationStatus, 'AUTHORIZED');
  assert.equal(availability.agreementAvailability?.status, 'AVAILABLE');
  assert.equal(availability.entitlementAvailability, 'AVAILABLE');
  assert.equal(availability.regionAvailability, 'AVAILABLE');
  const summary = { checkedAt: new Date().toISOString(), accountLast4: identity.Account.slice(-4), region: args.region,
    profile: args.profile, model: args.model, modelDestinations: profile.models.map(model => model.modelArn.split(':')[3]),
    readOnlyPreflightPassed: true, inferenceCalls: 0, inferenceVerified: false, applicationDeployed: false };
  if (!args.invoke) {
    fs.mkdirSync(path.join(ROOT, 'output/verification'), { recursive: true });
    fs.writeFileSync(path.join(ROOT, 'output/verification/aws-preflight.json'), JSON.stringify(summary, null, 2) + '\n');
    console.log(JSON.stringify(summary, null, 2));
    return;
  }
  const ledger = path.join(ROOT, '.local/aws-canary');
  fs.mkdirSync(ledger, { recursive: true });
  fs.writeFileSync(path.join(ledger, args.requestId + '.attempt.json'), JSON.stringify({ ...summary, requestId: args.requestId, intent: 'At most one inference, no automatic retry' }), { flag: 'wx', mode: 0o600 });
  process.env.AI_PROVIDER = 'bedrock';
  process.env.PERSISTENCE_DRIVER = 'mock';
  process.env.LOCAL_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'kfc-canary-'));
  process.env.AWS_PROFILE = args.profile;
  process.env.AWS_REGION = args.region;
  process.env.BEDROCK_MODEL_ID = args.model;
  process.env.BEDROCK_DAILY_REQUEST_LIMIT = '1';
  require('./register-typescript.cjs');
  const { services } = require('../src/lib/agent/agent-core.ts');
  const original = services.bedrockService.generateResponse.bind(services.bedrockService);
  let usage, calls = 0;
  services.bedrockService.generateResponse = async (...input) => {
    if (++calls > 1) throw new Error('Canary inference limit exceeded.');
    const result = await original(...input);
    if (result.success) usage = result.response.usage;
    return result;
  };
  const owner = 'synthetic_canary_' + args.requestId;
  const input = { platform: 'web', userId: owner, sessionId: 'synthetic_canary_session', message: 'Thêm 2 Pepsi 1.5L vào giỏ hàng' };
  let passed = false, failure;
  try {
    assert.equal(await services.cartService.getCartView(owner), null);
    const proposal = await services.chatService.processChat(input);
    assert.equal(proposal.requiresConfirmation, true);
    assert.equal(await services.cartService.getCartView(owner), null);
    assert.ok(proposal.pendingConfirmation?.id);
    await services.chatService.processChat({ ...input, message: 'Xác nhận', confirm: true, confirmationId: proposal.pendingConfirmation.id });
    const basket = await services.cartService.getCartView(owner);
    assert.equal(basket.items.length, 1);
    assert.equal(basket.items[0].quantity, 2);
    assert.equal(basket.items[0].menuItemId, 'item_pepsi_004');
    assert.equal(calls, 1);
    passed = true;
  } catch (error) { failure = error instanceof Error ? error.message : 'Canary failed'; }
  const report = { ...summary, requestId: args.requestId, inferenceCalls: calls, inferenceVerified: passed, passed,
    usage, maxOutputTokens: 512, confirmationExecutedInSyntheticMemory: passed,
    sourceSha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'src/lib/aws/bedrock.ts'))).digest('hex'),
    ...(failure ? { failure } : {}) };
  fs.mkdirSync(path.join(ROOT, 'output/verification'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'output/verification/aws-canary-' + args.requestId + '.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  if (!passed) process.exitCode = 1;
}
module.exports = { parseArgs };
if (require.main === module) main().catch(error => {
  console.error(error instanceof Error ? error.message : 'AWS preflight/canary failed');
  process.exitCode = 1;
});
