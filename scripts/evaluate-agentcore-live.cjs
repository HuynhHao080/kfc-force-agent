/* eslint-disable @typescript-eslint/no-require-imports -- Bounded live evaluation of the deployed AgentCore runtime (paid Bedrock inference). */
// Usage:
//   node scripts/evaluate-agentcore-live.cjs --runtime-arn <arn> --approve-invocations 20 [--run-id <uuid>] [--dry-run]
// Each case = one InvokeAgentRuntime call with a fresh customer = one Haiku call.
// The script refuses to exceed --approve-invocations and stops on the first
// transport error. Raw replies and scores go to output/evaluation/ (git-ignored).
// Scoring is automatic against tests/data/understanding/natural-language.vi.json
// labels; it measures the deployed agent end-to-end (LLM + grounding + policy),
// not the LLM alone. Review the raw replies before quoting numbers.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const dataset = JSON.parse(fs.readFileSync(path.join(root, "tests/data/understanding/natural-language.vi.json"), "utf8"));

/** Fixed, reviewable selection: ids chosen to cover every behaviour family. */
const SELECTION = [
  "NL-005", "NL-004", "NL-008", "NL-042", "NL-043", // resolved add: teencode/alias, typo+size, English, long-winded, inverted order
  "NL-049", "NL-050", "NL-060",                     // ambiguous: pepsi, burger, egg tart
  "NL-064", "NL-065", "NL-066",                     // off-menu: coca, trà sữa, cánh gà
  "NL-097", "NL-099", "NL-100",                     // budget: dưới 50k, mình có 60 nghìn, từ 40k đến 60k
  "NL-076", "NL-083",                               // update / remove (empty cart: intent + target still observable)
  "NL-088", "NL-092",                               // clear cart, view cart
  "NL-126", "NL-123",                               // negation, out of scope
];

function parseArgs(argv) {
  const args = { approve: 0, dryRun: false, runId: crypto.randomUUID(), arn: process.env.AGENTCORE_RUNTIME_ARN ?? "" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--approve-invocations") args.approve = Number(argv[++i]);
    else if (argv[i] === "--runtime-arn") args.arn = argv[++i];
    else if (argv[i] === "--run-id") args.runId = argv[++i];
    else if (argv[i] === "--dry-run") args.dryRun = true;
    else throw new Error("Unknown argument: " + argv[i]);
  }
  if (!args.dryRun) {
    if (!Number.isInteger(args.approve) || args.approve < 1 || args.approve > 25) throw new Error("--approve-invocations must be 1..25 (daily Bedrock ceiling).");
    if (!/^arn:aws:bedrock-agentcore:[a-z0-9-]+:\d{12}:runtime\/[A-Za-z0-9_-]+$/.test(args.arn)) throw new Error("--runtime-arn is required.");
  }
  return args;
}

function invoke(arn, sessionId, payload, workDir) {
  const input = path.join(workDir, "payload.json");
  const output = path.join(workDir, "reply.json");
  fs.writeFileSync(input, JSON.stringify(payload), "utf8");
  const started = Date.now();
  execFileSync("aws", [
    "bedrock-agentcore", "invoke-agent-runtime", "--agent-runtime-arn", arn, "--runtime-session-id", sessionId,
    "--content-type", "application/json", "--payload", "fileb://" + input, output,
  ], { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, MSYS_NO_PATHCONV: "1" } });
  return { latencyMs: Date.now() - started, body: JSON.parse(fs.readFileSync(output, "utf8")) };
}

const norm = (s) => String(s ?? "").normalize("NFC").toLowerCase();

