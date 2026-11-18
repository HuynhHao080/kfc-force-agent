/* eslint-disable @typescript-eslint/no-require-imports -- Offline tests for the conversation evaluation: dataset validity and scoring, no network. */
require("./offline-network-guard.cjs");
const os = require("node:os"), fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
Object.assign(process.env, {
  AI_PROVIDER: "mock", PERSISTENCE_DRIVER: "local", KFC_PURCHASE_ASSISTANT: "1",
  LOCAL_DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), "kfc-conv-eval-test-")),
  SESSION_SECRET: "synthetic-conversation-eval-test-secret-2026",
});
require("./register-typescript.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { services } = require("../src/lib/agent/agent-core.ts");
const { ToolAgent } = require("../src/lib/agent/tool-agent/agent.ts");
const { checkReply } = require("../src/lib/agent/tool-agent/reply-guard.ts");
const { validateDataset, scoreTurn, parseSummaryLine, fold } = require("./conversation-eval-core.cjs");
const dataset = require("../tests/data/agent-conversations/conversations.vi.json");

const text = (t) => ({ success: true, response: { content: [{ type: "text", text: t }], stopReason: "end_turn", usage: { inputTokens: 1, outputTokens: 1 } } });
const tool = (name, input) => ({ success: true, response: { content: [{ type: "tool_use", id: "tu_" + crypto.randomUUID().slice(0, 8), name, input }], stopReason: "tool_use" } });
const scripted = (steps) => ({ invokeWithTools: async (_s, messages) => { const s = steps.shift(); return typeof s === "function" ? s(messages) : s; } });
const lastToolResult = (messages) => JSON.parse(messages.at(-1).content.at(-1).content);

async function setup() {
  for (const name of dataset.catalogState.retired) {
    const item = (await services.menuService.getMenuItems()).find((i) => fold(i.name) === fold(name));
    if (item?.isActive) await services.adminService.saveMenu({ name: item.name, description: item.description ?? "", categoryId: item.categoryId,
      price: item.price, isActive: false, isAvailable: false, imageUrl: item.imageUrl }, item.id);
  }
  const items = await services.menuService.getMenuItems();
  const catalog = items.map((i) => ({ id: i.id, name: i.name, price: i.price, isActive: i.isActive, isAvailable: i.isAvailable }));
  const facts = items.map((i) => ({ id: i.id, name: i.name, price: i.price, available: i.isActive && i.isAvailable, retired: !i.isActive }));
  return { catalog, guard: (reply) => checkReply(reply, { catalog: facts }) };
}
const ready = setup();
const byName = async (name) => (await services.menuService.getMenuItems()).find((i) => fold(i.name) === fold(name));
async function cartOf(userId) {
  const view = await services.cartService.getCartView(userId);
  return { cart: (view?.items ?? []).map((l) => ({ name: l.nameSnapshot, quantity: l.quantity })), cartTotal: view?.cart?.total ?? 0 };
}
async function agentTurn(steps, userId, message) {
  services.toolAgent = new ToolAgent(scripted(steps));
  try { return await services.chatService.processChat({ platform: "web", userId, sessionId: userId, message }); }
  finally { services.toolAgent = null; }
}

test("01 the dataset is valid against the real catalog (names on sale, retired items marked, confirmations follow proposals)", async () => {
  const { catalog } = await ready;
  assert.deepEqual(validateDataset(dataset, catalog), []);
  assert.ok(dataset.conversations.length >= 20);
  assert.equal(dataset.status, "development", "the dataset must not claim to be an independent evaluation");
});

test("02 validation catches unknown products, retired products in expectations, bad confirmations and duplicate ids", async () => {
  const { catalog } = await ready;
  const bad = { catalogState: { retired: [] }, conversations: [
    { id: "CV-01", turns: [{ user: "x", expect: { proposal: { action: "add", items: [{ anyOf: ["Coca Cola"] }] } } }] },
    { id: "CV-01", turns: [{ confirm: true }] },
    { id: "CV-03", turns: [{ user: "y", expect: { cart: [{ name: "Xô Zòn Zã 159K", quantity: 1 }] } }] },
  ] };
  const problems = validateDataset(bad, catalog).join("\n");
  assert.match(problems, /Coca Cola/);
  assert.match(problems, /trùng id CV-01/);
  assert.match(problems, /xác nhận nhưng/);
  assert.match(problems, /không còn bán/);
});

test("03 summary lines written by the server parse into action, product and quantity", () => {
  assert.deepEqual(parseSummaryLine("Thêm 2 × Pepsi (Lon): 40.000 ₫"), { action: "add", quantity: 2, name: "Pepsi (Lon)" });
  assert.deepEqual(parseSummaryLine("Đổi Pepsi (Vừa) thành 3 phần: 51.000 ₫"), { action: "update", quantity: 3, name: "Pepsi (Vừa)" });
  assert.deepEqual(parseSummaryLine("Xoá Burger Tôm khỏi giỏ hàng"), { action: "remove", name: "Burger Tôm" });
  assert.deepEqual(parseSummaryLine("Xoá toàn bộ món trong giỏ hàng"), { action: "clear" });
});

test("04 a real pipeline turn (clarify, then a context-dependent proposal, then 'ok') is scored correctly", async () => {
  const ctx = await ready;
  const cv = dataset.conversations.find((c) => c.id === "CV-03");
  const userId = "eval-test-" + crypto.randomUUID();
  const lon = await byName("Pepsi (Lon)");
  const r1 = await agentTurn([tool("search_menu", { query: "pepsi" }), text("Bạn muốn Pepsi cỡ nào: Tiêu Chuẩn, Vừa, Đại hay Lon?")], userId, cv.turns[0].user);
  const s1 = scoreTurn({ ...ctx, turn: cv.turns[0], response: r1, ...(await cartOf(userId)) });
  assert.equal(s1.pass, true, JSON.stringify(s1.checks.filter((c) => !c.ok)));
  const r2 = await agentTurn([tool("propose_cart_change", { changes: [{ action: "add", item_id: lon.id, quantity: 2 }] }),
    text("Mình đề xuất thêm 2 Pepsi (Lon), bạn bấm “Xác nhận thao tác” nhé.")], userId, cv.turns[1].user);
  const s2 = scoreTurn({ ...ctx, turn: cv.turns[1], response: r2, ...(await cartOf(userId)) });
  assert.equal(s2.pass, true, JSON.stringify(s2.checks.filter((c) => !c.ok)));
  const r3 = await services.chatService.processChat({ platform: "web", userId, sessionId: userId, message: "ok" });
  const s3 = scoreTurn({ ...ctx, turn: cv.turns[2], response: r3, ...(await cartOf(userId)) });
  assert.equal(s3.pass, true, JSON.stringify(s3.checks.filter((c) => !c.ok)));
});

test("05 wrong behaviour fails the right checks", async () => {
  const ctx = await ready;
  const cv3 = dataset.conversations.find((c) => c.id === "CV-03");
  const userId = "eval-test-" + crypto.randomUUID();
  const dai = await byName("Pepsi (Đại)");
  // Guessing a size instead of asking.
  const guessed = await agentTurn([tool("propose_cart_change", { changes: [{ action: "add", item_id: dai.id, quantity: 2 }] }), text("Mình đề xuất 2 Pepsi (Đại) nhé, bấm “Xác nhận thao tác”.")], userId, cv3.turns[0].user);
  const s = scoreTurn({ ...ctx, turn: cv3.turns[0], response: guessed, ...(await cartOf(userId)) });
  assert.equal(s.pass, false);
  assert.deepEqual([...new Set(s.checks.filter((c) => !c.ok).map((c) => c.name))].sort(), ["clarify", "noProposal"]);
  // Wrong quantity and an extra item.
  const cv9 = dataset.conversations.find((c) => c.id === "CV-09");
  const fake = { requiresConfirmation: true, reply: "Bạn bấm xác nhận nhé.", pendingConfirmation: { summary: [
    "Thêm 2 × Burger Tôm: 90.000 ₫", "Thêm 1 × Pepsi (Vừa): 17.000 ₫", "Thêm 1 × Khoai Tây Chiên (Vừa): 20.000 ₫"] } };
  const s9 = scoreTurn({ ...ctx, turn: cv9.turns[0], response: fake, cart: [], cartTotal: 0 });
  const failed = s9.checks.filter((c) => !c.ok).map((c) => c.name);
  assert.ok(failed.includes("proposal.quantity") && failed.includes("proposal.noExtra"), failed.join(","));
  // An invented drink and a fallback reply.
  const cv5 = dataset.conversations.find((c) => c.id === "CV-05");
  const s5 = scoreTurn({ ...ctx, turn: cv5.turns[0], response: { reply: "KFC không bán cà phê. Bạn thử:\n- Nước cam\n- Trà đào", requiresConfirmation: false }, cart: [], cartTotal: 0 });
  assert.ok(s5.checks.some((c) => c.name === "factCheck" && !c.ok));
  assert.ok(s5.checks.some((c) => c.name === "mustNot" && !c.ok));
  const fb = scoreTurn({ ...ctx, turn: cv5.turns[0], response: { reply: "Xin lỗi, mình chưa trả lời chắc chắn được. Bạn nói rõ…", requiresConfirmation: false }, cart: [], cartTotal: 0 });
  assert.ok(fb.checks.some((c) => c.name === "notFallback" && !c.ok));
});

test("06 confirmations, cart contents, totals and price ceilings are checked against the real cart", async () => {
  const ctx = await ready;
  const cv9 = dataset.conversations.find((c) => c.id === "CV-09");
  const userId = "eval-test-" + crypto.randomUUID();
  const [burger, pepsi] = [await byName("Burger Tôm"), await byName("Pepsi (Vừa)")];
  const add = await agentTurn([tool("propose_cart_change", { changes: [{ action: "add", item_id: burger.id, quantity: 1 }, { action: "add", item_id: pepsi.id, quantity: 1 }] }),
    text("Mình đề xuất thêm 1 Burger Tôm và 1 Pepsi (Vừa), bạn bấm “Xác nhận thao tác” nhé.")], userId, cv9.turns[0].user);
  assert.equal(scoreTurn({ ...ctx, turn: cv9.turns[0], response: add, ...(await cartOf(userId)) }).pass, true);
  const ok = await services.chatService.processChat({ platform: "web", userId, sessionId: userId, message: "Xác nhận", confirm: true, confirmationId: add.pendingConfirmation.id });
  assert.equal(scoreTurn({ ...ctx, turn: cv9.turns[1], response: ok, ...(await cartOf(userId)) }).pass, true);
  const update = await agentTurn([tool("view_cart", {}), (m) => tool("propose_cart_change", { changes: [{ action: "set_quantity", item_id: lastToolResult(m).lines.find((l) => l.item_id === pepsi.id).item_id, quantity: 2 }] }),
    text("Mình đề xuất đổi Pepsi (Vừa) thành 2 ly, bạn bấm “Xác nhận thao tác” nhé.")], userId, cv9.turns[2].user);
  const su = scoreTurn({ ...ctx, turn: cv9.turns[2], response: update, ...(await cartOf(userId)) });
  assert.equal(su.pass, true, JSON.stringify(su.checks.filter((c) => !c.ok)));
  // The cart total must appear in the reply for CV-01#4.
  const cv1 = dataset.conversations.find((c) => c.id === "CV-01");
  const { cart, cartTotal } = await cartOf(userId);
  assert.equal(cartTotal, 62000);
  assert.equal(scoreTurn({ ...ctx, turn: cv1.turns[3], response: { reply: "Giỏ của bạn hiện là 62.000 ₫.", requiresConfirmation: false }, cart, cartTotal }).pass, true);
  assert.equal(scoreTurn({ ...ctx, turn: cv1.turns[3], response: { reply: "Giỏ của bạn khoảng 60.000 ₫.", requiresConfirmation: false }, cart, cartTotal }).pass, false);
  // Product cards above the budget fail CV-07.
  const cv7 = dataset.conversations.find((c) => c.id === "CV-07");
  const combo = await byName("Combo Burger Tôm");
  const over = scoreTurn({ ...ctx, turn: cv7.turns[0], response: { reply: "Bạn thử Combo Burger Tôm (69.000 ₫) nhé?", requiresConfirmation: false, products: [{ id: combo.id, name: combo.name, price: combo.price }] }, cart: [], cartTotal: 0 });
  assert.ok(over.checks.some((c) => c.name === "maxProductPrice" && !c.ok));
});
