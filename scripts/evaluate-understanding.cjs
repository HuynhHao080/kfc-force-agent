/* eslint-disable @typescript-eslint/no-require-imports -- Offline understanding/grounding benchmark. No network, no paid inference. */
// Usage: node scripts/evaluate-understanding.cjs [--write] [--failures]
//   --write     save the full report under output/evaluation/
//   --failures  print every case the new module gets wrong
require("./offline-network-guard.cjs");
require("./register-typescript.cjs");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { catalogRecords } = require("../src/lib/catalog/kfc-catalog.ts");
const { normalizeVietnamese, matchesMenuQuery } = require("../src/lib/menu-search.ts");
const { MockLLMProvider } = require("../src/lib/agent/providers/mock-llm-provider.ts");
const { resolveMenuMention, rankMenuCandidates } = require("../src/lib/agent/understanding/menu-resolver.ts");
const { parsePriceConstraint } = require("../src/lib/agent/understanding/vietnamese-input.ts");

const root = path.resolve(__dirname, "..");
const args = new Set(process.argv.slice(2));
const datasetPath = path.join(root, "tests/data/understanding/natural-language.vi.json");
const snapshotPath = path.join(root, "src/lib/catalog/kfc-menu.snapshot.json");
const dataset = JSON.parse(fs.readFileSync(datasetPath, "utf8"));
const snapshotRaw = fs.readFileSync(snapshotPath);
const records = catalogRecords(JSON.parse(snapshotRaw));
const categoryName = Object.fromEntries(records.categories.map((c) => [c.id, c.name]));
const byId = new Map(records.items.map((i) => [i.id, i]));

// The dataset pins SKU IDs; a catalog refresh must not silently change their meaning.
const catalogHash = crypto.createHash("sha256").update(snapshotRaw).digest("hex");
for (const row of dataset.cases)
  for (const [ids, names] of [[row.expectedItem?.ids, row.expectedItem?.names], [row.soldOut?.ids, row.soldOut?.names]])
    (ids ?? []).forEach((id, i) => {
      if (byId.get(id)?.name !== names[i]) throw new Error(`${row.id}: ${id} is no longer "${names[i]}" in the catalog. Re-review the label.`);
    });

function menuFor(row) {
  const sold = new Set(row.soldOut?.ids ?? []);
  return records.items.map((item) => ({ ...item, isAvailable: item.isAvailable && !sold.has(item.id), categoryName: categoryName[item.categoryId] }));
}
// Frozen copy of the matching used before the understanding module was
// integrated (policy-engine findMenuMatches + catalog-context, commit 12def83),
// kept so the before/after comparison stays meaningful.
function legacyFindMenuMatches(query, menu) {
  const q = normalizeVietnamese(query);
  if (!q) return [];
  const items = menu.filter((i) => i.isActive && i.isAvailable);
  const exact = items.filter((i) => normalizeVietnamese(i.name) === q);
  return (exact.length ? exact : items.filter((i) => matchesMenuQuery(i, q))).sort((a, b) => a.id.localeCompare(b.id));
}
function legacyCatalogCandidates(message, menu) {
  const words = normalizeVietnamese(message).split(" ").filter((w) => w.length > 1);
  return menu
    .filter((i) => i.isActive && i.isAvailable)
    .map((item) => { const tokens = new Set(normalizeVietnamese(item.name).split(" ")); return { item, score: words.reduce((s, w) => s + Number(tokens.has(w)), 0) }; })
    .sort((a, b) => b.score - a.score || a.item.price - b.item.price || a.item.id.localeCompare(b.item.id))
    .slice(0, 12).map(({ item }) => item.id);
}

/** correct: matches the label. wrongCommit: the system would pick a SKU it should not (grounding error). */
function scoreItem(expected, got) {
  const ids = got.items.map((i) => i.id);
  const includesAll = expected.ids.every((id) => ids.includes(id));
  const excludes = (expected.excludeIds ?? []).every((id) => !ids.includes(id));
  const correct =
    expected.status === "resolved" ? got.status === "resolved" && ids[0] === expected.ids[0]
    : expected.status === "ambiguous" ? got.status === "ambiguous" && includesAll && excludes
    : expected.status === "not_found" ? got.status === "not_found"
    : got.status === "unavailable" && expected.ids.every((id) => got.unavailable.some((u) => u.id === id));
  const wrongCommit = got.status === "resolved" && !(expected.status === "resolved" && ids[0] === expected.ids[0]);
  return { correct, wrongCommit };
}

const PRICE_KEYS = ["maxPrice", "minPrice", "approximate", "perPerson"];
const priceView = (p) => Object.fromEntries(PRICE_KEYS.filter((k) => p?.[k] !== undefined).map((k) => [k, p[k]]));
const samePrice = (a, b) => JSON.stringify(priceView(a)) === JSON.stringify(priceView(b));

