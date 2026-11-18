/* eslint-disable @typescript-eslint/no-require-imports -- Offline regression tests for Vietnamese input understanding and menu grounding. */
require("./offline-network-guard.cjs");
require("./register-typescript.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { catalogRecords } = require("../src/lib/catalog/kfc-catalog.ts");
const { resolveMenuMention, rankMenuCandidates } = require("../src/lib/agent/understanding/menu-resolver.ts");
const { parsePriceConstraint, expandShorthand, foldText } = require("../src/lib/agent/understanding/vietnamese-input.ts");

const records = catalogRecords(require("../src/lib/catalog/kfc-menu.snapshot.json"));
const categoryName = Object.fromEntries(records.categories.map((c) => [c.id, c.name]));
const menu = records.items.map((i) => ({ ...i, categoryName: categoryName[i.categoryId] }));
const soldOut = (...names) => menu.map((i) => (names.includes(i.name) ? { ...i, isAvailable: false } : i));
const resolve = (mention, items = menu) => resolveMenuMention(mention, items);
const names = (r) => r.items.map((i) => i.name);

test("01 'lớn' (large) and 'lon' (can) stay distinct", () => {
  assert.equal(foldText("Pepsi lớn"), "pepsi large");
  assert.deepEqual(names(resolve("pepsi lớn")), ["Pepsi (Đại)"]);
  assert.deepEqual(names(resolve("pepsi lon")), ["Pepsi (Lon)"]);
  assert.deepEqual(names(resolve("khoai tây chiên lớn")), ["Khoai Tây Chiên (Lớn)"]);
});

test("02 aliases, English and missing accents reach the same SKU", () => {
  for (const mention of ["bơ gơ tôm", "burger tom", "hamburger tôm", "bugger tôm"])
    assert.deepEqual(names(resolve(mention)), ["Burger Tôm"], mention);
  assert.deepEqual(names(resolve("fries size L")), ["Khoai Tây Chiên (Lớn)"]);
  assert.deepEqual(names(resolve("mỳ ý xúc xích")), ["Mì Ý Xúc Xích Gà"]);
  assert.deepEqual(names(resolve("pepsi zero lon")), ["Pepsi Không Đường (Lon)"]);
});

test("03 typo tolerance never jumps to a different first letter", () => {
  assert.deepEqual(names(resolve("pesi lon")), ["Pepsi (Lon)"]);
  const wing = resolve("cánh gà");
  assert.equal(wing.status, "not_found");
  assert.deepEqual(wing.unknownTokens, ["canh"]);
});

test("04 off-menu products are not_found with no items", () => {
  for (const mention of ["coca", "trà sữa trân châu", "pizza hải sản", "cà phê sữa đá", "sting"]) {
    const r = resolve(mention);
    assert.equal(r.status, "not_found", mention);
    assert.equal(r.items.length, 0, mention);
  }
});

test("05 unclear requests stay ambiguous so the agent asks", () => {
  assert.equal(resolve("pepsi").status, "ambiguous");
  assert.equal(resolve("burger").status, "ambiguous");
  assert.equal(resolve("bánh trứng").status, "ambiguous");
  assert.ok(!names(resolve("pepsi")).some((n) => n.includes("Không Đường")), "an unmentioned variant is not offered");
});

test("06 sold-out items are reported, never silently substituted", () => {
  const burger = resolve("burger tôm", soldOut("Burger Tôm"));
  assert.equal(burger.status, "unavailable");
  assert.deepEqual(burger.unavailable.map((i) => i.name), ["Burger Tôm"]);
  assert.equal(burger.items.length, 0, "Combo Burger Tôm must not replace Burger Tôm");
  const soup = resolve("súp rong biển", soldOut("Súp Rong Biển"));
  assert.equal(soup.status, "unavailable");
  const pepsi = resolve("pepsi", soldOut("Pepsi (Lon)"));
  assert.ok(!names(pepsi).includes("Pepsi (Lon)"));
  assert.ok(!rankMenuCandidates("cho 1 burger tôm", soldOut("Burger Tôm")).items.some((i) => i.name === "Burger Tôm"));
});

test("07 every returned item exists in the supplied catalog with its catalog price", () => {
  const byId = new Map(menu.map((i) => [i.id, i]));
  for (const mention of ["pepsi", "gà rán", "combo", "xô", "khoai", "nước ngọt", "deal 99k", "tender"]) {
    const r = resolve(mention);
    for (const item of [...r.items, ...r.unavailable]) {
      assert.ok(byId.has(item.id), item.id);
      assert.equal(item.price, byId.get(item.id).price);
      assert.equal(item.name, byId.get(item.id).name);
    }
  }
});

test("08 model context: noMatch instead of padding, unknown words reported", () => {
  const hello = rankMenuCandidates("xin chào", menu);
  assert.equal(hello.noMatch, true);
  assert.equal(hello.items.length, 0);
  assert.deepEqual(rankMenuCandidates("cho mình 2 coca", menu).unknownTokens, ["coca"]);
  assert.deepEqual(rankMenuCandidates("đổi pepsi lon thành 3", menu).unknownTokens, []);
  assert.equal(rankMenuCandidates("cho 2 cái bơ gơ tôm nha", menu).items[0].name, "Burger Tôm");
});

test("09 budgets: units, slang, ranges, per person", () => {
  const cases = [
    ["có món nào dưới 50k không", { maxPrice: 50000 }],
    ["trên 100.000đ", { minPrice: 100000 }],
    ["từ 50k đến 100k", { minPrice: 50000, maxPrice: 100000 }],
    ["50k-100k", { minPrice: 50000, maxPrice: 100000 }],
    ["ngân sách 1tr2", { maxPrice: 1200000 }],
    ["mình có nửa triệu", { maxPrice: 500000 }],
    ["năm chục nghìn đổ lại", { maxPrice: 50000 }],
    ["trong tầm 80 nghìn", { maxPrice: 80000 }],
    ["tầm 100 cành", { approximate: 100000 }],
    ["mỗi người 60k nha", { maxPrice: 60000, perPerson: true }],
  ];
  for (const [text, expected] of cases) assert.deepEqual(parsePriceConstraint(text), expected, text);
  assert.deepEqual(parsePriceConstraint("dưới 50 có gì"), { maxPrice: 50000, assumedThousands: true });
});

test("10 numbers in product names are never read as budgets", () => {
  for (const text of ["thêm xô zòn zã 159k", "cho 1 deal 99k yolo", "lấy 2 7up lon", "cho 1 combo 2 miếng gà"])
    assert.deepEqual(parsePriceConstraint(text), {}, text);
});

test("11 chat shorthand expands without touching product words", () => {
  assert.equal(expandShorthand("k lấy pepsi nữa"), "khong lay pepsi nua");
  assert.equal(expandShorthand("bn tiền r"), "bao nhieu tien r");
  assert.equal(expandShorthand("Xô Zui Zẻ"), "xo zui ze");
});

test("12 benchmark safety invariant: the module never picks a wrong SKU", async () => {
  const dataset = require("../tests/data/understanding/natural-language.vi.json");
  for (const row of dataset.cases.filter((r) => r.expectedItem)) {
    const sold = new Set(row.soldOut?.ids ?? []);
    const items = menu.map((i) => (sold.has(i.id) ? { ...i, isAvailable: false } : i));
    const r = resolve(row.mention, items);
    if (r.status === "resolved")
      assert.ok(row.expectedItem.status === "resolved" && r.items[0].id === row.expectedItem.ids[0], `${row.id} "${row.message}" picked ${r.items[0].name}`);
  }
});

// ---- Integration: the real services now use the understanding module ----
const { createMemoryRepositories } = require("../src/lib/db/repositories/implementations/mock-repository.ts");
const { MenuService } = require("../src/lib/services/menu-service.ts");
const { CartService } = require("../src/lib/services/cart-service.ts");
const { PolicyEngine } = require("../src/lib/policy/policy-engine.ts");
const { catalogContext } = require("../src/lib/agent/catalog-context.ts");
function services() {
  const repos = createMemoryRepositories(catalogRecords(require("../src/lib/catalog/kfc-menu.snapshot.json")));
  const menuService = new MenuService(repos.menuRepository);
  const cartService = new CartService(repos.cartRepository, menuService);
  return { repos, menuService, cartService, policy: new PolicyEngine(cartService, menuService) };
}
const add = (query) => ({ id: "a1", type: "ADD_TO_CART", parameters: { query, quantity: 1 }, requiresConfirmation: true });
const ctx = { userId: "synthetic-user", sessionId: "synthetic-session", confirmed: false };
const readContext = (text) => JSON.parse(text.slice("CATALOG_CONTEXT_JSON:".length));

test("13 policy: 'pepsi lớn' resolves to Pepsi (Đại), sold-out and off-menu are explained", async () => {
  const { repos, menuService, policy } = services();
  assert.deepEqual((await policy.findMenuMatches("pepsi lớn")).map((i) => i.name), ["Pepsi (Đại)"]);
  assert.equal((await policy.findMenuMatches("1 mieng ga ran")).length, 1);
  assert.match((await policy.evaluateAction(add("coca"), ctx)).reason, /không có: coca/);
  const burger = (await menuService.getMenuItems()).find((i) => i.name === "Burger Tôm");
  await repos.menuRepository.saveMenuItem({ ...burger, isAvailable: false });
  const blocked = await policy.evaluateAction(add("burger tôm"), ctx);
  assert.equal(blocked.decision, "BLOCK");
  assert.match(blocked.reason, /Burger Tôm hiện đang tạm hết/);
  assert.deepEqual(await policy.findMenuMatches("burger tôm"), [], "no silent substitution by Combo Burger Tôm");
});

test("14 retired items are not 'tạm hết', and a bundle containing them is offered, never auto-picked", async () => {
  const { repos, menuService, policy } = services();
  const soup = (await menuService.getMenuItems()).find((i) => i.name === "Súp Rong Biển");
  await repos.menuRepository.saveMenuItem({ ...soup, isActive: false, isAvailable: false });
  const result = await policy.resolveMenuQuery("súp rong biển");
  assert.notEqual(result.status, "unavailable", "retired is not temporarily sold out");
  assert.notEqual(result.status, "resolved", "Combo Cơm Gà Rán & Súp must not be picked silently");
  assert.ok(!result.items.some((i) => i.name === "Súp Rong Biển"));
  assert.equal((await policy.evaluateAction(add("súp rong biển"), ctx)).decision, "BLOCK");
});

test("15 model context keeps 12 candidates but marks real matches and signals", async () => {
  const { menuService } = services();
  const [items, categories] = await Promise.all([menuService.getMenuItems(), menuService.getCategories()]);
  const pepsi = readContext(catalogContext("cho mik 1 pepsi lớn", items, [], categories));
  assert.equal(pepsi.candidates.length, 12);
  assert.deepEqual(pepsi.candidates.filter((c) => c.matched).map((c) => c.name).slice(0, 1), ["Pepsi (Đại)"]);
  const coca = readContext(catalogContext("cho mình 2 coca", items, [], categories));
  assert.equal(coca.noMatch, true);
  assert.deepEqual(coca.unknownTerms, ["coca"]);
  assert.ok(coca.candidates.every((c) => !c.matched));
  const budget = readContext(catalogContext("có món nào dưới 50k không", items, [], categories));
  assert.deepEqual(budget.budgetHint, { maxPrice: 50000 });
  const sold = items.map((i) => (i.name === "Burger Tôm" ? { ...i, isAvailable: false } : i));
  const soldCtx = readContext(catalogContext("thêm 1 burger tôm", sold, [], categories));
  assert.deepEqual(soldCtx.soldOut.map((i) => i.name), ["Burger Tôm"]);
  assert.ok(!soldCtx.candidates.some((c) => c.name === "Burger Tôm"));
  assert.equal(soldCtx.totalAvailableProducts, items.length - 1);
});

test("16 customer search: aliases and sizes work, prefix typing still works", async () => {
  const { menuService } = services();
  const names = async (q) => (await menuService.searchMenuItemsForCustomer(q)).map((i) => i.name);
  assert.ok((await names("bơ gơ tôm")).includes("Burger Tôm"));
  assert.ok(!(await names("pepsi lớn")).includes("Pepsi (Lon)"));
  assert.ok((await names("bur")).length > 0, "prefix fallback while typing");
  assert.deepEqual(await names("coca"), []);
  assert.ok((await names("gà")).includes("Combo Cùng Vui"), "description matches still count for search");
});

test("17 offline mock parser keeps diacritics in the product query (pepsi lớn ≠ pepsi lon)", async () => {
  const { MockLLMProvider } = require("../src/lib/agent/providers/mock-llm-provider.ts");
  const provider = new MockLLMProvider();
  const query = async (message) => {
    const r = await provider.generateResponse("", `USER_MESSAGE_JSON:${JSON.stringify(message)}`);
    return r.success ? r.response.actions[0]?.parameters.query : r.error.message;
  };
  assert.equal(await query("Thêm 1 pepsi lớn"), "pepsi lớn");
  assert.equal(await query("Vui lòng cho tôi bảy Pepsi nhé"), "pepsi");
  // Sizes were always folded ("1 5l" matches "Pepsi 1.5L" after normalisation); unchanged.
  assert.equal(await query("Thêm hai chai Pepsi 1,5 lít"), "pepsi 1 5l");
  const { policy } = services();
  assert.deepEqual((await policy.findMenuMatches(await query("Thêm 1 pepsi lớn"))).map((i) => i.name), ["Pepsi (Đại)"]);
});

test("18 search ignores shared category names (found by the live AgentCore run)", async () => {
  const { menuService } = services();
  const hits = (await menuService.searchMenuItemsForCustomer("burger", { minPrice: 40000, maxPrice: 60000 })).map((i) => i.name);
  assert.ok(hits.length > 0);
  assert.ok(hits.every((n) => /burger/i.test(n)), "only burgers, got: " + hits.join(", "));
  const drinks = (await menuService.searchMenuItemsForCustomer("đồ uống")).map((i) => i.name);
  assert.ok(drinks.includes("Pepsi (Vừa)"), "category aliases still work");
});

test("19 grounded replies use only catalog facts when the model proposes nothing", () => {
  const { groundedReply } = require("../src/lib/agent/understanding/grounded-reply.ts");
  const reply = (m, items = records.items) => groundedReply(m, items, records.categories, []);
  assert.match(reply("Cho mình 1 pepsi"), /Pepsi \(Vừa\) \(17\.000\s₫\).*Bạn muốn chọn loại nào/);
  assert.match(reply("Cho mình 2 coca"), /không có “coca”.*Pepsi \(Vừa\)/);
  assert.match(reply("thêm 1 trà sữa trân châu"), /không có món này/);
  assert.match(reply("anh ơi lấy giùm em 3 lon pepsi"), /Pepsi \(Lon\).*“Thêm 3 Pepsi \(Lon\)”/);
  assert.equal(reply("đừng thêm pepsi nha"), "Mình giữ nguyên giỏ hàng nhé.");
  assert.equal(reply("k lấy pepsi nữa"), null, "a removal request is left to the model, never answered as a menu question");
  assert.equal(reply("xin chào"), null);
  assert.match(reply("xoá hết giỏ hàng"), /đang trống/);
  const sold = records.items.map((i) => (i.name === "Burger Tôm" ? { ...i, isAvailable: false } : i));
  assert.match(reply("thêm 1 burger tôm", sold), /Burger Tôm hiện đang tạm hết/);
  // Every price quoted must be a catalog price.
  const prices = new Set(records.items.map((i) => i.price));
  for (const m of ["Cho mình 1 pepsi", "thêm 2 burger", "Cho mình 2 coca", "cho 1 phần cánh gà"])
    for (const [, digits] of reply(m).matchAll(/\(([\d.]+)\s₫\)/g)) assert.ok(prices.has(Number(digits.replace(/\./g, ""))), m + " " + digits);
});

test("20 agentCore replaces the provider's generic clarification with a grounded reply, never the model text", async () => {
  const os = require("node:os"), fs = require("node:fs"), path = require("node:path");
  Object.assign(process.env, {
    AI_PROVIDER: "mock", PERSISTENCE_DRIVER: "local", KFC_PURCHASE_ASSISTANT: "1",
    LOCAL_DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), "kfc-grounded-")),
    SESSION_SECRET: process.env.SESSION_SECRET || "synthetic-grounded-reply-signing-secret-2026",
  });
  const { services } = require("../src/lib/agent/agent-core.ts");
  const original = services.llmProvider;
  // Same shape BedrockLLMProvider returns when the model proposed no action.
  services.llmProvider = { generateResponse: async () => ({ success: true, response: {
    message: "Đã đặt hàng thành công, tổng 1 đồng!", intent: "UNKNOWN", confidence: 0.1, actions: [], requiresConfirmation: false } }) };
  try {
    const chat = (message) => services.chatService.processChat({ platform: "web", userId: "grounded-" + crypto.randomUUID(), sessionId: "s", message });
    const coca = await chat("Cho mình 2 coca");
    assert.match(coca.reply, /không có “coca”/);
    assert.ok(!coca.reply.includes("Đã đặt hàng"), "model text never reaches the customer");
    assert.equal(coca.requiresConfirmation, false);
    const hello = await chat("xin chào");
    assert.match(hello.reply, /chưa hiểu|nói lại/i, "nothing grounded to say -> generic clarification kept");
    assert.ok(!hello.reply.includes("Đã đặt hàng"));
  } finally {
    services.llmProvider = original;
  }
});

