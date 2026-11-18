/* eslint-disable @typescript-eslint/no-require-imports -- Multi-turn live check of the deployed AgentCore runtime (paid Bedrock inference). */
// Usage:
//   node scripts/evaluate-agentcore-flow.cjs --runtime-arn <arn> --approve-invocations 6 [--dry-run]
// One customer, one runtime session, 11 turns: propose -> confirm -> add -> confirm
// -> update -> confirm -> view -> remove -> "ok" (must NOT execute) -> confirm -> view.
// Only free-text turns reach the model (6); confirmations replay the stored
// proposal server-side. After every turn the real cart is read back from
// DynamoDB (read-only) and compared with the expected state.
// Output: output/evaluation/agentcore-flow-<timestamp>.json (git-ignored).
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const PEPSI = "Pepsi (Đại)";
const BURGER = "Burger Tôm";
const STEPS = [
  { say: "cho mik 2 pepsi lớn", model: true, expect: { proposal: [PEPSI, "2"], cart: {} } },
  { confirm: true, expect: { cart: { [PEPSI]: 2 }, total: 40000 } },
  { say: "thêm 1 bơ gơ tôm nha", model: true, expect: { proposal: [BURGER, "1"], cart: { [PEPSI]: 2 } } },
  { confirm: true, expect: { cart: { [PEPSI]: 2, [BURGER]: 1 }, total: 85000 } },
  { say: "đổi pepsi đại thành 3", model: true, expect: { proposal: [PEPSI, "3"], cart: { [PEPSI]: 2, [BURGER]: 1 } } },
  { confirm: true, expect: { cart: { [PEPSI]: 3, [BURGER]: 1 }, total: 105000 } },
  { say: "giỏ mình giờ bao nhiêu tiền", model: true, expect: { replyIncludes: ["105.000"], cart: { [PEPSI]: 3, [BURGER]: 1 } } },
  { say: "bỏ burger tôm ra", model: true, expect: { proposal: [BURGER], cart: { [PEPSI]: 3, [BURGER]: 1 } } },
  { say: "ok", model: false, expect: { noExecution: true, cart: { [PEPSI]: 3, [BURGER]: 1 } } },
  { confirm: true, expect: { cart: { [PEPSI]: 3 }, total: 60000 } },
  { say: "giỏ còn gì", model: true, expect: { replyIncludes: ["60.000"], cart: { [PEPSI]: 3 } } },
];

function parseArgs(argv) {
  const args = { approve: 0, dryRun: false, arn: "" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--approve-invocations") args.approve = Number(argv[++i]);
    else if (argv[i] === "--runtime-arn") args.arn = argv[++i];
    else if (argv[i] === "--dry-run") args.dryRun = true;
    else throw new Error("Unknown argument: " + argv[i]);
  }
  const needed = STEPS.filter((step) => step.model).length;
  if (!args.dryRun && args.approve < needed) throw new Error(`This flow needs ${needed} model invocations; --approve-invocations ${args.approve} is not enough.`);
  if (!args.dryRun && !/^arn:aws:bedrock-agentcore:[a-z0-9-]+:\d{12}:runtime\/[A-Za-z0-9_-]+$/.test(args.arn)) throw new Error("--runtime-arn is required.");
  return args;
}

function invoke(arn, sessionId, payload, dir) {
  const input = path.join(dir, "payload.json"), output = path.join(dir, "reply.json");
  fs.writeFileSync(input, JSON.stringify(payload), "utf8");
  const started = Date.now();
  execFileSync("aws", ["bedrock-agentcore", "invoke-agent-runtime", "--agent-runtime-arn", arn, "--runtime-session-id", sessionId,
    "--content-type", "application/json", "--payload", "fileb://" + input, output], { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, MSYS_NO_PATHCONV: "1" } });
  return { latencyMs: Date.now() - started, body: JSON.parse(fs.readFileSync(output, "utf8")) };
}

async function readCart(userId) {
  // Read-only view of the persisted cart through the application's own repository.
  const { DynamoDBCartRepository } = require("../src/lib/db/repositories/implementations/dynamodb-repository.ts");
  const repo = new DynamoDBCartRepository();
  const cart = await repo.getActiveCart(userId);
  if (!cart) return { lines: {}, total: 0 };
  const items = await repo.getCartItems(cart.id);
  const lines = Object.fromEntries(items.map((line) => [line.nameSnapshot.normalize("NFC"), line.quantity]));
  return { lines, total: items.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0) };
}