async function main() {
  const provider = new MockLLMProvider();
  const rows = [];
  for (const row of dataset.cases) {
    const menu = menuFor(row);
    const result = { id: row.id, message: row.message, tags: row.tags };

    // A. Intent + quantity: current offline parser (what CI/demo runs without Bedrock).
    const reply = await provider.generateResponse("", `USER_MESSAGE_JSON:${JSON.stringify(row.message)}`);
    const action = reply.success ? reply.response.actions[0] : undefined;
    result.intent = { expected: row.expectedAction, mock: action?.type ?? "NONE" };
    if (row.expectedQuantity !== undefined)
      result.quantity = { expected: row.expectedQuantity, mock: action?.parameters?.quantity };

    // B. Budget: mock parameters vs deterministic parser. Non-budget messages must yield no bound.
    const parsed = parsePriceConstraint(row.message);
    result.price = {
      expected: row.expectedPrice ?? {},
      mock: priceView(action?.parameters),
      module: priceView(parsed),
      labelled: row.expectedPrice !== undefined,
    };

    // C. Grounding: the customer's product phrase -> catalog SKU.
    if (row.expectedItem) {
      const matches = legacyFindMenuMatches(row.mention, menu);
      const baseline = { status: matches.length === 0 ? "not_found" : matches.length === 1 ? "resolved" : "ambiguous", items: matches, unavailable: [] };
      const modern = resolveMenuMention(row.mention, menu);
      result.item = {
        expected: row.expectedItem.status,
        baseline: { status: baseline.status, names: baseline.items.map((i) => i.name).slice(0, 6), ...scoreItem(row.expectedItem, baseline) },
        module: { status: modern.status, names: modern.items.map((i) => i.name).slice(0, 6), unavailable: modern.unavailable.map((i) => i.name), ...scoreItem(row.expectedItem, modern) },
      };

      // D. Model context: is the right SKU among what the model is shown?
      if (row.expectedItem.status === "resolved" || row.expectedItem.status === "ambiguous") {
        const shown = legacyCatalogCandidates(row.message, menu);
        const ranked = rankMenuCandidates(row.message, menu).items.map((c) => c.id);
        result.context = {
          baselineHit: row.expectedItem.ids.every((id) => shown.includes(id)),
          moduleHit: row.expectedItem.ids.every((id) => ranked.includes(id)),
        };
      } else if (row.expectedItem.status === "not_found") {
        const shown = legacyCatalogCandidates(row.message, menu).length ? [1] : [];
        const ranked = rankMenuCandidates(row.message, menu);
        result.context = { baselineSignalsNoMatch: shown.length === 0, moduleSignalsNoMatch: ranked.noMatch || ranked.unknownTokens.length > 0 };
      }
      // An off-menu warning on an in-menu request would confuse the model.
      if (result.context && "baselineHit" in result.context)
        result.context.moduleFalseUnknown = rankMenuCandidates(row.message, menu).unknownTokens;
    }
    rows.push(result);
  }

  const pct = (n, d) => (d ? `${((100 * n) / d).toFixed(1)}%` : "n/a");
  const count = (list, fn) => list.filter(fn).length;
  const itemRows = rows.filter((r) => r.item);
  const qtyRows = rows.filter((r) => r.quantity);
  const priceRows = rows.filter((r) => r.price.labelled);
  const nonPrice = rows.filter((r) => !r.price.labelled);
  const ctxRows = rows.filter((r) => r.context && "baselineHit" in r.context);
  const offMenu = rows.filter((r) => r.context && "baselineSignalsNoMatch" in r.context);
  const summary = {
    cases: rows.length,
    intentAccuracyMock: { correct: count(rows, (r) => r.intent.mock === r.intent.expected), total: rows.length },
    quantityAccuracyMock: { correct: count(qtyRows, (r) => r.quantity.mock === r.quantity.expected), total: qtyRows.length },
    priceAccuracy: {
      mock: { correct: count(priceRows, (r) => samePrice(r.price.mock, r.price.expected)), total: priceRows.length },
      module: { correct: count(priceRows, (r) => samePrice(r.price.module, r.price.expected)), total: priceRows.length },
      moduleFalsePositives: { count: count(nonPrice, (r) => Object.keys(r.price.module).length > 0), total: nonPrice.length },
    },
    itemGrounding: {
      baseline: { correct: count(itemRows, (r) => r.item.baseline.correct), wrongCommit: count(itemRows, (r) => r.item.baseline.wrongCommit), total: itemRows.length },
      module: { correct: count(itemRows, (r) => r.item.module.correct), wrongCommit: count(itemRows, (r) => r.item.module.wrongCommit), total: itemRows.length },
    },
    modelContextRecall12: {
      baseline: { hit: count(ctxRows, (r) => r.context.baselineHit), total: ctxRows.length },
      module: { hit: count(ctxRows, (r) => r.context.moduleHit), total: ctxRows.length },
    },
    offMenuSignalledAsNoMatch: {
      baseline: { count: count(offMenu, (r) => r.context.baselineSignalsNoMatch), total: offMenu.length },
      module: { count: count(offMenu, (r) => r.context.moduleSignalsNoMatch), total: offMenu.length },
      moduleFalseAlarms: { count: count(ctxRows, (r) => r.context.moduleFalseUnknown.length > 0), total: ctxRows.length },
    },
  };
  const tags = [...new Set(itemRows.flatMap((r) => r.tags))].sort();
  const byTag = Object.fromEntries(tags.map((tag) => {
    const list = itemRows.filter((r) => r.tags.includes(tag));
    return [tag, { total: list.length, baseline: count(list, (r) => r.item.baseline.correct), module: count(list, (r) => r.item.module.correct) }];
  }));

  const s = summary;
  console.log(`Understanding benchmark — ${s.cases} cases, review status: ${dataset.reviewStatus}. Offline only, no inference.\n`);
  console.log("Metric                                  Before (12def83)  After");
  const line = (label, a, b) => console.log(label.padEnd(40) + String(a).padEnd(16) + b);
  line("Intent (mock parser)", `${s.intentAccuracyMock.correct}/${s.intentAccuracyMock.total} ${pct(s.intentAccuracyMock.correct, s.intentAccuracyMock.total)}`, "(unchanged; LLM's job)");
  line("Quantity (mock parser)", `${s.quantityAccuracyMock.correct}/${s.quantityAccuracyMock.total} ${pct(s.quantityAccuracyMock.correct, s.quantityAccuracyMock.total)}`, "(unchanged)");
  line("Budget parsed correctly", `${s.priceAccuracy.mock.correct}/${s.priceAccuracy.mock.total} ${pct(s.priceAccuracy.mock.correct, s.priceAccuracy.mock.total)}`, `${s.priceAccuracy.module.correct}/${s.priceAccuracy.module.total} ${pct(s.priceAccuracy.module.correct, s.priceAccuracy.module.total)}`);
  line("Budget false positives (lower=better)", "-", `${s.priceAccuracy.moduleFalsePositives.count}/${s.priceAccuracy.moduleFalsePositives.total}`);
  line("Item grounded correctly", `${s.itemGrounding.baseline.correct}/${s.itemGrounding.baseline.total} ${pct(s.itemGrounding.baseline.correct, s.itemGrounding.baseline.total)}`, `${s.itemGrounding.module.correct}/${s.itemGrounding.module.total} ${pct(s.itemGrounding.module.correct, s.itemGrounding.module.total)}`);
  line("Wrong SKU picked (lower=better)", `${s.itemGrounding.baseline.wrongCommit}/${s.itemGrounding.baseline.total}`, `${s.itemGrounding.module.wrongCommit}/${s.itemGrounding.module.total}`);
  line("Right SKU in model context (top 12)", `${s.modelContextRecall12.baseline.hit}/${s.modelContextRecall12.baseline.total} ${pct(s.modelContextRecall12.baseline.hit, s.modelContextRecall12.baseline.total)}`, `${s.modelContextRecall12.module.hit}/${s.modelContextRecall12.module.total} ${pct(s.modelContextRecall12.module.hit, s.modelContextRecall12.module.total)}`);
  line("Off-menu flagged to the model", `${s.offMenuSignalledAsNoMatch.baseline.count}/${s.offMenuSignalledAsNoMatch.baseline.total}`, `${s.offMenuSignalledAsNoMatch.module.count}/${s.offMenuSignalledAsNoMatch.module.total}`);
  line("False off-menu alarms (lower=better)", "-", `${s.offMenuSignalledAsNoMatch.moduleFalseAlarms.count}/${s.offMenuSignalledAsNoMatch.moduleFalseAlarms.total}`);
  console.log("\nItem grounding by tag (current → new):");
  for (const [tag, v] of Object.entries(byTag)) console.log(`  ${tag.padEnd(16)} ${String(v.baseline).padStart(3)} → ${String(v.module).padEnd(3)} of ${v.total}`);

  const failures = itemRows.filter((r) => !r.item.module.correct)
    .map((r) => ({ id: r.id, message: r.message, expected: r.item.expected, got: r.item.module.status, names: r.item.module.names }))
    .concat(priceRows.filter((r) => !samePrice(r.price.module, r.price.expected))
      .map((r) => ({ id: r.id, message: r.message, expected: r.price.expected, got: r.price.module })));
  if (args.has("--failures")) {
    console.log(`\nNew-module failures (${failures.length}):`);
    for (const f of failures) console.log(`  ${f.id} "${f.message}" expected=${JSON.stringify(f.expected)} got=${JSON.stringify(f.got)} ${f.names ? f.names.join(" | ") : ""}`);
  }
  if (args.has("--write")) {
    const dir = path.join(root, "output/evaluation");
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `understanding-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    fs.writeFileSync(file, JSON.stringify({ generatedAt: new Date().toISOString(), datasetVersion: dataset.version, reviewStatus: dataset.reviewStatus, catalogSha256: catalogHash, datasetCatalogSha256: dataset.catalogRawSha256, summary, byTag, failures, rows }, null, 2) + "\n");
    console.log(`\nReport: ${path.relative(root, file)}`);
  }
  if (catalogHash !== dataset.catalogRawSha256) console.log("\nNote: catalog snapshot changed since labelling; SKU names were re-verified above.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
