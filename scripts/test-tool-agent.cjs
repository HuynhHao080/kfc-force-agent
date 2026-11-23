/* eslint-disable @typescript-eslint/no-require-imports -- Offline tests for the tool-using agent: scripted model, real services and KFC catalog, no network. */
require("./offline-network-guard.cjs");
const os = require("node:os"), fs = require("node:fs"), path = require("node:path");
Object.assign(process.env, {
  AI_PROVIDER: "mock", PERSISTENCE_DRIVER: "local", KFC_PURCHASE_ASSISTANT: "1",
  LOCAL_DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), "kfc-tool-agent-")),
  SESSION_SECRET: "synthetic-tool-agent-signing-secret-2026-x",
});
require("./register-typescript.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { services } = require("../src/lib/agent/agent-core.ts");
const { ToolAgent, TOOL_AGENT_PROMPT } = require("../src/lib/agent/tool-agent/agent.ts");
const { checkReply } = require("../src/lib/agent/tool-agent/reply-guard.ts");
const { BedrockService } = require("../src/lib/aws/bedrock.ts");

const text = (t) => ({ success: true, response: { content: [{ type: "text", text: t }], stopReason: "end_turn", usage: { inputTokens: 100, outputTokens: 20 } } });
const tool = (name, input) => ({ success: true, response: { content: [{ type: "tool_use", id: "tu_" + crypto.randomUUID().slice(0, 8), name, input }], stopReason: "tool_use" } });
const vnd = (n) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(n);
/** Last tool_result payload the agent sent back to the model. */
const lastToolResult = (messages) => JSON.parse(messages.at(-1).content.at(-1).content);

/** Scripted model: each step is a function (messages) => response. */
function scripted(steps) {
  const calls = [];
  return { calls, invokeWithTools: async (system, messages, tools) => {
    calls.push({ system, messages: structuredClone(messages), tools });
    const step = steps.shift();
    if (!step) throw new Error("model called more times than scripted");
    return typeof step === "function" ? step(messages) : step;
  } };
}
async function turn(model, userId, message, extra = {}) {
  services.toolAgent = new ToolAgent(model);
  try {
    return await services.chatService.processChat({ platform: "web", userId, sessionId: "s", message, ...extra });
  } finally {
    services.toolAgent = null;
  }
}
const user = () => "tool-" + crypto.randomUUID();

test("01 '200k cho 2 người': model searches, recommends with real prices, reply passes the guard", async () => {
  let combo;
  const model = scripted([
    tool("search_menu", { query: "combo nhóm", max_price: 200000 }),
    (messages) => {
      const result = lastToolResult(messages);
      combo = result.items.find((i) => i.name.normalize("NFC").includes("Combo Nhóm 2")) ?? result.items[0];
      return text(`Với 200k cho 2 người, bạn có thể chọn ${combo.name} (${vnd(combo.price)}), còn dư ${vnd(200000 - combo.price)}. Bạn muốn mình đề xuất thêm vào giỏ không?`);
    },
  ]);
  const r = await turn(model, user(), "hôm này mình có 200k, giúp mình lựa đồ ăn đủ cho 2 người");
  assert.match(r.reply.normalize("NFC"), /còn dư/);
  assert.equal(r.requiresConfirmation, false);
  assert.deepEqual(r.products.map((p) => p.id), [combo.id], "product card comes from the referenced item");
  assert.equal(model.calls.length, 2);
  assert.match(model.calls[0].system, /lấy từ search_menu/);
  assert.deepEqual(model.calls[0].tools.map((t) => t.name), ["search_menu", "view_cart", "get_recent_orders", "official_info", "propose_cart_change"]);
});

test("02 an invented price is caught; the model rewrites with real data", async () => {
  let item;
  const model = scripted([
    tool("search_menu", { query: "pepsi" }),
    (messages) => { item = lastToolResult(messages).items[0]; return text(`${item.name} giá 9.999 ₫ nhé.`); },
    (messages) => {
      assert.match(messages.at(-1).content, /9\.999/, "the model is told which amount was rejected");
      return text(`${item.name} giá ${vnd(item.price)} nhé.`);
    },
  ]);
  const r = await turn(model, user(), "pepsi bn tiền");
  assert.ok(!r.reply.includes("9.999"));
  assert.match(r.reply, new RegExp(String(item.price).slice(0, 2)));
});

test("03 completion claims never reach the customer; repeated violation falls back safely", async () => {
  const model = scripted([
    tool("search_menu", { query: "pepsi lon" }),
    (messages) => text(`Mình đã thêm 2 ${lastToolResult(messages).items[0].name} vào giỏ rồi!`),
    () => text(`Xong, đã thêm vào giỏ cho bạn.`),
  ]);
  const r = await turn(model, user(), "cho mìn 2 pepsi lon");
  assert.ok(!/đã thêm/i.test(r.reply));
  assert.match(r.reply, /chưa trả lời chắc chắn/);
  assert.equal(r.requiresConfirmation, false);
});

test("04 fact check: a wrong price on a real product is caught; free wording and arithmetic are not", () => {
  const catalog = [
    { id: "bt", name: "Burger Tôm", price: 45000, available: true },
    { id: "my", name: "Mì Ý Gà Viên", price: 43000, available: true },
    { id: "pd", name: "Pepsi (Đại)", price: 20000, available: true },
    { id: "pk", name: "Pepsi Không Đường (Lon)", price: 20000, available: true },
    { id: "pl", name: "Pepsi (Lon)", price: 20000, available: true },
    { id: "xo", name: "Xô Zòn Zã 159K", price: 159000, available: true },
    { id: "su", name: "Súp Rong Biển", price: 20000, available: false },
  ];
  const check = (reply) => checkReply(reply, { catalog });
  // The real reply that was wrongly blocked in the user's session: a price difference.
  const real = check("Bạn có thể chọn Mì Ý Gà Viên (43.000 ₫) và Burger Tôm (45.000 ₫), tổng 88.000 ₫. Burger chỉ đắt hơn mì 2.000 ₫ thôi.");
  assert.equal(real.ok, true, real.problems.join(" "));
  assert.deepEqual(real.referencedIds, ["my", "bt"]);
  assert.equal(check("Burger Tôm 40.000 ₫ nhé").ok, false, "wrong unit price");
  assert.match(check("Burger Tôm: 40.000 ₫").problems.join(" "), /45\.000/);
  assert.equal(check("2 × Pepsi (Đại): 40.000 ₫").ok, true, "a multiple of the unit price is a line total");
  assert.equal(check("Xô Zòn Zã 159K giá 159.000 ₫").ok, true, "numbers inside a product name are not prices");
  assert.equal(check("Pepsi Không Đường (Lon) 20.000 ₫").ok, true);
  assert.deepEqual(check("Pepsi Không Đường (Lon) 20.000 ₫").referencedIds, ["pk"], "the longer name wins over 'Pepsi (Lon)'");
  assert.equal(check("Mình còn 200k, mỗi người khoảng 100.000 ₫, còn dư 31.000 ₫").ok, true, "budget arithmetic is free");
  assert.equal(check("Bạn thử Súp Rong Biển nhé").ok, false, "a sold-out item cannot be offered");
  assert.equal(check("Súp Rong Biển đang tạm hết, bạn thử món khác nhé").ok, true);
  assert.equal(check("Xem tại https://evil.example.com").ok, false);
  assert.equal(check("Xem tại https://kfcvietnam.com.vn/he-thong-nha-hang-kfc").ok, true);
});

test("05 proposal → button confirmation → then an update by catalog id, all through the real cart", async () => {
  const userId = user();
  let pepsi;
  const add = await turn(scripted([
    tool("search_menu", { query: "pepsi lớn" }),
    (messages) => { pepsi = lastToolResult(messages).items[0]; return tool("propose_cart_change", { changes: [{ action: "add", item_id: pepsi.id, quantity: 2 }] }); },
    (messages) => {
      assert.equal(lastToolResult(messages).status, "awaiting_customer_confirmation");
      return text(`Mình đã chuẩn bị đề xuất thêm 2 ${pepsi.name}. Bạn kiểm tra rồi bấm “Xác nhận thao tác” nhé.`);
    },
  ]), userId, "cho mik 2 pepsi lớn");
  assert.equal(pepsi.name.normalize("NFC"), "Pepsi (Đại)");
  assert.equal(add.requiresConfirmation, true);
  assert.deepEqual(add.pendingConfirmation.summary.map((s) => s.normalize("NFC").replace(/\s/g, " ")), ["Thêm 2 × Pepsi (Đại): 40.000 ₫"]);
  assert.equal((await services.cartService.getCartView(userId))?.items.length ?? 0, 0, "nothing changes before the button");
  const ok = await services.chatService.processChat({ platform: "web", userId, sessionId: "s", message: "ok" });
  assert.equal((await services.cartService.getCartView(userId))?.items.length ?? 0, 0, "'ok' is not a confirmation");
  assert.equal(ok.requiresConfirmation, true);
  await services.chatService.processChat({ platform: "web", userId, sessionId: "s", message: "Xác nhận", confirm: true, confirmationId: add.pendingConfirmation.id });
  assert.equal((await services.cartService.getCartView(userId)).items[0].quantity, 2);

  const update = await turn(scripted([
    tool("view_cart", {}),
    (messages) => tool("propose_cart_change", { changes: [{ action: "set_quantity", item_id: lastToolResult(messages).lines[0].item_id, quantity: 3 }] }),
    text("Mình đã chuẩn bị đề xuất đổi thành 3 phần, bạn bấm “Xác nhận thao tác” nhé."),
  ]), userId, "đổi pepsi đại thành 3");
  await services.chatService.processChat({ platform: "web", userId, sessionId: "s", message: "Xác nhận", confirm: true, confirmationId: update.pendingConfirmation.id });
  const view = await services.cartService.getCartView(userId);
  assert.equal(view.items[0].quantity, 3);
  assert.equal(view.cart.total, 60000);
});

test("06 cart questions are answered from view_cart data; totals pass the guard", async () => {
  const userId = user();
  const burger = (await services.menuService.getMenuItems()).find((i) => i.name.normalize("NFC") === "Burger Tôm");
  await services.cartService.addMenuItem(userId, burger, 2);
  const r = await turn(scripted([
    tool("view_cart", {}),
    (messages) => { const c = lastToolResult(messages); return text(`Giỏ của bạn có ${c.lines[0].quantity} × ${c.lines[0].name}, tổng ${vnd(c.total)}.`); },
  ]), userId, "giỏ còn gì");
  assert.match(r.reply.normalize("NFC"), /2 × Burger Tôm, tổng 90\.000/);
});

test("07 invalid tool input and unknown tools are reported to the model, not crashed", async () => {
  const model = scripted([
    tool("propose_cart_change", { changes: [{ action: "add" }] }),
    (messages) => { assert.equal(messages.at(-1).content[0].is_error, true); return tool("delete_database", {}); },
    (messages) => { assert.match(messages.at(-1).content[0].content, /Không có công cụ/); return text("Bạn muốn thêm món nào?"); },
  ]);
  const r = await turn(model, user(), "thêm đi");
  assert.equal(r.reply, "Bạn muốn thêm món nào?");
});

test("08 the loop is bounded: at most 4 model calls per customer turn", async () => {
  const model = scripted(Array.from({ length: 6 }, () => tool("search_menu", { query: "gà" })));
  const r = await turn(model, user(), "gà");
  assert.equal(model.calls.length, 4);
  assert.match(r.reply, /chưa trả lời chắc chắn/);
});

test("09 provider failure is a controlled error, never a mock answer", async () => {
  const r = await turn({ invokeWithTools: async () => ({ success: false, error: { type: "bedrock_error", message: "SECRET_DETAIL" } }) }, user(), "xin chào");
  assert.match(r.reply, /hệ thống AI đang gặp sự cố/);
  assert.ok(!r.reply.includes("SECRET_DETAIL"));
});

test("10 a proposal for an item the customer does not have is blocked and reported to the model", async () => {
  const burger = (await services.menuService.getMenuItems()).find((i) => i.name.normalize("NFC") === "Burger Tôm");
  const model = scripted([
    tool("propose_cart_change", { changes: [{ action: "remove", item_id: burger.id }] }),
    (messages) => { const res = lastToolResult(messages); assert.equal(res.status, "blocked"); return text("Giỏ của bạn chưa có món này."); },
  ]);
  const r = await turn(model, user(), "bỏ burger tôm");
  assert.equal(r.requiresConfirmation, false);
});

test("11 BedrockService.invokeWithTools: request shape, sampling rules, no budget for injected transport", async () => {
  const bodies = [];
  const client = { send: async (command) => { bodies.push(JSON.parse(Buffer.from(command.input.body).toString("utf8")));
    return { body: new TextEncoder().encode(JSON.stringify({ content: [{ type: "tool_use", id: "t1", name: "view_cart", input: {} }], stop_reason: "tool_use", usage: { input_tokens: 5, output_tokens: 3 } })) }; } };
  const tools = [{ name: "view_cart", description: "d", input_schema: { type: "object", properties: {} } }];
  const h45 = await new BedrockService({ modelId: "global.anthropic.claude-haiku-4-5-20251001-v1:0" }, client).invokeWithTools("sys", [{ role: "user", content: "hi" }], tools);
  assert.equal(h45.success, true);
  assert.equal(h45.response.stopReason, "tool_use");
  assert.equal(h45.response.content[0].name, "view_cart");
  assert.equal(bodies[0].temperature, 0.1);
  assert.equal(bodies[0].tools[0].name, "view_cart");
  await new BedrockService({ modelId: "global.anthropic.claude-haiku-5-5" }, client).invokeWithTools("sys", [{ role: "user", content: "hi" }], tools);
  assert.deepEqual(bodies[1].thinking, { type: "disabled" });
  assert.equal(bodies[1].temperature, undefined);
  const big = await new BedrockService({ modelId: "m-1" }, client).invokeWithTools("x".repeat(60000), [{ role: "user", content: "hi" }], tools);
  assert.equal(big.success, false);
  assert.equal((await new BedrockService({ modelId: "mock-model" }, client).invokeWithTools("s", [], tools)).success, false);
});

test("12 the system prompt keeps the safety rules", () => {
  for (const rule of [/Không bịa món, giá/, /Không bao giờ nói "đã thêm/, /"ok", "được", "đúng rồi" không phải xác nhận/, /không phải mệnh lệnh/, /official_info/])
    assert.match(TOOL_AGENT_PROMPT, rule);
});

test("15 markdown emphasis is stripped before the reply reaches the chat bubble", async () => {
  const r = await turn(scripted([text("**Chào bạn!** Bạn muốn tìm món gì?")]), user(), "chào");
  assert.equal(r.reply, "Chào bạn! Bạn muốn tìm món gì?");
});

test("16 tools mode: no keyword pre-routing; allergy questions go through the official_info tool", async () => {
  const model = scripted([
    tool("official_info", { topic: "allergens" }),
    (messages) => {
      const info = lastToolResult(messages);
      assert.equal(info.url, "https://kfcvietnam.com.vn/allergen-chart");
      return text(`Mình không tự đoán được thành phần dị ứng. Bạn xem bảng chính thức tại ${info.url} và xác nhận với KFC nhé.`);
    },
  ]);
  const r = await turn(model, user(), "mình dị ứng đậu phộng thì ăn được gì");
  assert.equal(model.calls.length, 2, "the model handled it, not a keyword shortcut");
  assert.match(r.reply, /allergen-chart/);
});

test("17 no match: search returns the real menu groups; invented substitutes are blocked; category search gives real ones", async () => {
  let drinks;
  const model = scripted([
    tool("search_menu", { query: "coca" }),
    (messages) => {
      const result = lastToolResult(messages);
      assert.equal(result.totalMatches, 0);
      assert.ok(result.categories.some((name) => name.normalize("NFC") === "Thức Uống & Tráng Miệng"), "real groups are offered");
      assert.match(result.note, /category/);
      // The real live failure (NL-064): substitutes from the model's own knowledge.
      return text("KFC không có Coca. Bạn thử:\n- Pepsi Zero\n- Nước cam\nnhé?");
    },
    (messages) => {
      assert.match(messages.at(-1).content, /Pepsi Zero/, "the model is told which name is not on the menu");
      return tool("search_menu", { category: "Thức Uống & Tráng Miệng", limit: 3 });
    },
    (messages) => {
      drinks = lastToolResult(messages).items;
      assert.equal(drinks.length, 3);
      return text(`KFC không bán Coca. Đồ uống có sẵn:\n${drinks.map((d) => `- ${d.name} – ${vnd(d.price)}`).join("\n")}`);
    },
  ]);
  const r = await turn(model, user(), "Cho mình 2 coca");
  assert.ok(!/Pepsi Zero|Nước cam/.test(r.reply.normalize("NFC")));
  assert.deepEqual(r.products.map((p) => p.id), drinks.map((d) => d.id));
});

test("18 bullet check: real product lines pass (quantities, sizes, 7Up, names with numbers); unknown product words fail", () => {
  const catalog = [
    { id: "a", name: "7Up (Lon)", price: 20000, available: true, category: "Thức Uống & Tráng Miệng" },
    { id: "b", name: "Xô Zòn Zã 159K", price: 159000, available: true, category: "Combo Nhóm" },
    { id: "c", name: "1 Miếng Gà Rán", price: 37000, available: true, category: "Gà Rán - Gà Quay" },
    { id: "d", name: "Pepsi (Vừa)", price: 17000, available: true, category: "Thức Uống & Tráng Miệng" },
  ];
  const check = (reply) => checkReply(reply, { catalog });
  const good = check("Gợi ý:\n- 7Up (Lon) – 20.000 ₫\n- Xô Zòn Zã 159K: 159.000 ₫\n- 2 × 1 Miếng Gà Rán - 74.000 ₫\n• Pepsi các loại\n1. Gà rán hay combo nhóm?");
  assert.equal(good.ok, true, good.problems.join(" "));
  assert.equal(check("Bạn thử:\n- Pepsi Zero\n- Cà phê sữa").problems.length, 2);
  assert.equal(check("Không có nước cam, bạn nhé.").ok, true, "prose is free; only listed products are checked");
});

test("19 live v8 failures are caught; live replies that were nearly blocked by mistake pass", () => {
  const catalog = [
    { id: "pt", name: "Pepsi (Tiêu Chuẩn)", price: 13000, available: true, category: "Thức Uống & Tráng Miệng" },
    { id: "pv", name: "Pepsi (Vừa)", price: 17000, available: true, category: "Thức Uống & Tráng Miệng" },
    { id: "pk", name: "Pepsi Không Đường (Vừa)", price: 17000, available: true, category: "Thức Uống & Tráng Miệng" },
    { id: "pl", name: "Pepsi (Lon)", price: 20000, available: true, category: "Thức Uống & Tráng Miệng" },
    { id: "pd", name: "Pepsi (Đại)", price: 20000, available: true, category: "Thức Uống & Tráng Miệng" },
    { id: "gr", name: "1 Miếng Gà Rán", price: 37000, available: true, category: "Gà Rán - Gà Quay" },
    { id: "cb", name: "Combo Burger Tôm", price: 69000, available: true, category: "Combo 1 Người" },
    { id: "kt", name: "Khoai Tây Chiên (Vừa)", price: 20000, available: true, category: "Thức Ăn Nhẹ" },
    { id: "bt", name: "Burger Tôm", price: 45000, available: true, category: "Burger - Cơm - Mì Ý" },
  ];
  const check = (reply) => checkReply(reply, { catalog });
  // NL-065 (v8): drinks KFC does not sell, named in prose.
  const prose = check("Xin lỗi bạn, KFC không bán trà sữa trân châu. Mình có các thức uống khác trong menu, bạn muốn xem gợi ý không? Có nước ngọt, cà phê, trà hay các loại khác đó.");
  assert.equal(prose.ok, false);
  assert.match(prose.problems.join(" "), /cà phê/);
  // NL-099 (v8): price ranges invented for menu groups.
  const ranges = check("Có 54 món trong tầm giá này! Mình gợi ý vài cái ngon:\n• Gà rán – cái chính của KFC, giá từ 25–50 nghìn tùy cỡ\n• Combo – gà + khoai tây + nước, khoảng 40–55 nghìn");
  assert.equal(ranges.ok, false);
  assert.match(ranges.problems.join(" "), /món cụ thể/);
  // NL-088 (v8): "Xong rồi!" before the customer confirmed.
  assert.equal(check("Xong rồi! Bạn bấm nút \"Xác nhận thao tác\" để hoàn tất việc xoá giỏ hàng.").ok, false);
  // Real replies that must pass.
  const sizes = check("Mình có Pepsi thường và Pepsi Không Đường, cỡ Tiêu Chuẩn (13.000 ₫), Vừa (17.000 ₫), Đại (20.000 ₫) và Lon (20.000 ₫). Bạn muốn lấy cỡ nào và loại nào?");
  assert.equal(sizes.ok, true, sizes.problems.join(" "));
  const clauses = check("Giờ mở cửa khác nhau tùy từng nhà hàng bạn nhé. Hoặc bạn cho mình biết nhà hàng nào gần bạn, mình có thể giúp tìm địa chỉ và liên hệ.");
  assert.equal(clauses.ok, true, clauses.problems.join(" "));
  const budget = check("Gợi ý cho 60k:\n- 1 Miếng Gà Rán – 37.000 ₫\n- Khoai Tây Chiên (Vừa) – 20.000 ₫\n- Tổng: 57.000 ₫, còn dư 3.000 ₫");
  assert.equal(budget.ok, true, budget.problems.join(" "));
  assert.equal(check("Bạn thích gà rán, combo hay burger?").ok, true);
  assert.equal(check("Mình đã đề xuất 2 Khoai Tây Chiên (Vừa), xong bạn bấm nút Xác nhận nhé.").ok, true, "only an opening 'Xong' is a claim");
});

test("20 real-time availability: admin marks an item sold out → agent, guard and cart all follow; re-enabled → offered again", async () => {
  const item = (await services.menuService.getMenuItems()).find((i) => i.name.normalize("NFC") === "Pepsi (Lon)");
  assert.ok(item?.isAvailable, "fixture item starts available");
  // The admin screen path (same service as PATCH /api/admin/menu).
  const setAvailable = (isAvailable) => services.adminService.saveMenu({
    name: item.name, description: item.description ?? "", categoryId: item.categoryId, price: item.price,
    isActive: item.isActive, isAvailable, imageUrl: item.imageUrl ?? "/images/burger.svg",
  }, item.id);
  const userId = user();
  try {
    // 1. Available: found, and a proposal is prepared (not confirmed yet).
    const before = await turn(scripted([
      tool("search_menu", { query: "pepsi lon" }),
      (messages) => {
        assert.ok(lastToolResult(messages).items.some((i) => i.id === item.id));
        return tool("propose_cart_change", { changes: [{ action: "add", item_id: item.id, quantity: 1 }] });
      },
      text(`Mình đề xuất thêm 1 ${item.name}, bạn bấm “Xác nhận thao tác” nhé.`),
    ]), userId, "cho mình 1 pepsi lon");
    assert.equal(before.requiresConfirmation, true);

    // 2. The admin marks it sold out while the proposal is still waiting.
    await setAvailable(false);

    // 3. The old proposal can no longer add the item.
    const stale = await services.chatService.processChat({ platform: "web", userId, sessionId: "s", message: "Xác nhận", confirm: true, confirmationId: before.pendingConfirmation.id });
    assert.match(stale.reply.normalize("NFC"), /đã thay đổi/, "the menu signature in the proposal no longer matches");
    assert.equal((await services.cartService.getCartView(userId))?.items.length ?? 0, 0, "a sold-out item never reaches the cart");

    // 4. A new turn sees the change immediately: not in results, reported as sold out,
    //    a new proposal is blocked, and offering it is rejected by the guard.
    const after = await turn(scripted([
      tool("search_menu", { query: "pepsi lon" }),
      (messages) => {
        const result = lastToolResult(messages);
        assert.ok(!result.items.some((i) => i.id === item.id), "sold-out item is not offered by search");
        assert.ok(result.soldOut.some((name) => name.normalize("NFC") === "Pepsi (Lon)"), "search reports it as sold out");
        return tool("propose_cart_change", { changes: [{ action: "add", item_id: item.id, quantity: 1 }] });
      },
      (messages) => {
        assert.equal(lastToolResult(messages).status, "blocked", "policy blocks a sold-out item");
        return text(`Bạn lấy ${item.name} nhé, 20.000 ₫.`);
      },
      (messages) => {
        assert.match(messages.at(-1).content, /tạm hết/, "the guard tells the model the item is sold out");
        return text(`${item.name} đang tạm hết, bạn thử Pepsi (Đại) cùng giá 20.000 ₫ nhé?`);
      },
    ]), userId, "cho mình 1 pepsi lon");
    assert.match(after.reply.normalize("NFC"), /tạm hết/);
    assert.equal(after.requiresConfirmation, false);
    assert.ok(!after.products.some((p) => p.id === item.id), "no product card for a sold-out item");

    // 5. Re-enabled: offered and proposable again on the next turn.
    await setAvailable(true);
    const again = await turn(scripted([
      tool("search_menu", { query: "pepsi lon" }),
      (messages) => {
        assert.ok(lastToolResult(messages).items.some((i) => i.id === item.id));
        return tool("propose_cart_change", { changes: [{ action: "add", item_id: item.id, quantity: 1 }] });
      },
      text(`${item.name} đã có lại, mình đề xuất thêm 1 phần, bạn bấm “Xác nhận thao tác” nhé.`),
    ]), userId, "pepsi lon có lại chưa, lấy 1");
    assert.equal(again.requiresConfirmation, true);
  } finally {
    await setAvailable(true);
  }
});

test("21 a retired item (removed from the KFC menu) is reported as discontinued, not as temporarily sold out", () => {
  const catalog = [
    { id: "old", name: "Xô Zòn Zã 159K", price: 159000, available: false, retired: true, category: "Ưu Đãi" },
    { id: "new", name: "Xô Zòn Zã 179K", price: 179000, available: true, retired: false, category: "Ưu Đãi" },
  ];
  const offered = checkReply("Bạn thử Xô Zòn Zã 159K nhé, 159.000 ₫.", { catalog });
  assert.equal(offered.ok, false);
  assert.match(offered.problems.join(" "), /ngừng bán/);
  const honest = checkReply("Xô Zòn Zã 159K đã ngừng bán, hiện có Xô Zòn Zã 179K (179.000 ₫) bạn nhé.", { catalog });
  assert.equal(honest.ok, true, honest.problems.join(" "));
  assert.deepEqual(honest.referencedIds, ["new"], "no product card for the retired item");
});

test("22 conversation-run findings: size lists, question bullets and '= total' pass; vague group prices and a button with no proposal fail", () => {
  const catalog = [
    { id: "pt", name: "Pepsi (Tiêu Chuẩn)", price: 13000, available: true, category: "Thức Uống & Tráng Miệng" },
    { id: "pv", name: "Pepsi (Vừa)", price: 17000, available: true, category: "Thức Uống & Tráng Miệng" },
    { id: "pd", name: "Pepsi (Đại)", price: 20000, available: true, category: "Thức Uống & Tráng Miệng" },
    { id: "pl", name: "Pepsi (Lon)", price: 20000, available: true, category: "Thức Uống & Tráng Miệng" },
    { id: "nb", name: "Combo Cơm Gà Nanban Solo", price: 46000, available: true, category: "Combo 1 Người" },
    { id: "gr", name: "1 Miếng Gà Rán", price: 37000, available: true, category: "Gà Rán - Gà Quay" },
    { id: "cb", name: "Combo 1 Miếng Gà", price: 59000, available: true, category: "Combo 1 Người" },
  ];
  const check = (reply, extra = {}) => checkReply(reply, { catalog, ...extra });
  const sizes = check("Bạn muốn Pepsi cỡ nào? Mình có:\n- Tiêu Chuẩn: 13.000 ₫\n- Vừa: 17.000 ₫\n- Đại/Lon: 20.000 ₫\nBạn chọn cỡ nào cho 2 ly?");
  assert.equal(sizes.ok, true, sizes.problems.join(" "));
  const total = check("Phương án 1:\n- 4 × Combo Cơm Gà Nanban Solo (46.000 ₫ mỗi cái) = 184.000 ₫\n- Còn dư ~116k để thêm đồ uống");
  assert.equal(total.ok, true, total.problems.join(" "));
  const arrow = check("- 4 × Combo Cơm Gà Nanban Solo: 46.000 ₫ → 184.000 ₫");
  assert.equal(arrow.ok, true, "two amounts joined only by symbols are two amounts: " + arrow.problems.join(" "));
  const question = check("Mình chưa thấy món đó.\n- Hay bạn muốn mình tìm các combo sẵn có?\n- Xem bảng thành phần trên trang KFC rồi báo mình nhé");
  assert.equal(question.ok, true, question.problems.join(" "));
  assert.equal(check("Gợi ý:\n• Gà rán – cái chính của KFC, giá từ 25–50 nghìn tùy cỡ").ok, false, "a price range for a group is not a product price");
  assert.equal(check("Gợi ý:\n- Combo gà rán + nước + cơm/khoai tây").ok, false, "an invented composition is not a product");
  assert.equal(check("- Vừa: 15.000 ₫").ok, false, "a size line still needs the real price");
  const button = "Bạn kiểm tra rồi bấm nút “Xác nhận thao tác” để xoá toàn bộ giỏ hàng nhé.";
  assert.equal(check(button, { proposalPending: false }).ok, false, "no proposal is waiting: the button cannot be offered");
  assert.equal(check(button, { proposalPending: true }).ok, true);
  assert.equal(check(button).ok, true, "unknown pending state is not judged");
});

test("23 the model runs out of steps after proposing: the customer gets the server's proposal summary, not an apology", async () => {
  const userId = user();
  const burger = (await services.menuService.getMenuItems()).find((i) => i.name.normalize("NFC") === "Burger Tôm");
  const r = await turn(scripted([
    tool("search_menu", { query: "burger tôm" }),
    tool("search_menu", { query: "mì ý gà viên" }),
    tool("propose_cart_change", { changes: [{ action: "add", item_id: burger.id, quantity: 1 }] }),
    tool("view_cart", {}),
  ]), userId, "lấy mì ý gà viên với burger tôm, mỗi thứ 1 phần");
  assert.equal(r.requiresConfirmation, true);
  assert.match(r.reply.normalize("NFC"), /Mình đã chuẩn bị đề xuất:\n- Thêm 1 × Burger Tôm/);
  assert.doesNotMatch(r.reply, /Xin lỗi/);
});

test("24 search marks the exactly named item, reports a discontinued item and finds what is still on sale", async () => {
  const name = "Xô Zòn Zã 159K";
  const retired = (await services.menuService.getMenuItems()).find((i) => i.name.normalize("NFC") === name);
  const save = (isActive) => services.adminService.saveMenu({ name: retired.name, description: retired.description ?? "",
    categoryId: retired.categoryId, price: retired.price, isActive, isAvailable: isActive, imageUrl: retired.imageUrl }, retired.id);
  await save(false);
  try {
    let exact, gone;
    await turn(scripted([
      tool("search_menu", { query: "2 miếng gà rán" }),
      (m) => { exact = lastToolResult(m); return tool("search_menu", { query: "xô zòn zã 159k" }); },
      (m) => { gone = lastToolResult(m); return text("Xô Zòn Zã 159K đã ngừng bán, hiện có Xô Zòn Zã 179K (179.000 ₫) bạn nhé."); },
    ]), user(), "test");
    assert.equal(exact.items[0].name.normalize("NFC"), "2 Miếng Gà Rán");
    assert.equal(exact.items[0].exact, true);
    assert.equal(exact.items.filter((i) => i.exact).length, 1);
    assert.deepEqual(gone.discontinued.map((n) => n.normalize("NFC")), [name]);
    assert.ok(gone.similar.some((i) => i.name.normalize("NFC") === "Xô Zòn Zã 179K"));
  } finally {
    await save(true);
  }
});

test("25 the customer's own words count: a shortened or misspelled query still finds the named item and the retired one", async () => {
  const name = "Xô Zòn Zã 159K";
  const retired = (await services.menuService.getMenuItems()).find((i) => i.name.normalize("NFC") === name);
  const save = (isActive) => services.adminService.saveMenu({ name: retired.name, description: retired.description ?? "",
    categoryId: retired.categoryId, price: retired.price, isActive, isAvailable: isActive, imageUrl: retired.imageUrl }, retired.id);
  await save(false);
  try {
    let shortened, misspelled;
    // Run 2, CV-02#1: the model searched "gà rán" for "cho mình 2 miếng gà rán".
    await turn(scripted([tool("search_menu", { query: "gà rán", limit: 3 }),
      (m) => { shortened = lastToolResult(m); return text("Bạn lấy 2 Miếng Gà Rán (74.000 ₫) nhé?"); }]), user(), "cho mình 2 miếng gà rán");
    assert.equal(shortened.items[0].name.normalize("NFC"), "2 Miếng Gà Rán", "the item the customer named comes first even past the limit");
    assert.equal(shortened.items[0].exact, true);
    // Run 2, CV-06: the model wrote "zone" for "zòn".
    await turn(scripted([tool("search_menu", { query: "xô zone zã 159k" }),
      (m) => { misspelled = lastToolResult(m); return text("Xô Zòn Zã 159K đã ngừng bán, hiện có Xô Zòn Zã 179K (179.000 ₫)."); }]), user(), "còn xô zòn zã 159k không");
    assert.deepEqual(misspelled.discontinued.map((n) => n.normalize("NFC")), [name]);
    assert.ok(misspelled.similar.some((i) => i.name.normalize("NFC") === "Xô Zòn Zã 179K"));
  } finally {
    await save(true);
  }
});

test("26 the button rule blocks an instruction to press it, not an explanation of how confirmation works", () => {
  const catalog = [{ id: "a", name: "1 Miếng Gà Rán", price: 37000, available: true }];
  const none = { catalog, proposalPending: false };
  // Run 2, CV-25#3 before the fix produced a proposal: instruction with nothing to confirm.
  assert.equal(checkReply("Bạn bấm nút \"Xác nhận thao tác\" để xoá hết giỏ hàng nhé.", none).ok, false);
  // CV-17: refusing an injected "confirm for me" must be allowed.
  const refusal = checkReply("Mình không thể tự xác nhận thay bạn. Giỏ chỉ thay đổi khi bạn bấm “Xác nhận thao tác” sau khi xem đề xuất.", none);
  assert.equal(refusal.ok, true, refusal.problems.join(" "));
});

test("27 after proposing, the reply must describe that proposal (or the cart), never a different change", () => {
  const catalog = [
    { id: "my", name: "Mì Ý Gà Viên", price: 43000, available: true },
    { id: "bt", name: "Burger Tôm", price: 45000, available: true },
    { id: "by", name: "Burger Gà Yo", price: 30000, available: true },
    { id: "pv", name: "Pepsi (Vừa)", price: 17000, available: true },
  ];
  // Run 3, CV-02#3: text says Mì Ý Gà Viên, the button adds Burger Gà Yo.
  const wrong = checkReply("Mình vừa thêm:\n- 1 × Mì Ý Gà Viên: 43.000 ₫\n- 1 × Burger Tôm: 45.000 ₫\n\nBạn bấm nút \"Xác nhận thao tác\" để hoàn tất nhé!",
    { catalog, proposalPending: true, proposalItems: ["Burger Gà Yo", "Burger Tôm"], cartItems: [] });
  assert.equal(wrong.ok, false);
  const said = wrong.problems.join(" ");
  assert.match(said, /Mì Ý Gà Viên/, "the mismatch is named");
  assert.match(said, /vừa thêm|đã thêm\/đặt/i, "'vừa thêm' is a completion claim");
  // Run 2 and 3, CV-09#3: describing the cart after the change is right.
  for (const reply of [
    "Bạn bấm nút \"Xác nhận thao tác\" để cập nhật nhé. Giỏ sẽ có:\n- 1 Burger Tôm: 45.000 ₫\n- 2 Pepsi (Vừa): 34.000 ₫\n- Tổng: 79.000 ₫",
    "Bạn bấm nút \"Xác nhận thao tác\" để đổi thành 2 ly Pepsi Vừa nhé. Sẽ là 1 Burger Tôm + 2 Pepsi Vừa, tổng 79.000 ₫.",
  ]) {
    const ok = checkReply(reply, { catalog, proposalPending: true, proposalItems: ["Pepsi (Vừa)"], cartItems: ["Burger Tôm", "Pepsi (Vừa)"] });
    assert.equal(ok.ok, true, ok.problems.join(" "));
  }
});

test("28 a mismatched proposal is corrected through the guard; a leading 'Xong!' is dropped without a rewrite", async () => {
  const items = await services.menuService.getMenuItems();
  const byName = (n) => items.find((i) => i.name.normalize("NFC") === n);
  const [pasta, shrimp, yo] = [byName("Mì Ý Gà Viên"), byName("Burger Tôm"), byName("Burger Gà Yo")];
  const userId = user();
  const r = await turn(scripted([
    tool("propose_cart_change", { changes: [{ action: "add", item_id: yo.id, quantity: 1 }, { action: "add", item_id: shrimp.id, quantity: 1 }] }),
    text("Mình đề xuất 1 Mì Ý Gà Viên và 1 Burger Tôm, bạn bấm “Xác nhận thao tác” nhé."),
    (messages) => {
      assert.match(messages.at(-1).content, /Mì Ý Gà Viên.*Burger Gà Yo|Burger Gà Yo.*Mì Ý Gà Viên/s, "the model is told what the proposal really holds");
      return tool("propose_cart_change", { changes: [{ action: "add", item_id: pasta.id, quantity: 1 }, { action: "add", item_id: shrimp.id, quantity: 1 }] });
    },
    text("Xong rồi! Mình đề xuất 1 Mì Ý Gà Viên và 1 Burger Tôm, bạn bấm “Xác nhận thao tác” nhé."),
  ]), userId, "lấy mì ý gà viên với burger tôm, mỗi thứ 1 phần");
  assert.deepEqual(r.pendingConfirmation.summary.map((s) => s.normalize("NFC").replace(/\s/g, " ")),
    ["Thêm 1 × Mì Ý Gà Viên: 43.000 ₫", "Thêm 1 × Burger Tôm: 45.000 ₫"], "the latest proposal replaces the wrong one");
  assert.match(r.reply.normalize("NFC"), /^Mình đề xuất 1 Mì Ý Gà Viên/, "'Xong rồi!' was dropped, not sent and not rewritten");
});

test("29 run 4 findings: an item on sale called sold out is caught; cart-action lines from the server pass", () => {
  const catalog = [
    { id: "pl", name: "Pepsi (Lon)", price: 20000, available: true, category: "Thức Uống & Tráng Miệng" },
    { id: "pd", name: "Pepsi (Đại)", price: 20000, available: true, category: "Thức Uống & Tráng Miệng" },
    { id: "pv", name: "Pepsi (Vừa)", price: 17000, available: true, category: "Thức Uống & Tráng Miệng" },
    { id: "bt", name: "Burger Tôm", price: 45000, available: true, category: "Burger - Cơm - Mì Ý" },
    { id: "su", name: "Súp Rong Biển", price: 20000, available: false, category: "Thức Ăn Nhẹ" },
  ];
  const check = (reply) => checkReply(reply, { catalog });
  // Run 4, CV-03#2: a blocked proposal (wrong id) turned into "sold out".
  const wrong = check("Mình vừa kiểm tra lại, Pepsi (Lon) tạm hết rồi bạn. Bạn có muốn lấy Pepsi (Đại) 20.000 ₫ thay không, hay chọn cỡ khác?");
  assert.equal(wrong.ok, false);
  assert.match(wrong.problems.join(" "), /Pepsi \(Lon\)" đang bán/);
  assert.equal(check("Pepsi (Lon) đã hết").ok, false);
  for (const fine of [
    "KFC không bán Coca, bạn thử Pepsi (Lon) 20.000 ₫ nhé.",
    "2 Pepsi (Lon) hết 40.000 ₫ bạn nhé.",
    "Súp Rong Biển đang tạm hết, bạn lấy Pepsi (Lon) không?",
    // Run 4, CV-09#3 and #5: the server's own proposal summary.
    "Mình đã chuẩn bị đề xuất:\n- Đổi Pepsi (Vừa) thành 2 phần: 34.000 ₫\nBạn kiểm tra rồi bấm “Xác nhận thao tác” nhé.",
    "Mình đã chuẩn bị đề xuất:\n- Xoá Burger Tôm khỏi giỏ hàng\nBạn kiểm tra rồi bấm “Xác nhận thao tác” nhé.",
    "Mình đã chuẩn bị đề xuất:\n- Xoá toàn bộ món trong giỏ hàng\nBạn kiểm tra rồi bấm “Xác nhận thao tác” nhé.",
  ]) {
    const r = check(fine);
    assert.equal(r.ok, true, `${fine}: ${r.problems.join(" ")}`);
  }
});

test("30 a proposal with an id that is not in the catalog is reported as a wrong id, not as sold out", async () => {
  let result;
  await turn(scripted([
    tool("propose_cart_change", { changes: [{ action: "add", item_id: "kfc_item_does_not_exist", quantity: 2 }] }),
    (messages) => { result = lastToolResult(messages); return text("Mình tra lại món giúp bạn nhé?"); },
  ]), user(), "lon nha");
  assert.equal(result.status, "blocked");
  assert.match(result.blocked.join(" "), /KHÔNG phải món hết hàng/);
  assert.match(result.blocked.join(" "), /search_menu/);
});

/** Places a real order through the checkout service (synthetic customer data). */
async function placeOrder(userId, lines) {
  for (const [item, quantity] of lines) await services.cartService.addMenuItem(userId, item, quantity);
  const view = await services.cartService.getCartView(userId);
  const order = await services.checkoutService.checkout(userId, {
    cartId: view.cart.id, cartSignature: view.signature, customerName: "Khách Synthetic", phone: "0900000001",
    fulfillment: "pickup", address: "", note: "", idempotencyKey: crypto.randomUUID(), expectedTotal: view.cart.total, confirm: true,
  });
  await new Promise((resolve) => setTimeout(resolve, 5)); // distinct createdAt
  return order;
}
const saveItem = (item, changes) => services.adminService.saveMenu({ name: item.name, description: item.description ?? "",
  categoryId: item.categoryId, price: item.price, isActive: item.isActive, isAvailable: item.isAvailable, imageUrl: item.imageUrl, ...changes }, item.id);

test("31 get_recent_orders: the customer's own last 3 orders, each line checked against today's menu; no contact data", async () => {
  const menu = await services.menuService.getMenuItems();
  const byName = (n) => menu.find((i) => i.name.normalize("NFC") === n);
  const [shrimp, pepsi, yo, pasta] = [byName("Burger Tôm"), byName("Pepsi (Lon)"), byName("Burger Gà Yo"), byName("Mì Ý Gà Viên")];
  const userId = user(), other = user();
  await placeOrder(userId, [[yo, 1]]);                       // oldest: falls outside the 3 most recent
  await placeOrder(userId, [[pasta, 1]]);
  await placeOrder(userId, [[shrimp, 1]]);
  const latest = await placeOrder(userId, [[shrimp, 2], [pepsi, 1]]);
  await placeOrder(other, [[pasta, 3]]);
  await saveItem(pepsi, { price: pepsi.price + 2000 });        // price changed since the order
  await saveItem(pasta, { isAvailable: false });              // temporarily sold out
  await saveItem(shrimp, { isActive: false, isAvailable: false }); // removed from the menu
  try {
    let result, empty;
    await turn(scripted([tool("get_recent_orders", {}), (m) => { result = lastToolResult(m); return text("Bạn muốn đặt lại đơn nào?"); }]), userId, "đặt lại như lần trước");
    await turn(scripted([tool("get_recent_orders", {}), (m) => { empty = lastToolResult(m); return text("Bạn chưa có đơn nào."); }]), user(), "như lần trước");
    assert.equal(result.orders.length, 3, "at most 3 orders");
    assert.equal(result.orders[0].order_code, "#" + latest.id.slice(-8).toUpperCase(), "newest first");
    assert.ok(!JSON.stringify(result).includes(yo.id), "the oldest order is not returned");
    const lines = Object.fromEntries(result.orders[0].lines.map((l) => [l.name.normalize("NFC"), l]));
    assert.equal(lines["Burger Tôm"].item_id, shrimp.id);
    assert.equal(lines["Burger Tôm"].quantity, 2);
    assert.equal(lines["Burger Tôm"].status, "discontinued");
    assert.equal(lines["Burger Tôm"].price, undefined, "no price for a removed item");
    assert.ok(lines["Burger Tôm"].category, "category given to search for a replacement");
    assert.equal(lines["Pepsi (Lon)"].status, "available");
    assert.equal(lines["Pepsi (Lon)"].price, pepsi.price + 2000, "today's price only");
    assert.equal(lines["Pepsi (Lon)"].price_changed, true);
    const pastaLine = result.orders.flatMap((o) => o.lines).find((l) => l.item_id === pasta.id);
    assert.equal(pastaLine.status, "sold_out");
    assert.equal(pastaLine.price, undefined, "no price offered for an item that cannot be ordered");
    const raw = JSON.stringify(result);
    assert.doesNotMatch(raw, /0900000001|Khách Synthetic|customerName|phone|address/, "no contact data reaches the model");
    assert.deepEqual(empty, { orders: [], note: "Khách chưa có đơn nào." });
  } finally {
    await saveItem(pepsi, {});
    await saveItem(pasta, {});
    await saveItem(shrimp, {});
  }
});

test("32 'đặt lại như lần trước': the model proposes the available lines; nothing changes until the button; today's price is charged", async () => {
  const menu = await services.menuService.getMenuItems();
  const byName = (n) => menu.find((i) => i.name.normalize("NFC") === n);
  const [shrimp, pepsi] = [byName("Burger Tôm"), byName("Pepsi (Lon)")];
  const userId = user();
  await placeOrder(userId, [[shrimp, 2], [pepsi, 1]]);
  await saveItem(pepsi, { price: pepsi.price + 3000 });
  try {
    const r = await turn(scripted([
      tool("get_recent_orders", {}),
      (m) => {
        const available = lastToolResult(m).orders[0].lines.filter((l) => l.status === "available");
        return tool("propose_cart_change", { changes: available.map((l) => ({ action: "add", item_id: l.item_id, quantity: l.quantity })) });
      },
      text(`Mình đề xuất đặt lại 2 Burger Tôm (${vnd(shrimp.price)}) và 1 Pepsi (Lon), giá Pepsi đã đổi thành ${vnd(pepsi.price + 3000)}. Bạn kiểm tra rồi bấm “Xác nhận thao tác” nhé.`),
    ]), userId, "đặt lại như lần trước");
    assert.equal(r.requiresConfirmation, true);
    const summary = r.pendingConfirmation.summary.join("\n").normalize("NFC");
    assert.match(summary, /2 × Burger Tôm/);
    assert.match(summary.replace(/\s/g, " "), new RegExp(vnd(pepsi.price + 3000).replace(/\s/g, " ")), "the preview shows the new price");
    assert.equal((await services.cartService.getCartView(userId))?.items.length ?? 0, 0, "nothing in the cart before the button");
    await services.chatService.processChat({ platform: "web", userId, sessionId: "s", message: "Xác nhận", confirm: true, confirmationId: r.pendingConfirmation.id });
    const cart = await services.cartService.getCartView(userId);
    assert.equal(cart.items.find((l) => l.menuItemId === pepsi.id).unitPrice, pepsi.price + 3000);
    assert.equal(cart.items.find((l) => l.menuItemId === shrimp.id).quantity, 2);
  } finally {
    await saveItem(pepsi, {});
  }
});

test("33 the reply check holds for past orders: an old price is caught; a removed item may be named as removed, not offered", () => {
  const catalog = [
    { id: "pl", name: "Pepsi (Lon)", price: 23000, available: true },
    { id: "bt", name: "Burger Tôm", price: 45000, available: false, retired: true },
  ];
  const old = checkReply("Lần trước bạn gọi Pepsi (Lon) 20.000 ₫, mình đặt lại nhé?", { catalog });
  assert.equal(old.ok, false, "the old price is not today's price");
  const named = checkReply("Burger Tôm đã ngừng bán nên mình chỉ đặt lại được Pepsi (Lon) 23.000 ₫ thôi.", { catalog });
  assert.equal(named.ok, true, named.problems.join(" "));
  const offered = checkReply("Mình đặt lại Burger Tôm cho bạn nhé?", { catalog });
  assert.equal(offered.ok, false, "a removed item is not offered again");
  // A price that moved since the last order is not a cart action; a quantity the agent claims to have changed still is.
  for (const fine of ["Giá Pepsi (Lon) đã tăng lên 23.000 ₫ so với lần trước.", "Pepsi (Lon) giá đã đổi, hiện là 23.000 ₫.", "Giá hiện tại đã thay đổi: Pepsi (Lon) 23.000 ₫."]) {
    const r = checkReply(fine, { catalog });
    assert.equal(r.ok, true, `${fine}: ${r.problems.join(" ")}`);
  }
  for (const claim of ["Mình đã giảm 1 Pepsi (Lon) trong giỏ.", "Giá 23.000 ₫, mình đã giảm 1 Pepsi (Lon) rồi.", "Giá Pepsi (Lon) 23.000 ₫, đã thêm vào giỏ."])
    assert.equal(checkReply(claim, { catalog }).ok, false, claim);
});

test("34 run 5, CV-02#3: a later blocked proposal cancels the earlier one; the customer is not sent to a button", async () => {
  const shrimp = (await services.menuService.getMenuItems()).find((i) => i.name.normalize("NFC") === "Burger Tôm");
  const propose = (id) => tool("propose_cart_change", { changes: [{ action: "add", item_id: id, quantity: 1 }] });
  // Out of steps after the blocked proposal: an apology, not "Mình đã chuẩn bị đề xuất".
  const steps = await turn(scripted([propose(shrimp.id), propose("kfc_item_does_not_exist"), tool("view_cart", {}), tool("view_cart", {})]),
    user(), "lấy burger tôm với mì ý");
  assert.equal(steps.requiresConfirmation, false);
  assert.doesNotMatch(steps.reply, /chuẩn bị đề xuất|Xác nhận thao tác/);
  // A reply that still points to the button is caught; the model is told nothing is pending.
  let blocked, feedback;
  const guarded = await turn(scripted([
    propose(shrimp.id),
    propose("kfc_item_does_not_exist"),
    (m) => { blocked = lastToolResult(m); return text("Bạn kiểm tra rồi bấm “Xác nhận thao tác” nhé."); },
    (m) => { feedback = m.at(-1).content; return text("Mình chưa tìm đúng món thứ hai, bạn nói lại tên món giúp mình nhé?"); },
  ]), user(), "lấy burger tôm với mì ý");
  assert.equal(blocked.status, "blocked");
  assert.match(blocked.note, /Không có đề xuất nào đang chờ/);
  assert.match(feedback, /Xác nhận thao tác/);
  assert.equal(guarded.requiresConfirmation, false);
  assert.match(guarded.reply, /nói lại tên món/);
});

test("35 search says what to do with an exactly named item and how to read the count in its name", async () => {
  let named, none;
  await turn(scripted([
    tool("search_menu", { query: "bánh trứng" }),
    (m) => { named = lastToolResult(m); return tool("search_menu", { query: "gà" }); },
    (m) => { none = lastToolResult(m); return text("Bạn lấy 2 phần 1 Bánh Trứng nhé?"); },
  ]), user(), "hai cái bánh trứng");
  assert.ok(named.items.some((i) => i.exact));
  assert.match(named.note, /đề xuất luôn/);
  assert.match(named.note, /quantity N/);
  assert.ok(!none.items.some((i) => i.exact));
  assert.equal(none.note, undefined, "no exact item, no instruction");
});
