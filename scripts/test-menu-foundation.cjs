/* eslint-disable @typescript-eslint/no-require-imports -- Existing offline TypeScript test loader. */
require("./register-typescript.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { menuDatasetSchema } = require("../src/lib/validation/menu-data.ts");
const root = path.join(__dirname, "..");
const fixture = JSON.parse(fs.readFileSync(path.join(root, "tests/fixtures/menu/demo-v1.json"), "utf8"));
const fresh = () => structuredClone(fixture);
const time = fixture.updatedAt;
const unknownPrice = () => ({ status: "unknown", amount: null, currency: "VND", provenanceId: null, reason: "Chưa có bằng chứng giá" });
const unknownAvailability = () => ({ status: "unknown", scope: "Chưa biết cửa hàng", provenanceId: null, observedAt: null, reason: "Chưa quan sát" });
const owners = (d) => [...d.products, ...d.combos, ...d.variants, ...d.optionValues];

// Fictional metadata tests schema structure; never an official KFC fixture.
function reviewed() {
  const d = fresh();
  d.classification = "kfc_verified";
  Object.assign(d.provenance[0], {
    sourceKind: "kfc_official", sourceUrl: "https://kfc.example.invalid/menu",
    sourceRef: "synthetic-test-only.json", observedAt: time,
    verificationStatus: "verified", verifiedAt: time,
    verifiedBy: "synthetic-test-reviewer", reason: null,
  });
  for (const row of owners(d)) row.availability.observedAt = time;
  return d;
}
function rejects(label, change, expectedPath, factory = fresh) {
  test(label, () => {
    const d = factory();
    change(d);
    const r = menuDatasetSchema.safeParse(d);
    assert.equal(r.success, false, "Unexpected acceptance");
    assert.ok(r.error.issues.some((i) => i.path.join(".").startsWith(expectedPath)), JSON.stringify(r.error.issues));
  });
}

test("valid demo round-trips without mutation, coercion or source promotion", () => {
  const d = fresh(), before = structuredClone(d);
  assert.deepEqual(menuDatasetSchema.parse(d), before);
  assert.deepEqual(d, before);
  assert.equal(d.classification, "seed_demo");
});
test("fixture hash matches the actual legacy seed with LF normalization", () => {
  const source = fs.readFileSync(path.join(root, "src/lib/db/repositories/implementations/mock-repository.ts"), "utf8").replace(/\r\n/g, "\n");
  assert.equal(createHash("sha256").update(source).digest("hex"), fixture.provenance[0].rawSha256);
});
test("fixture facts match legacy demo declarations without deriving new prices or composition", async () => {
  const { MockMenuRepository } = require("../src/lib/db/repositories/implementations/mock-repository.ts");
  const seed = new MockMenuRepository();
  for (const product of fixture.products) {
    const original = await seed.getMenuItemById(product.id);
    assert.equal(product.name, original.name);
    assert.equal(product.price.amount, original.price);
    assert.equal(product.availability.status === "available", original.isAvailable);
    assert.equal(product.updatedAt, original.updatedAt);
  }
  for (const combo of fixture.combos) {
    const original = await seed.getProductBundleById(combo.id);
    assert.equal(combo.price.amount, original.price);
    const components = await seed.getBundleItems(combo.id);
    assert.deepEqual(fixture.comboItems.filter((c) => c.comboId === combo.id).map((c) => [c.productId, c.quantity]), components.map((c) => [c.menuItemId, c.quantity]));
  }
  for (const variant of fixture.variants) {
    const original = await seed.getMenuItemById(variant.productId);
    assert.equal(variant.price.amount, original.price);
    assert.equal(variant.attributes.volume, original.metadata.volume);
  }
  for (const option of fixture.options) {
    const original = await seed.getItemOptionById(option.id);
    assert.equal(option.productId, original.menuItemId);
    assert.equal(option.minSelections > 0, original.required);
    const values = await seed.getOptionValues(option.id);
    assert.deepEqual(fixture.optionValues.filter((v) => v.optionId === option.id).map((v) => [v.id, v.name, v.priceDelta.amount]), values.map((v) => [v.id, v.name, v.priceDelta]));
  }
});
test("unknown price, availability and composition stay unknown", () => {
  const d = fresh();
  for (const row of owners(d)) {
    if (row.price) row.price = unknownPrice();
    if (row.priceDelta) row.priceDelta = unknownPrice();
    row.availability = unknownAvailability();
  }
  d.combos[0].compositionStatus = "unknown";
  d.combos[0].compositionReason = "Chưa có thành phần được xác minh";
  d.comboItems = [];
  assert.deepEqual(menuDatasetSchema.parse(d), d);
});
test("unavailable and zero price are explicit declarations, not defaults", () => {
  const d = fresh();
  d.products[0].price.amount = 0;
  d.products[0].availability.status = "unavailable";
  assert.deepEqual(menuDatasetSchema.parse(d), d);
});
test("valid variant references and required option choices", () => {
  const d = fresh();
  d.comboItems[2].variantId = d.variants[0].id;
  d.options[0].productId = d.variants[0].productId;
  d.options[0].variantId = d.variants[0].id;
  d.options[0].minSelections = 1;
  assert.deepEqual(menuDatasetSchema.parse(d), d);
});
test("reviewed official metadata is structurally valid; verification is external", () => {
  assert.equal(menuDatasetSchema.safeParse(reviewed()).success, true);
});
test("manual unverified observations do not become verified", () => {
  const d = reviewed();
  d.classification = "unverified";
  Object.assign(d.provenance[0], { sourceKind: "manual", verificationStatus: "unverified", verifiedAt: null, verifiedBy: null, reason: "Chưa kiểm chứng" });
  assert.deepEqual(menuDatasetSchema.parse(d), d);
});

for (const collection of ["provenance", "products", "combos", "comboItems", "variants", "options", "optionValues"]) {
  rejects(`duplicate ${collection} IDs`, (d) => d[collection].push(structuredClone(d[collection][0])), collection);
}
rejects("product and combo IDs cannot overlap", (d) => { d.combos[0].id = d.products[0].id; }, "combos.0.id");
rejects("empty ID", (d) => { d.products[0].id = ""; }, "products.0.id");
rejects("unsupported contract version", (d) => { d.schemaVersion = 2; }, "schemaVersion");
rejects("unknown properties are rejected", (d) => { d.products[0].guess = true; }, "products.0");
rejects("missing arrays are not defaulted", (d) => { delete d.variants; }, "variants");
rejects("entity provenance cannot be orphaned", (d) => { d.options[0].provenanceId = "missing"; }, "options.0.provenanceId");
rejects("price provenance cannot be orphaned", (d) => { d.products[0].price.provenanceId = "missing"; }, "products.0.price.provenanceId");
rejects("availability provenance cannot be orphaned", (d) => { d.products[0].availability.provenanceId = "missing"; }, "products.0.availability.provenanceId");
rejects("variant product must exist", (d) => { d.variants[0].productId = "missing"; }, "variants.0.productId");
rejects("variant attributes cannot be empty", (d) => { d.variants[0].attributes = {}; }, "variants.0.attributes");
rejects("option product must exist", (d) => { d.options[0].productId = "missing"; }, "options.0.productId");
rejects("option variant must exist", (d) => { d.options[0].variantId = "missing"; }, "options.0.variantId");
rejects("option variant must belong to parent product", (d) => { d.options[0].variantId = d.variants[0].id; }, "options.0.variantId");
rejects("option value must reference an option", (d) => { d.optionValues[0].optionId = "missing"; }, "optionValues.0.optionId");
rejects("required option cannot lack values", (d) => { d.options[0].minSelections = 1; d.optionValues = []; }, "options.0.maxSelections");
rejects("selection minimum cannot exceed maximum", (d) => { d.options[0].minSelections = 2; }, "options.0.minSelections");
rejects("selection maximum cannot exceed value count", (d) => { d.options[0].maxSelections = 4; }, "options.0.maxSelections");
rejects("combo must exist", (d) => { d.comboItems[0].comboId = "missing"; }, "comboItems.0.comboId");
rejects("combo product must exist; nesting is unsupported", (d) => { d.comboItems[0].productId = d.combos[0].id; }, "comboItems.0.productId");
rejects("combo variant must exist", (d) => { d.comboItems[0].variantId = "missing"; }, "comboItems.0.variantId");
rejects("combo variant must belong to component product", (d) => { d.comboItems[0].variantId = d.variants[0].id; }, "comboItems.0.variantId");
rejects("duplicate component cannot hide behind a new row ID", (d) => { d.comboItems.push({ ...d.comboItems[0], id: "duplicate_component" }); }, "comboItems.3.productId");
rejects("known composition cannot be empty", (d) => { d.comboItems = []; }, "combos.0.compositionStatus");
rejects("unknown composition cannot assert components", (d) => { d.combos[0].compositionStatus = "unknown"; d.combos[0].compositionReason = "Chưa rõ"; }, "combos.0.compositionStatus");
rejects("unknown composition needs a reason", (d) => { d.combos[0].compositionStatus = "unknown"; d.comboItems = []; }, "combos.0.compositionReason");
for (const quantity of [0, -1, 1.5, "2", Number.MAX_SAFE_INTEGER + 1]) {
  rejects(`invalid component quantity ${quantity}`, (d) => { d.comboItems[0].quantity = quantity; }, "comboItems.0.quantity");
}
for (const amount of [-1, 0.5, "25000", NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
  rejects(`invalid price ${amount}`, (d) => { d.products[0].price.amount = amount; }, "products.0.price.amount");
}
rejects("variant price is checked", (d) => { d.variants[0].price.amount = -1; }, "variants.0.price.amount");
rejects("combo price is checked", (d) => { d.combos[0].price.amount = -1; }, "combos.0.price.amount");
rejects("option delta is checked", (d) => { d.optionValues[0].priceDelta.amount = -1; }, "optionValues.0.priceDelta.amount");
rejects("non-VND price", (d) => { d.products[0].price.currency = "USD"; }, "products.0.price.currency");
rejects("missing price cannot be inferred", (d) => { delete d.variants[0].price; }, "variants.0.price");
rejects("unknown price cannot carry an amount", (d) => { d.products[0].price = { ...unknownPrice(), amount: 25000 }; }, "products.0.price.amount");
rejects("unknown price requires explanation", (d) => { d.products[0].price = { ...unknownPrice(), reason: " " }; }, "products.0.price.reason");
rejects("unknown availability cannot claim known evidence", (d) => { d.products[0].availability = { ...unknownAvailability(), provenanceId: "seed" }; }, "products.0.availability.provenanceId");
rejects("availability scope is mandatory", (d) => { d.products[0].availability.scope = ""; }, "products.0.availability.scope");
rejects("demo cannot be promoted by dataset label", (d) => { d.classification = "kfc_verified"; }, "classification");
rejects("demo source cannot be marked verified", (d) => { d.provenance[0].sourceKind = "seed_demo"; }, "provenance.0.verificationStatus", reviewed);
rejects("non-demo source cannot be labeled demo", (d) => { d.classification = "seed_demo"; }, "classification", reviewed);
for (const field of ["sourceUrl", "rawSha256", "observedAt", "verifiedAt", "verifiedBy"]) {
  rejects(`verified source needs ${field}`, (d) => { d.provenance[0][field] = null; }, `provenance.0.${field}`, reviewed);
}
rejects("verified dataset cannot contain manual sources", (d) => { d.provenance[0].sourceKind = "manual"; }, "classification", reviewed);
rejects("unverified source needs a reason", (d) => { d.provenance[0].reason = null; }, "provenance.0.reason");
rejects("unverified source cannot retain reviewer identity", (d) => { d.provenance[0].verifiedBy = "someone"; }, "provenance.0.verifiedBy");
rejects("artifact reference is mandatory", (d) => { d.provenance[0].sourceRef = " "; }, "provenance.0.sourceRef");
rejects("invalid evidence hash", (d) => { d.provenance[0].rawSha256 = "abc"; }, "provenance.0.rawSha256");
rejects("HTTP evidence URL is rejected", (d) => { d.provenance[0].sourceUrl = "http://kfc.example.invalid/menu"; }, "provenance.0.sourceUrl", reviewed);
rejects("malformed evidence URL returns validation issues without throwing", (d) => { d.provenance[0].sourceUrl = "not a URL"; }, "provenance.0.sourceUrl", reviewed);
rejects("URL credentials are rejected", (d) => { d.provenance[0].sourceUrl = "https://user:pass@kfc.example.invalid/menu"; }, "provenance.0.sourceUrl", reviewed);
rejects("non-demo known availability needs observation", (d) => { d.products[0].availability.observedAt = null; }, "products.0.availability.observedAt", reviewed);
rejects("invalid calendar timestamp", (d) => { d.products[0].updatedAt = "2024-02-30T00:00:00.000Z"; }, "products.0.updatedAt");
rejects("missing UTC zone", (d) => { d.updatedAt = "2024-01-01T00:00:00"; }, "updatedAt");
rejects("creation cannot follow update", (d) => { d.products[0].createdAt = "2025-01-01T00:00:00Z"; }, "products.0.createdAt");
rejects("entity update cannot follow snapshot", (d) => { d.products[0].updatedAt = "2025-01-01T00:00:00Z"; }, "products.0.updatedAt");
rejects("observation cannot follow snapshot", (d) => { d.provenance[0].observedAt = "2025-01-01T00:00:00Z"; }, "provenance.0.observedAt", reviewed);
rejects("source update cannot follow observation", (d) => { d.provenance[0].sourceUpdatedAt = "2025-01-01T00:00:00Z"; }, "provenance.0.sourceUpdatedAt", reviewed);
rejects("verification cannot precede observation", (d) => { d.provenance[0].verifiedAt = "2023-01-01T00:00:00Z"; }, "provenance.0.verifiedAt", reviewed);
rejects("verification cannot follow dataset", (d) => { d.provenance[0].verifiedAt = "2025-01-01T00:00:00Z"; }, "provenance.0.verifiedAt", reviewed);
rejects("availability cannot follow entity update", (d) => { d.products[0].availability.observedAt = "2025-01-01T00:00:00Z"; }, "products.0.availability.observedAt", reviewed);
rejects("availability cannot follow evidence observation", (d) => { d.provenance[0].observedAt = "2023-01-01T00:00:00Z"; d.provenance[0].sourceUpdatedAt = null; }, "products.0.availability.observedAt", reviewed);