/** Scores one reply against its label. Every verdict carries the evidence used. */
function score(row, body) {
  const action = body.actions?.[0];
  const actual = action?.type ?? "NONE";
  const proposal = body.pendingConfirmation?.summary?.map(norm).join(" | ") ?? "";
  const reply = norm(body.reply);
  const exec = (body.execution ?? []).map((e) => norm(e.reason)).join(" | ");
  const verdict = { intent: actual === row.expectedAction, grounding: null, budget: null, noWrongCommit: true };
  const item = row.expectedItem;
  if (item) {
    const names = item.names.map(norm);
    if (item.status === "resolved") {
      verdict.grounding = body.requiresConfirmation === true && names.some((n) => proposal.includes(n));
      if (body.requiresConfirmation && !names.some((n) => proposal.includes(n))) verdict.noWrongCommit = false;
    } else if (item.status === "ambiguous") {
      // Correct: no commit to one SKU; either a clarification or a policy block listing options.
      verdict.grounding = body.requiresConfirmation !== true;
      if (body.requiresConfirmation) verdict.noWrongCommit = false;
    } else if (item.status === "not_found") {
      verdict.grounding = body.requiresConfirmation !== true && /không có|không tìm thấy|chưa có|không bán/.test(reply + " " + exec);
      if (body.requiresConfirmation) verdict.noWrongCommit = false;
    }
  }
  if (row.expectedPrice) {
    const p = action?.parameters ?? {};
    const want = row.expectedPrice;
    verdict.budget = (want.maxPrice === undefined || p.maxPrice === want.maxPrice) && (want.minPrice === undefined || p.minPrice === want.minPrice);
  }
  if (row.expectedQuantity !== undefined && action?.parameters?.quantity !== undefined)
    verdict.quantity = action.parameters.quantity === row.expectedQuantity;
  return { actual, verdict, proposal, replyExcerpt: String(body.reply ?? "").slice(0, 200) };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cases = SELECTION.map((id) => dataset.cases.find((c) => c.id === id) ?? (() => { throw new Error("Unknown case " + id); })());
  if (args.dryRun) {
    console.log(`${cases.length} cases selected (dry run, no invocation):`);
    for (const c of cases) console.log(`  ${c.id} [${c.expectedAction}] ${c.message}`);
    return;
  }
  if (cases.length > args.approve) throw new Error(`Selection has ${cases.length} cases but only ${args.approve} invocations were approved.`);
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "kfc-live-"));
  const results = [];
  let invocations = 0;
  for (const row of cases) {
    if (invocations >= args.approve) break;
    const userId = `live-${args.runId.slice(0, 8)}-${row.id.toLowerCase()}`;
    const sessionId = `kfc-live-${args.runId}-${row.id.toLowerCase()}-0001`;
    invocations++;
    let outcome;
    try {
      const { latencyMs, body } = invoke(args.arn, sessionId, { userId, message: row.message }, workDir);
      outcome = { ok: body.status === "success", latencyMs, ai: body.ai ?? null, ...score(row, body), raw: body };
    } catch (error) {
      outcome = { ok: false, error: String(error.stderr ?? error.message).slice(0, 300) };
      results.push({ id: row.id, message: row.message, expectedAction: row.expectedAction, ...outcome });
      console.error(`${row.id} transport error, stopping to protect the budget.`);
      break;
    }
    results.push({ id: row.id, message: row.message, expectedAction: row.expectedAction, expectedItem: row.expectedItem?.status, ...outcome });
    const v = outcome.verdict ?? {};
    console.log(`${row.id} ${outcome.ok ? "ok " : "ERR"} ${String(outcome.latencyMs ?? "").padStart(5)}ms intent=${v.intent ? "✓" : "✗"}(${outcome.actual}) ground=${v.grounding === null || v.grounding === undefined ? "-" : v.grounding ? "✓" : "✗"} budget=${v.budget == null ? "-" : v.budget ? "✓" : "✗"} | ${row.message}`);
  }
  const scored = results.filter((r) => r.ok);
  const count = (key) => scored.filter((r) => r.verdict[key] === true).length;
  const total = (key) => scored.filter((r) => r.verdict[key] !== null && r.verdict[key] !== undefined).length;
  const summary = {
    invocations, attempted: results.length, succeeded: scored.length,
    intent: { correct: count("intent"), total: scored.length },
    grounding: { correct: count("grounding"), total: total("grounding") },
    budget: { correct: count("budget"), total: total("budget") },
    wrongCommits: scored.filter((r) => r.verdict.noWrongCommit === false).length,
    medianLatencyMs: scored.length ? scored.map((r) => r.latencyMs).sort((a, b) => a - b)[Math.floor(scored.length / 2)] : null,
  };
  const dir = path.join(root, "output/evaluation");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `agentcore-live-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(file, JSON.stringify({ runId: args.runId, runtimeArn: args.arn, datasetVersion: dataset.version, reviewStatus: dataset.reviewStatus, selection: SELECTION, summary, results }, null, 2) + "\n");
  console.log(`\nSummary: intent ${summary.intent.correct}/${summary.intent.total}, grounding ${summary.grounding.correct}/${summary.grounding.total}, budget ${summary.budget.correct}/${summary.budget.total}, wrong commits ${summary.wrongCommits}, median ${summary.medianLatencyMs} ms, invocations ${invocations}`);
  console.log(`Report: ${path.relative(root, file)}`);
  fs.rmSync(workDir, { recursive: true, force: true });
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
