/* eslint-disable @typescript-eslint/no-require-imports -- Offline regression tests for Bedrock guardrails. */
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const ROOT = path.resolve(__dirname, "..");
require("./register-typescript.cjs");

const { BedrockService } = require("../src/lib/aws/bedrock.ts");
const { reserveBedrockInvocation } = require("../src/lib/aws/invocation-budget.ts");

let passed = 0;
let failed = 0;
const tests = [];

function check(name, fn) {
  tests.push({ name, fn });
}

async function runTests() {
  for (const { name, fn } of tests) {
    try {
      await fn();
      passed++;
      console.log(`PASS: ${name}`);
    } catch (error) {
      failed++;
      console.error(`FAIL: ${name} — ${error.message}`);
    }
  }
}

// Helper: tạo BedrockService với config tuỳ chỉnh.
// injectedClient = false → không inject client, sẽ validate AWS_REGION trước khi tạo SDK thật.
// injectedClient = {}  → inject mock object rỗng, dùng để test lỗi SDK transport.
function makeService(configOverrides = {}, injectedClient = false) {
  const config = {
    modelId: "us.anthropic.claude-haiku-4-5-20251001-v1:0",
    maxTokens: 512,
    temperature: 0.1,
    ...configOverrides,
  };
  return new BedrockService(config, injectedClient ? {} : undefined);
}

// P0: Thiếu AWS_REGION → fail-closed
check("BedrockService: thiếu AWS_REGION thì validation_error", async () => {
  const prevRegion = process.env.AWS_REGION;
  delete process.env.AWS_REGION;
  try {
    const svc = makeService({ modelId: "us.anthropic.claude-haiku-4-5-20251001-v1:0" });
    const result = await svc.generateResponse("system", "user");
    assert.equal(result.success, false);
    assert.equal(result.error.type, "validation_error");
    assert.ok(result.error.message.includes("AWS_REGION"));
  } finally {
    if (prevRegion === undefined) delete process.env.AWS_REGION;
    else process.env.AWS_REGION = prevRegion;
  }
});

// P0: Thiếu BEDROCK_MODEL_ID → fail-closed
check("BedrockService: thiếu BEDROCK_MODEL_ID thì validation_error", async () => {
  const prevRegion = process.env.AWS_REGION;
  process.env.AWS_REGION = "ap-southeast-1";
  try {
    const svc = makeService({ modelId: "" });
    const result = await svc.generateResponse("system", "user");
    assert.equal(result.success, false);
    assert.equal(result.error.type, "validation_error");
    assert.ok(result.error.message.includes("BEDROCK_MODEL_ID"));
  } finally {
    if (prevRegion === undefined) delete process.env.AWS_REGION;
    else process.env.AWS_REGION = prevRegion;
  }
});

// P0: modelId = "mock-model" → fail-closed
check("BedrockService: modelId 'mock-model' thì validation_error", async () => {
  const prevRegion = process.env.AWS_REGION;
  process.env.AWS_REGION = "ap-southeast-1";
  try {
    const svc = makeService({ modelId: "mock-model" });
    const result = await svc.generateResponse("system", "user");
    assert.equal(result.success, false);
    assert.equal(result.error.type, "validation_error");
  } finally {
    if (prevRegion === undefined) delete process.env.AWS_REGION;
    else process.env.AWS_REGION = prevRegion;
  }
});

// P0: Không tự fallback sang mock khi Bedrock lỗi (sau khi validation pass)
check("BedrockService: SDK lỗi thì trả về bedrock_error, không fallback mock", async () => {
  const prevRegion = process.env.AWS_REGION;
  process.env.AWS_REGION = "ap-southeast-1";
  try {
    const svc = new BedrockService(
      { modelId: "us.anthropic.claude-haiku-4-5-20251001-v1:0" },
      { send: async () => { throw new Error("fixture transport failed"); } }
    );
    const result = await svc.generateResponse("system", "user");
    assert.equal(result.success, false);
    assert.equal(result.error.type, "bedrock_error");
  } finally {
    if (prevRegion === undefined) delete process.env.AWS_REGION;
    else process.env.AWS_REGION = prevRegion;
  }
});

// P1: InvocationBudget limit = 0 → tắt inference
check("Haiku 5.5: model-only configuration uses the selected profile and disables thinking", async () => {
  let calls = 0;
  const modelId = "global.anthropic.claude-haiku-5-5";
  const client = { send: async command => {
    calls++;
    assert.equal(command.input.modelId, modelId);
    const body = JSON.parse(Buffer.from(command.input.body).toString("utf8"));
    assert.deepEqual(body.thinking, { type: "disabled" });
    assert.equal(body.temperature, undefined);
    assert.equal(body.top_p, undefined);
    assert.equal(body.max_tokens, 512);
    assert.equal(body.messages[0].content[0].text, "Thêm 2 Pepsi 1.5L");
    return { body: Buffer.from(JSON.stringify({
      content: [{ type: "text", text: "fixture response" }],
      usage: { input_tokens: 10, output_tokens: 5 },
    })) };
  } };
  const result = await new BedrockService({ modelId }, client).generateResponse("system", "Thêm 2 Pepsi 1.5L");
  assert.equal(result.success, true);
  assert.deepEqual(result.response.usage, { inputTokens: 10, outputTokens: 5 });
  assert.equal(calls, 1);
});

