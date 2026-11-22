/* eslint-disable @typescript-eslint/no-require-imports -- Offline tests for WhatsApp confirmation buttons and chat checkout (issue #16, phase 4). Mock AI, demo catalog, fake Graph API, no network. */
require("./offline-network-guard.cjs");
const os = require("node:os"), fs = require("node:fs"), path = require("node:path");
Object.assign(process.env, {
  // Main flow: orders go to the kitchen (no redirect to the KFC website).
  AI_PROVIDER: "mock", PERSISTENCE_DRIVER: "local", KFC_PURCHASE_ASSISTANT: "0",
  LOCAL_DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), "kfc-whatsapp-checkout-")),
  SESSION_SECRET: "synthetic-whatsapp-checkout-signing-secret-2026",
  WHATSAPP_VERIFY_TOKEN: "verify-me", WHATSAPP_APP_SECRET: "synthetic-app-secret-for-offline-tests",
  WHATSAPP_ACCESS_TOKEN: "synthetic-access-token-do-not-log", WHATSAPP_PHONE_NUMBER_ID: "200000000000001", WHATSAPP_GRAPH_VERSION: "v21.0",
  CHANNEL_ID_SECRET: "synthetic-channel-id-secret-32-chars-min", CHANNEL_QUEUE_DRIVER: "local", CHANNEL_DEBOUNCE_MS: "20",
});
require("./register-typescript.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

// Fake Graph API: records every outbound payload.
const graph = [];
global.fetch = async (url, init) => {
  graph.push(JSON.parse(init.body));
  return new Response(JSON.stringify({ messages: [{ id: "wamid.OUT" + graph.length }] }), { status: 200, headers: { "content-type": "application/json" } });
};
const { services } = require("../src/lib/agent/agent-core.ts");
const route = require("../src/app/api/channels/whatsapp/webhook/route.ts");
const { localWhatsAppRuntime } = require("../src/lib/channels/whatsapp/local-runtime.ts");
const { readWhatsAppConfig } = require("../src/lib/channels/whatsapp/config.ts");
const { channelUserId } = require("../src/lib/channels/whatsapp/identity.ts");
const { parseButton, proposalMessage, BUTTON } = require("../src/lib/channels/messages.ts");
const { notifyOrderStatus, orderStatusMessage } = require("../src/lib/channels/order-notifications.ts");
const { startCheckout, CHECKOUT_TTL_MS } = require("../src/lib/channels/checkout-flow.ts");
const { agentCoreChatPort } = require("../src/channels/lambda/channel-worker.ts");

const runtime = localWhatsAppRuntime(readWhatsAppConfig());
let seq = 0;
/**
 * Sends customer messages (text, or {id, title} for a button) through the signed webhook and returns the replies.
 * An array delivers several webhooks before any of them is processed (e.g. a double tap).
 */
async function say(waId, input, name = "Khách Test") {
  for (const one of Array.isArray(input) ? input : [input]) {
    const message = typeof one === "string"
      ? { type: "text", text: { body: one } }
      : { type: "interactive", interactive: { type: "button_reply", button_reply: { id: one.id, title: one.title ?? "nút" } } };
    const raw = JSON.stringify({ object: "whatsapp_business_account", entry: [{ id: "1", changes: [{ field: "messages", value: {
      messaging_product: "whatsapp", metadata: { display_phone_number: "15550000000", phone_number_id: "200000000000001" },
      contacts: [{ profile: { name }, wa_id: waId }],
      messages: [{ from: waId, id: "wamid.C" + (++seq), timestamp: String(Math.floor(Date.now() / 1000)), ...message }] } }] }] });
    const response = await route.POST(new Request("http://localhost/api/channels/whatsapp/webhook", { method: "POST", body: raw,
      headers: { "x-hub-signature-256": "sha256=" + crypto.createHmac("sha256", process.env.WHATSAPP_APP_SECRET).update(raw).digest("hex") } }));
    assert.equal(response.status, 200);
  }
  await runtime.drain();
  return graph.splice(0);
}
const textOf = (out) => out.map((p) => p.text?.body ?? p.interactive?.body?.text ?? "").join("\n");
const buttonsOf = (out) => out.flatMap((p) => p.interactive?.action?.buttons?.map((b) => b.reply) ?? []);
const button = (out, prefix) => buttonsOf(out).find((b) => b.id.startsWith(prefix));
const cartOf = async (waId) => (await services.cartService.getCartView(channelUserId(waId, process.env.CHANNEL_ID_SECRET)))?.items ?? [];
const userOf = (waId) => channelUserId(waId, process.env.CHANNEL_ID_SECRET);
const pepsi = async () => (await services.menuService.getAvailableMenuItems()).find((item) => /pepsi/i.test(item.name));

/** Puts one Pepsi in the customer's cart through a confirmed proposal. */
async function cartWithPepsi(waId) {
  const proposed = await say(waId, "Thêm 1 Pepsi");
  const confirm = button(proposed, "confirm:");
  assert.ok(confirm, "the proposal comes with a confirm button");
  await say(waId, { id: confirm.id, title: confirm.title });
  assert.equal((await cartOf(waId)).length, 1);
}

test("01 a proposal arrives with confirm/skip buttons and the server summary; typing 'xác nhận' never executes; the button does", async () => {
  const waId = "84900000101";
  const proposed = await say(waId, "Thêm 1 Pepsi");
  const confirm = button(proposed, "confirm:"), skip = button(proposed, "skip:");
  assert.equal(confirm.title, "Xác nhận thao tác");
  assert.equal(skip.title, "Bỏ qua");
  assert.equal(confirm.id.slice(8), skip.id.slice(5), "both buttons point to the same proposal");
  assert.match(textOf(proposed), /Pepsi/);
  const pending = await services.sessionService.getConversationContext((await services.sessionService.getActiveSession(userOf(waId))).id);
  for (const line of pending.context.pendingConfirmation.summary) assert.ok(textOf(proposed).includes(line), "server summary shown: " + line);

  const typed = await say(waId, "xác nhận");
  assert.equal((await cartOf(waId)).length, 0, "typed assent does not change the cart");
  assert.equal(button(typed, "confirm:")?.id, confirm.id, "the same proposal's buttons are shown again");

  const done = await say(waId, { id: confirm.id, title: confirm.title });
  assert.equal((await cartOf(waId))[0].quantity, 1);
  assert.equal(button(done, BUTTON.checkout)?.title, "Chốt đơn", "a non-empty cart offers checkout");
  const again = await say(waId, { id: confirm.id, title: confirm.title });
  assert.equal((await cartOf(waId))[0].quantity, 1, "a second press does not repeat the change");
  assert.match(textOf(again), /Không có thao tác đang chờ xác nhận/);
});

test("02 stale buttons: a superseded proposal shows the latest one; a cart changed elsewhere blocks the old proposal", async () => {
  const waId = "84900000102";
  const first = button(await say(waId, "Thêm 1 Pepsi"), "confirm:");
  const latest = await say(waId, "Thêm 2 Pepsi");
  const second = button(latest, "confirm:");
  assert.notEqual(first.id, second.id);
  const stale = await say(waId, { id: first.id, title: first.title });
  assert.equal((await cartOf(waId)).length, 0, "the superseded proposal is not executed");
  assert.equal(button(stale, "confirm:")?.id, second.id, "the latest preview is sent again with its own buttons");

  // The cart changes outside this proposal (e.g. the web tab): the proposal's cart signature no longer matches.
  await services.cartService.addMenuItem(userOf(waId), await pepsi(), 5);
  const blocked = await say(waId, { id: second.id, title: second.title });
  assert.match(textOf(blocked), /Giỏ hàng hoặc giá đã thay đổi/);
  assert.equal((await cartOf(waId))[0].quantity, 5, "only the outside change is in the cart");
});

test("03 skip: drops exactly the shown proposal; an old skip button shows the current proposal instead", async () => {
  const waId = "84900000103";
  const old = button(await say(waId, "Thêm 1 Pepsi"), "skip:");
  const current = await say(waId, "Thêm 3 Pepsi");
  const changed = await say(waId, { id: old.id, title: "Bỏ qua" });
  assert.match(textOf(changed), /Đề xuất đã thay đổi/);
  assert.equal(button(changed, "skip:")?.id, button(current, "skip:").id);
  const skipped = await say(waId, { id: button(current, "skip:").id, title: "Bỏ qua" });
  assert.match(textOf(skipped), /Đã bỏ qua đề xuất/);
  assert.equal((await cartOf(waId)).length, 0);
  const confirmAfterSkip = await say(waId, { id: button(current, "confirm:").id, title: "Xác nhận thao tác" });
  assert.equal((await cartOf(waId)).length, 0, "a skipped proposal cannot be confirmed later");
  assert.match(textOf(confirmAfterSkip), /Không có thao tác đang chờ/);
});

test("04 checkout (pickup, Vietnamese number): one order on the kitchen board; pressing 'Đặt đơn' twice gives one order", async () => {
  const waId = "84900000104";
  await cartWithPepsi(waId);
  const start = await say(waId, { id: BUTTON.checkout, title: "Chốt đơn" });
  assert.deepEqual(buttonsOf(start).map((b) => b.id), [BUTTON.pickup, BUTTON.delivery, BUTTON.cancelCheckout]);
  const named = await say(waId, { id: BUTTON.pickup, title: "Nhận tại quán" });
  assert.match(textOf(named), /Tên người nhận: Khách Test/);
  const review = await say(waId, { id: BUTTON.profileName, title: "Dùng tên này" });
  const text = textOf(review);
  assert.match(text, /Nhận tại quán/);
  assert.match(text, /Người nhận: Khách Test · 0900000104/, "phone taken from the WhatsApp number");
  assert.doesNotMatch(text, /Phí giao/);
  const order = button(review, "order:");
  assert.equal(order.title, "Đặt đơn");
  const item = await pepsi();
  assert.match(text, new RegExp(`Tổng: ${new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(item.price).replace(/\s/g, "\\s")}`));

  // Double tap: both presses are delivered before either is processed. One order, then "already placed".
  const both = await say(waId, [{ id: order.id, title: "Đặt đơn" }, { id: order.id, title: "Đặt đơn" }]);
  assert.match(textOf(both), /Đặt đơn thành công\. Mã đơn #[0-9A-Z_-]{8}/);
  assert.match(textOf(both), /đã được đặt rồi/);
  assert.equal((textOf(both).match(/Đặt đơn thành công/g) ?? []).length, 1);
  const later = await say(waId, { id: order.id, title: "Đặt đơn" });
  assert.match(textOf(later), /đã được đặt rồi/);
  const orders = await services.orderService.getUserOrders(userOf(waId));
  assert.equal(orders.length, 1, "the same idempotency key never creates a second order");
  assert.equal(orders[0].status, "CONFIRMED");
  assert.equal(orders[0].fulfillment, "pickup");
  assert.equal(orders[0].phone, "0900000104");
  const board = await services.adminService.kitchen();
  assert.ok(board.cards.some((card) => card.id === orders[0].id), "the order reaches the kitchen board");
  assert.equal((await cartOf(waId)).length, 0, "the checked-out cart is closed");
  const state = await services.channelStateService.get("whatsapp", userOf(waId));
  assert.equal(state.checkout, null);
  assert.equal(state.lastOrder.orderId, orders[0].id);
});

test("05 checkout (delivery, foreign number): typed name, phone and address are validated; the fee is shown and charged", async () => {
  const waId = "15550001105";
  await cartWithPepsi(waId);
  await say(waId, { id: BUTTON.checkout, title: "Chốt đơn" });
  const askName = await say(waId, { id: BUTTON.delivery, title: "Giao hàng" }, "A");
  assert.match(textOf(askName), /Tên người nhận|tên người nhận/);
  const badName = await say(waId, "1");
  assert.match(textOf(badName), /Tên cần từ 2 đến 100 ký tự/);
  const askPhone = await say(waId, "Trần Thị B");
  assert.match(textOf(askPhone), /số điện thoại Việt Nam/);
  const badPhone = await say(waId, "12345");
  assert.match(textOf(badPhone), /chưa hợp lệ/);
  const askAddress = await say(waId, "0901 234 567");
  assert.match(textOf(askAddress), /địa chỉ giao hàng/);
  assert.match(textOf(await say(waId, "ngắn")), /từ 10 đến 300 ký tự/);
  const review = await say(waId, "12 Đường Số 3, Phường 4, Quận 5, TP.HCM");
  assert.match(textOf(review), /Phí giao: 15\.000/);
  assert.match(textOf(review), /Giao tới: 12 Đường Số 3/);
  const placed = await say(waId, { id: button(review, "order:").id, title: "Đặt đơn" });
  assert.match(textOf(placed), /Đặt đơn thành công/);
  const [order] = await services.orderService.getUserOrders(userOf(waId));
  assert.equal(order.fulfillment, "delivery");
  assert.equal(order.phone, "0901234567");
  assert.equal(order.customerName, "Trần Thị B");
  assert.equal(order.deliveryFee, 15000);
  assert.equal(order.total, (await pepsi()).price + 15000);
});

test("06 the cart changes after the review: the old 'Đặt đơn' is refused and a fresh review is shown; nothing stale is ordered", async () => {
  const waId = "84900000106";
  await cartWithPepsi(waId);
  await say(waId, { id: BUTTON.checkout, title: "Chốt đơn" });
  await say(waId, { id: BUTTON.pickup, title: "Nhận tại quán" });
  const review = await say(waId, { id: BUTTON.profileName, title: "Dùng tên này" });
  const oldOrder = button(review, "order:");
  await services.cartService.addMenuItem(userOf(waId), await pepsi(), 2); // another tab adds 2 more
  const refreshed = await say(waId, { id: oldOrder.id, title: "Đặt đơn" });
  assert.match(textOf(refreshed), /Giỏ hàng đã thay đổi/);
  assert.match(textOf(refreshed), /- 3 × /, "the new review shows the current cart");
  const newOrder = button(refreshed, "order:");
  assert.notEqual(newOrder.id, oldOrder.id);
  assert.equal((await services.orderService.getUserOrders(userOf(waId))).length, 0);
  const stalePress = await say(waId, { id: oldOrder.id, title: "Đặt đơn" });
  assert.match(textOf(stalePress), /bản xem lại cũ/);
  assert.equal((await services.orderService.getUserOrders(userOf(waId))).length, 0);
  const latest = button(stalePress, "order:");
  await say(waId, { id: latest.id, title: "Đặt đơn" });
  const orders = await services.orderService.getUserOrders(userOf(waId));
  assert.equal(orders.length, 1);
  assert.equal(orders[0].total, 3 * (await pepsi()).price);
});

test("07 cancel and empty cart: cancelling keeps the cart; checkout needs items; text after cancel goes back to the agent", async () => {
  const empty = await say("84900000107", { id: BUTTON.checkout, title: "Chốt đơn" });
  assert.match(textOf(empty), /Giỏ hàng đang trống/);
  const waId = "84900000108";
  await cartWithPepsi(waId);
  await say(waId, { id: BUTTON.checkout, title: "Chốt đơn" });
  await say(waId, { id: BUTTON.delivery, title: "Giao hàng" });
  const cancelled = await say(waId, { id: BUTTON.cancelCheckout, title: "Huỷ chốt đơn" });
  assert.match(textOf(cancelled), /Đã huỷ bước chốt đơn/);
  assert.equal((await cartOf(waId)).length, 1);
  assert.equal((await services.channelStateService.get("whatsapp", userOf(waId))).checkout, null);
  // The name step no longer swallows text: this goes to the agent and proposes.
  const afterCancel = await say(waId, "Thêm 1 Pepsi");
  assert.ok(button(afterCancel, "confirm:"));
  const stale = await say(waId, { id: BUTTON.pickup, title: "Nhận tại quán" });
  assert.match(textOf(stale), /hết hạn hoặc đã thay đổi/);
  const unknown = await say(waId, { id: "confirm:not-a-uuid", title: "x" });
  assert.match(textOf(unknown), /không còn dùng được/);
});

test("08 invalid quantities (0, negative, decimal) never reach the cart through WhatsApp", async () => {
  const waId = "84900000109";
  for (const message of ["Thêm 0 Pepsi", "Thêm -1 Pepsi", "Thêm 1.5 Pepsi", "Thêm 1,5 Pepsi"]) {
    const out = await say(waId, message);
    // The same policy as the web blocks it: no proposal to confirm, the customer is told why.
    assert.equal(button(out, "confirm:"), undefined, `${message}: no confirm button`);
    assert.match(textOf(out), /chưa thể thực hiện/, `${message}: the refusal is explained`);
    assert.equal((await cartOf(waId)).length, 0, `${message}: cart unchanged`);
  }
});

test("09 order status messages: sent inside the 24-hour window only, WhatsApp customers only; failures never throw", async () => {
  const waId = "84900000110";
  await cartWithPepsi(waId);
  await say(waId, { id: BUTTON.checkout, title: "Chốt đơn" });
  await say(waId, { id: BUTTON.pickup, title: "Nhận tại quán" });
  const review = await say(waId, { id: BUTTON.profileName, title: "Dùng tên này" });
  await say(waId, { id: button(review, "order:").id, title: "Đặt đơn" });
  const [order] = await services.orderService.getUserOrders(userOf(waId));
  const preparing = await services.adminService.transition(order.id, "CONFIRMED", "PREPARING");
  assert.equal(await runtime.notifyOrder({ id: preparing.id, userId: preparing.userId, status: preparing.status, fulfillment: preparing.fulfillment }), "sent");
  const [notice] = graph.splice(0);
  assert.equal(notice.to, waId);
  assert.match(notice.text.body, new RegExp(`Đơn #${order.id.slice(-8).toUpperCase()} đang được chuẩn bị`));

  const sent = [];
  const deps = { states: services.channelStateService, sender: { send: async (to, m) => { sent.push(m); return { ok: true }; } } };
  const later = { ...deps, now: () => new Date(Date.now() + 25 * 60 * 60 * 1000) };
  assert.equal(await notifyOrderStatus(later, { ...order, status: "READY" }), "outside_window");
  assert.equal(await notifyOrderStatus(deps, { ...order, userId: "web-user", status: "READY" }), "not_whatsapp");
  assert.equal(await notifyOrderStatus(deps, { ...order, status: "CONFIRMED" }), "no_message");
  assert.equal(sent.length, 0);
  const failing = { states: services.channelStateService, sender: { send: async () => { throw new Error("graph down"); } } };
  assert.equal(await notifyOrderStatus(failing, { ...order, status: "READY" }), "failed");
  assert.match(orderStatusMessage({ id: order.id, userId: "wa_x", status: "READY", fulfillment: "pickup" }).text, /mời bạn đến quầy/);
  assert.match(orderStatusMessage({ id: order.id, userId: "wa_x", status: "CANCELLED", cancellationReason: "Hết nguyên liệu" }).text, /đã bị huỷ: Hết nguyên liệu/);
});

test("10 buttons, the purchase-assistant mode, checkout expiry and the AgentCore port", async () => {
  const id = crypto.randomUUID();
  assert.deepEqual(parseButton(`confirm:${id}`), { kind: "confirm", id });
  assert.deepEqual(parseButton(`order:${id}`), { kind: "order", token: id });
  for (const bad of [undefined, "", "confirm:", "confirm:abc", "order:1", "skip:" + id + "x", "fulfillment:boat", "checkout:start:x"])
    assert.equal(parseButton(bad), null, String(bad));
  const message = proposalMessage("Mình đề xuất thêm Pepsi.", { id, summary: ["Thêm 1 × Pepsi: 17.000 ₫"] });
  assert.match(message.text, /Đề xuất đang chờ bạn xác nhận:\n- Thêm 1 × Pepsi: 17\.000 ₫/);
  assert.equal(proposalMessage("Thêm 1 × Pepsi: 17.000 ₫", { id, summary: ["Thêm 1 × Pepsi: 17.000 ₫"] }).text, "Thêm 1 × Pepsi: 17.000 ₫", "no duplicate summary");

  const commerce = { orderingEnabled: () => false, cart: async () => ({ lines: [], subtotal: 1 }) };
  const state = { externalUserId: "84900000111", profileName: "A" };
  assert.match((await startCheckout({ userId: "wa_x", state, commerce })).replies[0].text, /chưa nhận đặt đơn qua WhatsApp/);

  // An abandoned checkout expires: typed text goes to the agent again.
  const waId = "84900000112";
  await cartWithPepsi(waId);
  await say(waId, { id: BUTTON.checkout, title: "Chốt đơn" });
  await say(waId, { id: BUTTON.delivery, title: "Giao hàng" });
  await services.channelStateService.update("whatsapp", userOf(waId), (current) => ({
    checkout: { ...current.checkout, startedAt: new Date(Date.now() - CHECKOUT_TTL_MS - 1000).toISOString() } }));
  const out = await say(waId, "Thêm 1 Pepsi");
  assert.ok(button(out, "confirm:"), "not taken as a name");

  const payloads = [];
  const port = agentCoreChatPort(async (payload) => { payloads.push(payload); return { status: "success", reply: "ok", pendingConfirmation: { id, summary: ["Thêm 1 × Pepsi"] } }; });
  assert.deepEqual(await port.chat({ userId: "wa_x", message: "Xác nhận", confirm: true, confirmationId: id }), { reply: "ok", pendingConfirmation: { id, summary: ["Thêm 1 × Pepsi"] } });
  assert.deepEqual(payloads[0], { userId: "wa_x", message: "Xác nhận", platform: "whatsapp", confirm: true, confirmationId: id });
});
