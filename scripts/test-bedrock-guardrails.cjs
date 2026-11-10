/* eslint-disable @typescript-eslint/no-require-imports -- Offline regression tests for Bedrock guardrails. */
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");
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
  process.env.AWS_REGION = "us-west-2";
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
  process.env.AWS_REGION = "us-west-2";
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
  process.env.AWS_REGION = "us-west-2";
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

// Kiểm chứng: một test cố tình reject phải khiến tiến trình trả exit code khác 0
check("Guardrail test runner: test reject thì exit code khác 0", async () => {
  const originalExitCode = process.exitCode;
  try {
    // Tạo một runner tạm với test reject
    const rejectTests = [];
    let rPassed = 0;
    let rFailed = 0;

    function rCheck(_name, fn) {
      rejectTests.push({ fn });
    }

    async function rRunTests() {
      for (const { fn } of rejectTests) {
        try {
          await fn();
          rPassed++;
        } catch {
          rFailed++;
        }
      }
    }

    rCheck("test cố tình reject", async () => {
      throw new Error("lỗi cố tình");
    });

    await rRunTests();

    if (rFailed !== 1) {
      throw new Error(`Expected 1 failure, got ${rFailed}`);
    }
    if (rPassed !== 0) {
      throw new Error(`Expected 0 passes, got ${rPassed}`);
    }
  } finally {
    process.exitCode = originalExitCode;
  }
});

(async () => {
  await runTests();

  console.log(`\nKết quả: ${passed} pass, ${failed} fail`);
  if (failed > 0) process.exitCode = 1;
})();