check("Haiku 5.5: unsupported settings fail before transport", async () => {
  let calls = 0;
  const client = { send: async () => { calls++; throw new Error("Must not invoke"); } };
  for (const settings of [{ temperature: 0.1 }, { topP: 0.1 }, { thinking: { type: "adaptive" } }, { maxTokens: 2049 }]) {
    const result = await new BedrockService({ modelId: "global.anthropic.claude-haiku-5-5", ...settings }, client)
      .generateResponse("system", "user");
    assert.equal(result.success, false);
    assert.equal(result.error.type, "validation_error");
  }
  assert.equal(calls, 0);
});

check("Canary: model selection is explicit and unknown profiles are rejected", () => {
  const { parseArgs } = require("./aws-canary.cjs");
  assert.equal(parseArgs([]).model, "global.anthropic.claude-haiku-5-5");
  assert.equal(parseArgs([]).region, "ap-southeast-1");
  assert.throws(() => parseArgs(["--region", "us-west-2"]));
  const profile = "us.anthropic.claude-haiku-4-5-20251001-v1:0";
  assert.equal(parseArgs(["--model", profile]).model, profile);
  assert.equal(parseArgs(["--model", profile]).invoke, false);
  assert.throws(() => parseArgs(["--model", "unreviewed-model"]));
  assert.throws(() => parseArgs(["--model", profile, "--invoke"]));
});

check("LLM evaluation: distinct cases, explicit paid-run approval and error-inclusive metrics", () => {
  const { validateDataset, summarize, parseArgs } = require("./evaluate-llm.cjs");
  const cases = JSON.parse(fs.readFileSync(path.join(ROOT, "tests/data/llm-evaluation.vi.json")));
  const development = JSON.parse(fs.readFileSync(path.join(ROOT, "tests/data/intent-cases.vi.json")));
  assert.equal(validateDataset(cases, development).length, 24);
  const duplicate = structuredClone(cases);
  duplicate[1].id = duplicate[0].id;
  assert.throws(() => validateDataset(duplicate, development));
  const overlap = structuredClone(cases);
  overlap[0].message = development[0].message;
  assert.throws(() => validateDataset(overlap, development));
  assert.equal(parseArgs([]).invoke, false);
  assert.throws(() => parseArgs(["--invoke"]));
  assert.throws(() => parseArgs(["--unexpected", "value"]));
  assert.deepEqual(summarize([]), { attempted: 0, intentCorrect: 0, jointCorrect: 0, intentAccuracy: null, jointAccuracy: null });
  const score = summarize([
    { expectedAction: "ADD_TO_CART", actualAction: "ADD_TO_CART", expectedQuantity: 4, actualQuantity: 4 },
    { expectedAction: "ADD_TO_CART", actualAction: "ADD_TO_CART", expectedQuantity: 4, actualQuantity: 2 },
    { expectedAction: "UNKNOWN", actualAction: "INVALID" },
  ]);
  assert.equal(score.attempted, 3);
  assert.equal(score.intentCorrect, 2);
  assert.equal(score.jointCorrect, 1);
  assert.equal(score.jointAccuracy, 1 / 3);
});

check("Deployment target: Singapore settings are consistent and stale regional targets are rejected", () => {
  const { loadTarget } = require("./aws-deploy.cjs");
  const target = loadTarget(path.join(ROOT, "infra/aws/target.example.json"));
  assert.equal(target.region, "ap-southeast-1");
  assert.equal(target.cloudFrontPrefixListId, "pl-31a34658");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "kfc-region-test-"));
  try {
    const filename = path.join(directory, "target.json");
    fs.writeFileSync(filename, JSON.stringify({ ...target, region: "us-west-2" }));
    assert.throws(() => loadTarget(filename));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

check("InvocationBudget: limit 0 thì ném lỗi tắt inference", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kfc-budget-test-"));
  const prevLimit = process.env.BEDROCK_DAILY_REQUEST_LIMIT;
  const prevDataDir = process.env.LOCAL_DATA_DIR;
  try {
    process.env.BEDROCK_DAILY_REQUEST_LIMIT = "0";
    process.env.LOCAL_DATA_DIR = tmpDir;
    assert.throws(() => reserveBedrockInvocation(tmpDir), /Bedrock inference is disabled/);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    if (prevLimit === undefined) delete process.env.BEDROCK_DAILY_REQUEST_LIMIT;
    else process.env.BEDROCK_DAILY_REQUEST_LIMIT = prevLimit;
    if (prevDataDir === undefined) delete process.env.LOCAL_DATA_DIR;
    else process.env.LOCAL_DATA_DIR = prevDataDir;
  }
});