test("21 update/remove proposed with a catalog item ID reach the right cart line (found by the live multi-turn run)", async () => {
  const { services } = require("../src/lib/agent/agent-core.ts");
  const original = services.llmProvider;
  const pepsi = (await services.menuService.getMenuItems()).find((i) => i.name.normalize("NFC") === "Pepsi (Đại)");
  const userId = "edit-" + crypto.randomUUID();
  const respond = (type, parameters) => ({ success: true, response: { message: "m", intent: type, confidence: 0.9, requiresConfirmation: true,
    actions: [{ id: "a-" + crypto.randomUUID(), type, parameters, requiresConfirmation: true }] } });
  const chat = (message, extra = {}) => services.chatService.processChat({ platform: "web", userId, sessionId: "s", message, ...extra });
  try {
    await services.cartService.addMenuItem(userId, pepsi, 2);
    services.llmProvider = { generateResponse: async () => respond("UPDATE_CART", { itemId: pepsi.id, quantity: 3 }) };
    const update = await chat("đổi pepsi đại thành 3");
    assert.equal(update.requiresConfirmation, true);
    const done = await chat("Xác nhận", { confirm: true, confirmationId: update.pendingConfirmation.id });
    assert.ok(done.execution.some((row) => row.executed), JSON.stringify(done.execution));
    assert.equal((await services.cartService.getCartView(userId)).items[0].quantity, 3);
    services.llmProvider = { generateResponse: async () => respond("REMOVE_FROM_CART", { itemId: pepsi.id }) };
    const remove = await chat("bỏ pepsi đại ra");
    await chat("Xác nhận", { confirm: true, confirmationId: remove.pendingConfirmation.id });
    assert.equal((await services.cartService.getCartView(userId))?.items.length ?? 0, 0);
    // A catalog ID that is not in this customer's cart still fails closed.
    const other = (await services.menuService.getMenuItems()).find((i) => i.name.normalize("NFC") === "Burger Tôm");
    services.llmProvider = { generateResponse: async () => respond("REMOVE_FROM_CART", { itemId: other.id }) };
    const foreign = await chat("bỏ burger tôm");
    assert.equal(foreign.requiresConfirmation, false);
  } finally {
    services.llmProvider = original;
  }
});

test("22 cart questions are answered from the stored cart when the model proposes nothing", () => {
  const { groundedReply } = require("../src/lib/agent/understanding/grounded-reply.ts");
  const cart = [
    { id: "l1", menuItemId: "a", nameSnapshot: "Pepsi (Đại)", quantity: 3, unitPrice: 20000 },
    { id: "l2", menuItemId: "b", nameSnapshot: "Burger Tôm", quantity: 1, unitPrice: 45000 },
  ];
  const reply = groundedReply("giỏ còn gì", records.items, records.categories, cart);
  assert.match(reply, /3 × Pepsi \(Đại\): 60\.000\s₫/);
  assert.match(reply, /Tổng cộng: 105\.000\s₫/);
  assert.match(groundedReply("giỏ mình bao nhiêu tiền", records.items, records.categories, cart), /105\.000/);
  assert.doesNotMatch(String(groundedReply("bỏ burger tôm khỏi giỏ", records.items, records.categories, cart)), /Tổng cộng/, "edits are not answered as a cart summary");
});