const nfc = (s) => String(s ?? "").normalize("NFC").replace(/[\s  ]+/g, " ");

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.dryRun) {
    STEPS.forEach((step, i) => console.log(`${String(i + 1).padStart(2)} ${step.confirm ? "[xác nhận]" : step.say}${step.model ? "  (model)" : ""}`));
    console.log(`model invocations: ${STEPS.filter((s) => s.model).length}`);
    return;
  }
  process.env.PERSISTENCE_DRIVER = "dynamodb";
  process.env.DYNAMODB_TABLE_NAME ??= "KfcForceAgent";
  require("./register-typescript.cjs");
  const runId = crypto.randomUUID();
  const userId = `live-flow-${runId.slice(0, 8)}`;
  const sessionId = `kfc-live-flow-${runId}`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kfc-flow-"));
  let pending = null;
  let invocations = 0;
  const results = [];
  for (const [index, step] of STEPS.entries()) {
    if (step.model && invocations >= args.approve) throw new Error("Approved invocation budget exhausted.");
    const payload = step.confirm
      ? { userId, message: "Xác nhận", confirm: true, confirmationId: pending?.id }
      : { userId, message: step.say };
    if (step.confirm && !pending) {
      results.push({ step: index + 1, input: "[xác nhận]", pass: false, problems: ["no pending proposal to confirm"] });
      console.log(`${index + 1} ✗ no pending proposal to confirm — stopping`);
      break;
    }
    if (step.model) invocations++;
    const { latencyMs, body } = invoke(args.arn, sessionId, payload, dir);
    const cart = await readCart(userId);
    const problems = [];
    const e = step.expect;
    const summary = nfc((body.pendingConfirmation?.summary ?? []).join(" | "));
    if (e.proposal) {
      if (!body.pendingConfirmation) problems.push("expected a proposal, got none");
      else for (const part of e.proposal) if (!summary.includes(nfc(part))) problems.push(`proposal lacks "${part}"`);
    }
    if (e.noExecution && (body.execution ?? []).some((row) => row.executed)) problems.push("'ok' executed an action");
    if (e.replyIncludes) for (const part of e.replyIncludes) if (!nfc(body.reply).includes(part)) problems.push(`reply lacks "${part}"`);
    if (JSON.stringify(Object.entries(cart.lines).sort()) !== JSON.stringify(Object.entries(e.cart).map(([k, v]) => [nfc(k), v]).sort()))
      problems.push(`cart ${JSON.stringify(cart.lines)} != expected ${JSON.stringify(e.cart)}`);
    if (e.total !== undefined && cart.total !== e.total) problems.push(`total ${cart.total} != ${e.total}`);
    if (body.pendingConfirmation) pending = body.pendingConfirmation;
    else if (step.confirm) pending = null;
    results.push({ step: index + 1, input: step.confirm ? "[xác nhận]" : step.say, model: !!step.model, latencyMs, pass: problems.length === 0, problems,
      reply: body.reply, proposal: body.pendingConfirmation?.summary ?? null, actions: body.actions, cart: cart.lines, total: cart.total });
    console.log(`${String(index + 1).padStart(2)} ${problems.length ? "✗" : "✓"} ${String(latencyMs).padStart(5)}ms ${(step.confirm ? "[xác nhận]" : step.say).padEnd(30)} | ${nfc(body.reply).slice(0, 90)}${summary ? "  [" + summary + "]" : ""}${problems.length ? "\n     ! " + problems.join("; ") : ""}`);
  }
  const passed = results.filter((r) => r.pass).length;
  const out = path.join(root, "output/evaluation");
  fs.mkdirSync(out, { recursive: true });
  const file = path.join(out, `agentcore-flow-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(file, JSON.stringify({ runId, userId, runtimeArn: args.arn, invocations, passed, total: STEPS.length, results }, null, 2) + "\n");
  console.log(`\n${passed}/${STEPS.length} steps passed, ${invocations} model invocations, customer ${userId}\nReport: ${path.relative(root, file)}`);
  fs.rmSync(dir, { recursive: true, force: true });
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