// P1: InvocationBudget vượt ngân sách → lỗi
check("InvocationBudget: vượt limit thì ném lỗi", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kfc-budget-test-"));
  const prevLimit = process.env.BEDROCK_DAILY_REQUEST_LIMIT;
  const prevDataDir = process.env.LOCAL_DATA_DIR;
  try {
    process.env.BEDROCK_DAILY_REQUEST_LIMIT = "1";
    process.env.LOCAL_DATA_DIR = tmpDir;
    // Lần đầu thành công
    const first = reserveBedrockInvocation(tmpDir);
    assert.equal(first.used, 1);
    // Lần thứ hai vượt limit
    assert.throws(() => reserveBedrockInvocation(tmpDir), /ceiling has been reached/);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    if (prevLimit === undefined) delete process.env.BEDROCK_DAILY_REQUEST_LIMIT;
    else process.env.BEDROCK_DAILY_REQUEST_LIMIT = prevLimit;
    if (prevDataDir === undefined) delete process.env.LOCAL_DATA_DIR;
    else process.env.LOCAL_DATA_DIR = prevDataDir;
  }
});

// P1: Không ghi prompt, secrets hoặc credentials vào log (kiểm tra source không có console.log với sensitive data)
check("Guardrails: không có console.log ghi prompt/credentials", () => {
  const bedrockSrc = fs.readFileSync(path.join(ROOT, "src/lib/aws/bedrock.ts"), "utf8");
  const budgetSrc = fs.readFileSync(path.join(ROOT, "src/lib/aws/invocation-budget.ts"), "utf8");
  const sensitivePatterns = [/console\.log/, /process\.env\.AWS_SECRET/, /process\.env\.SESSION_SECRET/];
  for (const src of [bedrockSrc, budgetSrc]) {
    for (const pat of sensitivePatterns) {
      assert.ok(!pat.test(src), `Source chứa pattern nhạy cảm: ${pat}`);
    }
  }
});

// Kiểm tra source không ghi prompt/customer data vào log (bên ngoài check để báo lỗi rõ ràng)
check("Guardrails: không ghi prompt vào log", () => {
  const bedrockSrc = fs.readFileSync(path.join(ROOT, "src/lib/aws/bedrock.ts"), "utf8");
  assert.ok(!/console\.log\(.*prompt/.test(bedrockSrc), "Không được ghi prompt vào console.log");
});

// Khi biến môi trường này được đặt, thêm một test cố tình reject để
// kiểm chứng tiến trình con thoát với mã khác 0.
if (process.env.BEDROCK_TEST_REJECT === "1") {
  check("test cố tình reject (môi trường kiểm tra)", async () => {
    throw new Error("lỗi cố tình");
  });
}

// Kiểm chứng: một test cố tình reject phải khiến tiến trình con trả exit code khác 0
// Bỏ qua khi đang chạy trong tiến trình con reject để tránh infinite recursion
if (process.env.BEDROCK_TEST_REJECT !== "1") {
  check("Guardrail test runner: test reject thì tiến trình con exit code khác 0", () => {
    const originalEnv = {
      AWS_REGION: process.env.AWS_REGION,
      BEDROCK_DAILY_REQUEST_LIMIT: process.env.BEDROCK_DAILY_REQUEST_LIMIT,
      LOCAL_DATA_DIR: process.env.LOCAL_DATA_DIR,
      BEDROCK_TEST_REJECT: process.env.BEDROCK_TEST_REJECT,
    };
    try {
      process.env.BEDROCK_TEST_REJECT = "1";
      const result = spawnSync(process.execPath, [__filename], {
        env: { ...process.env },
        encoding: "utf8",
        timeout: 30000,
      });
      assert.ok(result.status !== null, "Tiến trình con không thoát bình thường");
      assert.equal(result.status, 1, `Expected exit code 1, got ${result.status}`);
    } finally {
      process.env.AWS_REGION = originalEnv.AWS_REGION;
      process.env.BEDROCK_DAILY_REQUEST_LIMIT = originalEnv.BEDROCK_DAILY_REQUEST_LIMIT;
      process.env.LOCAL_DATA_DIR = originalEnv.LOCAL_DATA_DIR;
      process.env.BEDROCK_TEST_REJECT = originalEnv.BEDROCK_TEST_REJECT;
    }
  });
}

(async () => {
  await runTests();

  console.log(`\nKết quả: ${passed} pass, ${failed} fail`);
  if (failed > 0) process.exitCode = 1;
})();

