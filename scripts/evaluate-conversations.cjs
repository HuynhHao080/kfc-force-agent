/* eslint-disable @typescript-eslint/no-require-imports -- Multi-turn conversation evaluation of the tool-use agent (paid Bedrock inference unless --dry-run). */
// Usage:
//   node scripts/evaluate-conversations.cjs --dry-run
//   node scripts/evaluate-conversations.cjs --approve-invocations 120 [--only CV-01,CV-03]
// Needs AWS credentials (AWS_PROFILE) and BEDROCK_MODEL_ID for a real run.
// Runs every conversation through the real pipeline (ChatService → ToolAgent →
// Bedrock → PolicyEngine → cart) on a fresh local data directory, so runs never
// touch demo data or each other. The approved number of model calls is a hard
// ceiling: it becomes BEDROCK_DAILY_REQUEST_LIMIT of that fresh directory, and a
// turn is not started when fewer than 4 calls (one full turn) remain.
// Reports (synthetic users only) go to output/evaluation/ (git-ignored).
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");

const root = path.resolve(__dirname, "..");
const MAX_CALLS_PER_TURN = 4;

function parseArgs(argv) {
  const args = { approve: 0, dryRun: false, only: null, dataset: path.join(root, "tests/data/agent-conversations/conversations.vi.json") };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--approve-invocations") args.approve = Number(argv[++i]);
    else if (argv[i] === "--dry-run") args.dryRun = true;
    else if (argv[i] === "--only") args.only = new Set(argv[++i].split(",").map((s) => s.trim()));
    else if (argv[i] === "--dataset") args.dataset = path.resolve(argv[++i]);
    else throw new Error("Unknown argument: " + argv[i]);
  }
  if (!args.dryRun && (!Number.isInteger(args.approve) || args.approve < MAX_CALLS_PER_TURN || args.approve > 300))
    throw new Error(`--approve-invocations must be ${MAX_CALLS_PER_TURN}..300 (approved Haiku calls for this run).`);
  if (!args.dryRun && !process.env.BEDROCK_MODEL_ID) throw new Error("Set BEDROCK_MODEL_ID (and AWS_PROFILE/AWS_REGION) for a real run.");
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "kfc-conv-eval-"));
  Object.assign(process.env, {
    PERSISTENCE_DRIVER: "local", LOCAL_DATA_DIR: dataDir, KFC_PURCHASE_ASSISTANT: "1",
    SESSION_SECRET: "synthetic-conversation-eval-secret-" + crypto.randomUUID(),
    ...(args.dryRun
      ? { AI_PROVIDER: "mock", KFC_AGENT_MODE: "" }
      : { AI_PROVIDER: "bedrock", KFC_AGENT_MODE: "tools", BEDROCK_DAILY_REQUEST_LIMIT: String(args.approve) }),
  });
  require("./register-typescript.cjs");
  const { services } = require("../src/lib/agent/agent-core.ts");
  const { checkReply } = require("../src/lib/agent/tool-agent/reply-guard.ts");
  const { validateDataset, scoreTurn, fold } = require("./conversation-eval-core.cjs");

  const dataset = JSON.parse(fs.readFileSync(args.dataset, "utf8"));
  // Bring the fresh catalog to the state the dataset was written against (items KFC has removed).
  for (const name of dataset.catalogState?.retired ?? []) {
    const item = (await services.menuService.getMenuItems()).find((i) => fold(i.name) === fold(name));
    if (item && item.isActive)
      await services.adminService.saveMenu({ name: item.name, description: item.description ?? "", categoryId: item.categoryId,
        price: item.price, isActive: false, isAvailable: false, imageUrl: item.imageUrl }, item.id);
  }
  const [items, categories] = await Promise.all([services.menuService.getMenuItems(), services.menuService.getCategories()]);
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const catalog = items.map((i) => ({ id: i.id, name: i.name, price: i.price, isActive: i.isActive, isAvailable: i.isAvailable }));
  const facts = items.map((i) => ({ id: i.id, name: i.name, price: i.price, available: i.isActive && i.isAvailable,
    retired: !i.isActive, category: categoryName.get(i.categoryId) }));

  const problems = validateDataset(dataset, catalog);
  if (problems.length) throw new Error("Dataset invalid:\n  " + problems.join("\n  "));
  const conversations = dataset.conversations.filter((cv) => !args.only || args.only.has(cv.id));
  const turns = conversations.reduce((n, cv) => n + cv.turns.filter((t) => t.user).length, 0);
  console.log(`${conversations.length} conversations, ${turns} customer turns (+ ${conversations.reduce((n, cv) => n + cv.turns.filter((t) => t.confirm).length, 0)} button confirmations).`);
  if (args.dryRun) {
    console.log(`Dataset valid against the catalog (${catalog.filter((i) => i.isActive).length} items on sale). Worst case ${turns * MAX_CALLS_PER_TURN} model calls; typical 2–3 per turn.`);
    return;
  }

  const usageFile = path.join(dataDir, "bedrock-usage.json");
  const used = () => { try { return JSON.parse(fs.readFileSync(usageFile, "utf8")).used ?? 0; } catch { return 0; } };
  const runId = crypto.randomUUID().slice(0, 8);
  const results = [];
  let stopped = false;
  for (const cv of conversations) {
    const userId = `eval-${runId}-${cv.id.toLowerCase()}`;
    const sessionId = userId;
    let pending = null;
    const turnResults = [];
    for (const [index, turn] of cv.turns.entries()) {
      if (stopped || (turn.user && args.approve - used() < MAX_CALLS_PER_TURN)) {
        stopped = true;
        turnResults.push({ index: index + 1, notRun: true });
        continue;
      }
      const before = used();
      const started = Date.now();
      let response;
      try {
        response = turn.confirm
          ? pending
            ? await services.chatService.processChat({ platform: "web", userId, sessionId, message: "Xác nhận", confirm: true, confirmationId: pending.id })
            : { error: "không có đề xuất để xác nhận" }
          : await services.chatService.processChat({ platform: "web", userId, sessionId, message: turn.user });
      } catch (failure) {
        response = { error: failure instanceof Error ? `${failure.name}: ${failure.message}` : "unknown" };
      }
      pending = response?.requiresConfirmation ? response.pendingConfirmation : turn.confirm ? null : pending;
      const view = await services.cartService.getCartView(userId);
      const cart = (view?.items ?? []).map((l) => ({ name: l.nameSnapshot, quantity: l.quantity }));
      const score = scoreTurn({ turn, response, cart, cartTotal: view?.cart?.total ?? 0, catalog,
        guard: (reply) => checkReply(reply, { catalog: facts }) });
      turnResults.push({
        index: index + 1, user: turn.user ?? "[bấm Xác nhận thao tác]", reply: response?.reply ?? response?.error,
        proposal: response?.requiresConfirmation ? response.pendingConfirmation?.summary : null,
        products: (response?.products ?? []).map((p) => p.name), cart,
        modelCalls: used() - before, latencyMs: Date.now() - started, pass: score.pass,
        failed: score.checks.filter((c) => !c.ok),
      });
      const mark = score.pass ? "PASS" : "FAIL";
      console.log(`${cv.id}#${index + 1} ${mark} ${String(used() - before)}c ${turn.user ?? "[xác nhận]"}`);
      for (const c of score.checks.filter((c) => !c.ok)) console.log(`    ✗ ${c.name}: ${c.detail}`);
    }
    results.push({ id: cv.id, family: cv.family, title: cv.title, pass: turnResults.every((t) => t.pass), turns: turnResults });
  }

  const ran = results.flatMap((r) => r.turns).filter((t) => !t.notRun);
  const complete = results.filter((r) => r.turns.every((t) => !t.notRun));
  const families = {};
  for (const r of complete) { const f = (families[r.family] ??= { pass: 0, total: 0 }); f.total++; if (r.pass) f.pass++; }
  const summary = {
    turnsPassed: ran.filter((t) => t.pass).length, turnsRun: ran.length,
    conversationsPassed: complete.filter((r) => r.pass).length, conversationsComplete: complete.length,
    notRun: results.flatMap((r) => r.turns).filter((t) => t.notRun).length,
    modelCalls: used(), approved: args.approve, families,
  };
  console.log("\nSummary:", JSON.stringify(summary));
  const outDir = path.join(root, "output", "evaluation");
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `conversations-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(file, JSON.stringify({ runId, datasetVersion: dataset.version, datasetStatus: dataset.status,
    model: process.env.BEDROCK_MODEL_ID, summary, results }, null, 2) + "\n");
  console.log("Report:", path.relative(root, file));
  fs.rmSync(dataDir, { recursive: true, force: true });
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
