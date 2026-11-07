/* eslint-disable @typescript-eslint/no-require-imports -- Standalone offline evaluation. */
require("./register-typescript.cjs");
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const {
  MockLLMProvider,
} = require("../src/lib/agent/providers/mock-llm-provider.ts");
const dataset = fs.readFileSync(
  path.join(__dirname, "../tests/data/intent-cases.vi.json"),
);
const cases = JSON.parse(dataset);
const provider = new MockLLMProvider();
const digest = (value) => createHash("sha256").update(value).digest("hex");
async function main() {
  for (let warmup = 0; warmup < 5; warmup++)
    await provider.generateResponse("", "Xin chào");
  const results = [];
  for (const example of cases) {
    const started = performance.now();
    const result = await provider.generateResponse(
      "",
      `USER_MESSAGE_JSON:${JSON.stringify(example.message)}`,
    );
    const milliseconds = performance.now() - started;
    if (!result.success)
      throw new Error(
        `Provider failed on ${example.id}: ${result.error.message}`,
      );
    const action = result.response.actions[0];
    const actualAction = action?.type ?? "NONE";
    const actualQuantity = action?.parameters.quantity;
    results.push({
      ...example,
      actualAction,
      actualQuantity,
      correctIntent: actualAction === example.expectedAction,
      correctQuantity:
        example.expectedQuantity === undefined ||
        actualQuantity === example.expectedQuantity,
      milliseconds,
    });
  }
  const score = (items) => ({
    total: items.length,
    intentCorrect: items.filter((item) => item.correctIntent).length,
    jointCorrect: items.filter(
      (item) => item.correctIntent && item.correctQuantity,
    ).length,
    intentAccuracy:
      items.filter((item) => item.correctIntent).length /
      Math.max(items.length, 1),
    jointAccuracy:
      items.filter((item) => item.correctIntent && item.correctQuantity)
        .length / Math.max(items.length, 1),
  });
  const labels = [...new Set(cases.map((example) => example.expectedAction))];
  const perIntent = labels.map((label) => {
    const tp = results.filter(
      (row) => row.expectedAction === label && row.actualAction === label,
    ).length;
    const fp = results.filter(
      (row) => row.expectedAction !== label && row.actualAction === label,
    ).length;
    const fn = results.filter(
      (row) => row.expectedAction === label && row.actualAction !== label,
    ).length;
    const precision = tp / Math.max(tp + fp, 1);
    const recall = tp / Math.max(tp + fn, 1);
    return {
      label,
      tp,
      fp,
      fn,
      precision,
      recall,
      f1:
        precision + recall
          ? (2 * precision * recall) / (precision + recall)
          : 0,
    };
  });
  const timings = results.map((row) => row.milliseconds).sort((a, b) => a - b);
  const parserSources = [
    "src/lib/agent/providers/mock-llm-provider.ts",
    "src/lib/agent/providers/mock-message.ts",
    "src/lib/services/menu-service.ts",
  ].map((file) => ({
    path: file,
    sha256: digest(fs.readFileSync(path.join(__dirname, "..", file))),
  }));
  const report = {
    parserSources,
    parserSha256: digest(JSON.stringify(parserSources)),
    evaluatorSha256: digest(fs.readFileSync(__filename)),
    datasetUse:
      "Known development dataset: cases were inspected during implementation; not independent generalization evidence",
    generatedAt: new Date().toISOString(),
    runtime: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    datasetSha256: digest(dataset),
    providerSha256: digest(
      fs.readFileSync(
        path.join(__dirname, "../src/lib/agent/providers/mock-llm-provider.ts"),
      ),
    ),
    provider: "mock",
    scope:
      "Intent plus Arabic and Vietnamese number-word quantity extraction only; no Bedrock, HTTP, product resolution or policy execution measured.",
    overall: score(results),
    supported: score(results.filter((row) => row.subset === "supported")),
    challenge: score(results.filter((row) => row.subset === "challenge")),
    macroF1: perIntent.reduce((sum, row) => sum + row.f1, 0) / perIntent.length,
    perIntent,
    latencyMs: {
      p50: timings[Math.floor(timings.length * 0.5)],
      p95: timings[
        Math.min(timings.length - 1, Math.floor(timings.length * 0.95))
      ],
    },
    results,
  };
  const directory = path.join(__dirname, "../output/evaluation");
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(
    path.join(directory, "intent-report.json"),
    JSON.stringify(report, null, 2),
  );
  const percent = (value) => `${(value * 100).toFixed(1)}%`;
  const table = [
    "| Nhóm | Số câu | Đúng intent | Đúng intent + số lượng |",
    "|---|---:|---:|---:|",
    ...[
      ["Toàn bộ", report.overall],
      ["Trong phạm vi hỗ trợ", report.supported],
      ["Thử thách ngoài mẫu", report.challenge],
    ].map(
      ([name, value]) =>
        `| ${name} | ${value.total} | ${percent(value.intentAccuracy)} | ${percent(value.jointAccuracy)} |`,
    ),
  ];
  const failed = results.filter(
    (row) => !row.correctIntent || !row.correctQuantity,
  );
  const markdown = `# Kết quả đánh giá parser offline\n\nThời điểm: ${report.generatedAt}. Provider: mock. Node ${process.version}, ${process.platform}/${process.arch}.\n\n${table.join("\n")}\n\nMacro F1 intent: ${report.macroF1.toFixed(4)}. Latency parser trong bộ nhớ: p50 ${report.latencyMs.p50.toFixed(3)} ms, p95 ${report.latencyMs.p95.toFixed(3)} ms. Đây không phải latency HTTP/Bedrock/production.\n\nDataset tự xây dựng, không có người tham gia khảo sát; nhóm supported theo các cấu trúc được công bố, nhóm challenge ghi nhận giới hạn thực tế. Không dùng kết quả này để kết luận chất lượng LLM hoặc tổng quát hoá cho mọi câu tiếng Việt. Phép đo không kiểm tra tìm đúng món hay thực thi policy; các phần đó được kiểm tra riêng bằng test nghiệp vụ và HTTP.\n\nDataset SHA256: ${report.datasetSha256}\n\nProvider SHA256: ${report.providerSha256}\n\n## Các ca chưa đạt\n\n${failed.map((row) => `- ${row.id}: “${row.message}” — kỳ vọng ${row.expectedAction}${row.expectedQuantity === undefined ? "" : ` (${row.expectedQuantity})`}, nhận ${row.actualAction}${row.actualQuantity === undefined ? "" : ` (${row.actualQuantity})`}.`).join("\n") || "Không có trong bộ dữ liệu này."}\n\nChạy lại: npm run evaluate. Báo cáo từng ca: output/evaluation/intent-report.json.\n`;
  const rendered =
    markdown +
    "\n## Phạm vi so sánh và tái lập\n\nBộ 50 câu đã được xem và dùng trong quá trình phát triển; kết quả tăng không phải kiểm định độc lập hay đánh giá người dùng thật. Nhãn và subset giữ nguyên, không sửa ca lỗi tương đối để tăng điểm. Mốc trước parser v2 giữ riêng trong tests/baselines/intent-report-before-parser-v2.json và docs/graduation/evaluation-baseline-before-parser-v2.md. Bộ 61 câu language-safety là hồi quy tổng hợp, không phải holdout.\n\nParser aggregate SHA256: " +
    report.parserSha256 +
    "\n\n" +
    parserSources
      .map((entry) => "- " + entry.path + ": " + entry.sha256)
      .join("\n") +
    "\n\nEvaluator SHA256: " +
    report.evaluatorSha256 +
    "\n";
  fs.writeFileSync(path.join(directory, "intent-report.md"), rendered);
  if (process.argv.includes("--write-docs"))
    fs.writeFileSync(
      path.join(__dirname, "../docs/graduation/evaluation-results.md"),
      rendered,
    );
  if (report.supported.jointAccuracy < 1) process.exitCode = 1;
  console.log(
    JSON.stringify(
      {
        overall: report.overall,
        supported: report.supported,
        challenge: report.challenge,
        macroF1: report.macroF1,
        output: "output/evaluation/intent-report.json",
      },
      null,
      2,
    ),
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
