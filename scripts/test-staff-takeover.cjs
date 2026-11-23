/* eslint-disable @typescript-eslint/no-require-imports -- Offline tests for staff takeover of WhatsApp conversations (issue #16, phase 6). Mock AI, demo catalog, fake Graph API, no network. */
require("./offline-network-guard.cjs");
const os = require("node:os"), fs = require("node:fs"), path = require("node:path");
Object.assign(process.env, {
  AI_PROVIDER: "mock", PERSISTENCE_DRIVER: "local", KFC_PURCHASE_ASSISTANT: "0",
  LOCAL_DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), "kfc-staff-takeover-")),
  SESSION_SECRET: "synthetic-staff-takeover-signing-secret-2026-x",
  WHATSAPP_VERIFY_TOKEN: "verify-me", WHATSAPP_APP_SECRET: "synthetic-app-secret-for-offline-tests",
  WHATSAPP_ACCESS_TOKEN: "synthetic-access-token-do-not-log", WHATSAPP_PHONE_NUMBER_ID: "200000000000001", WHATSAPP_GRAPH_VERSION: "v21.0",
  CHANNEL_ID_SECRET: "synthetic-channel-id-secret-32-chars-min", CHANNEL_QUEUE_DRIVER: "local", CHANNEL_DEBOUNCE_MS: "20",
});
require("./register-typescript.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

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
const { BUTTON } = require("../src/lib/channels/messages.ts");
const { ChannelStaffService } = require("../src/lib/channels/staff-service.ts");

const runtime = localWhatsAppRuntime(readWhatsAppConfig());
const staff = services.channelStaffService;
let seq = 0;
async function say(waId, input, name = "Khách Test") {
  const message = typeof input === "string"
    ? { type: "text", text: { body: input } }
    : { type: "interactive", interactive: { type: "button_reply", button_reply: { id: input.id, title: input.title ?? "nút" } } };
  const raw = JSON.stringify({ object: "whatsapp_business_account", entry: [{ id: "1", changes: [{ field: "messages", value: {
    messaging_product: "whatsapp", metadata: { display_phone_number: "15550000000", phone_number_id: "200000000000001" },
    contacts: [{ profile: { name }, wa_id: waId }],
    messages: [{ from: waId, id: "wamid.S" + (++seq), timestamp: String(Math.floor(Date.now() / 1000)), ...message }] } }] }] });
  const response = await route.POST(new Request("http://localhost/api/channels/whatsapp/webhook", { method: "POST", body: raw,
    headers: { "x-hub-signature-256": "sha256=" + crypto.createHmac("sha256", process.env.WHATSAPP_APP_SECRET).update(raw).digest("hex") } }));
  assert.equal(response.status, 200);
  await runtime.drain();
  return graph.splice(0);
}
const userOf = (waId) => channelUserId(waId, process.env.CHANNEL_ID_SECRET);
const button = (out, prefix) => out.flatMap((p) => p.interactive?.action?.buttons?.map((b) => b.reply) ?? []).find((b) => b.id.startsWith(prefix));
const cartOf = async (waId) => (await services.cartService.getCartView(userOf(waId)))?.items ?? [];
const pendingOf = async (waId) => {
  const session = await services.sessionService.getActiveSession(userOf(waId));
  const saved = session && await services.sessionService.getConversationContext(session.id);
  return saved?.context?.pendingConfirmation ?? null;
};
const revisionOf = async (waId) => (await services.channelStateService.get("whatsapp", userOf(waId))).revision;

test("01 takeover: the AI goes silent, the pending proposal and an open checkout are cancelled, the customer's messages are kept for staff", async () => {
  const waId = "84900000201";
  const proposed = await say(waId, "Thêm 1 Pepsi");
  await say(waId, { id: button(proposed, "confirm:").id, title: "Xác nhận thao tác" });
  await say(waId, { id: BUTTON.checkout, title: "Chốt đơn" });          // checkout draft open
  const pending = await say(waId, "Thêm 2 Pepsi");                      // goes to the agent at this step: a new proposal
  const stale = button(pending, "confirm:");
  assert.ok(stale && (await pendingOf(waId)));
  assert.ok((await services.channelStateService.get("whatsapp", userOf(waId))).checkout);

  const taken = await staff.takeOver(userOf(waId), "staff-a", await revisionOf(waId));
  assert.equal(taken.mode, "HUMAN");
  assert.equal(taken.takenOverBy, "staff-a");
  const state = await services.channelStateService.get("whatsapp", userOf(waId));
  assert.equal(state.checkout, null, "the open checkout is cancelled");
  assert.equal(await pendingOf(waId), null, "the AI proposal can no longer be confirmed");
  assert.deepEqual(state.handoffEvents.map((e) => [e.type, e.by]), [["TAKEOVER", "staff-a"]]);

  assert.deepEqual(await say(waId, "cho mình gặp nhân viên"), [], "no AI reply while staff has the conversation");
  assert.deepEqual(await say(waId, { id: stale.id, title: "Xác nhận thao tác" }), [], "buttons do nothing while staff has the conversation");
  assert.equal((await cartOf(waId))[0].quantity, 1, "the old proposal did not run");
  const { messages } = await staff.detail(userOf(waId));
  const customer = messages.filter((m) => m.role === "user").map((m) => m.content);
  assert.ok(customer.includes("cho mình gặp nhân viên"), "the customer's text is kept for staff");
  assert.ok(customer.some((m) => /\[Khách bấm nút: Xác nhận thao tác\]/.test(m)));
});

test("02 staff messages: only by the staff member holding the conversation, only within 24 hours; delivered and kept in history", async () => {
  const waId = "84900000202";
  await say(waId, "menu có gì");
  const id = userOf(waId);
  await assert.rejects(staff.send(id, "staff-a", "Chào bạn", runtime.sender), (e) => e.code === "NOT_TAKEN_OVER");
  await staff.takeOver(id, "staff-a", await revisionOf(waId));
  await assert.rejects(staff.send(id, "staff-b", "Chào bạn", runtime.sender), (e) => e.code === "NOT_TAKEN_OVER", "another staff member cannot write");
  await assert.rejects(staff.send(id, "staff-a", "   ", runtime.sender), (e) => e.code === "INVALID_MESSAGE");
  await assert.rejects(staff.send(id, "staff-a", "Chào bạn", null), (e) => e.code === "CHANNEL_UNAVAILABLE");

  await staff.send(id, "staff-a", "Chào bạn, mình là nhân viên cửa hàng.", runtime.sender);
  const [out] = graph.splice(0);
  assert.equal(out.to, waId);
  assert.equal(out.text.body, "Chào bạn, mình là nhân viên cửa hàng.");
  const history = (await staff.detail(id)).messages;
  assert.deepEqual(history.at(-1), { ...history.at(-1), role: "assistant", sender: "staff", content: "Chào bạn, mình là nhân viên cửa hàng." });

  const failing = { send: async () => ({ ok: false }) };
  await assert.rejects(staff.send(id, "staff-a", "Tin không tới", failing), (e) => e.code === "SEND_FAILED");
  assert.ok(!(await staff.detail(id)).messages.some((m) => m.content === "Tin không tới"), "an undelivered message is not recorded as sent");

  const later = new ChannelStaffService(staff.repository, { ...staff.deps, now: () => new Date(Date.now() + 25 * 60 * 60 * 1000) });
  await assert.rejects(later.send(id, "staff-a", "Chào bạn", runtime.sender), (e) => e.code === "OUTSIDE_WINDOW");
  assert.equal((await later.detail(id)).conversation.withinWindow, false);
});

test("03 release: the AI answers again and knows what staff said", async () => {
  const waId = "84900000203";
  await say(waId, "xin chào");
  const id = userOf(waId);
  await staff.takeOver(id, "staff-a", await revisionOf(waId));
  await staff.send(id, "staff-a", "Mình đã kiểm tra, cửa hàng mở đến 22 giờ.", runtime.sender);
  graph.splice(0);
  await assert.rejects(staff.release(id, "staff-b", await revisionOf(waId)), (e) => e.code === "ALREADY_TAKEN_OVER", "only the holder releases");
  const released = await staff.release(id, "staff-a", await revisionOf(waId));
  assert.equal(released.mode, "AI");
  assert.equal(released.takenOverBy, undefined);
  const out = await say(waId, "menu có gì");
  assert.ok(out.length >= 1, "the AI replies again");
  const session = await services.sessionService.getActiveSession(id);
  const turns = (await services.sessionService.getConversationContext(session.id)).context.turns.map((t) => t.content);
  assert.ok(turns.includes("Mình đã kiểm tra, cửa hàng mở đến 22 giờ."), "the staff message is in the AI's conversation context");
  const events = (await staff.detail(id)).events.map((e) => [e.type, e.by]);
  assert.deepEqual(events, [["TAKEOVER", "staff-a"], ["RELEASE", "staff-a"]]);
});

test("04 two staff members take over at the same moment: exactly one wins; stale screens are refused", async () => {
  const waId = "84900000204";
  await say(waId, "alo");
  const id = userOf(waId), revision = await revisionOf(waId);
  const results = await Promise.allSettled([staff.takeOver(id, "staff-a", revision), staff.takeOver(id, "staff-b", revision)]);
  const won = results.filter((r) => r.status === "fulfilled");
  assert.equal(won.length, 1, "one takeover succeeds");
  assert.equal(results.find((r) => r.status === "rejected").reason.code, "CHANNEL_STATE_CHANGED");
  const holder = (await services.channelStateService.get("whatsapp", id)).takenOverBy;
  assert.equal(holder, won[0].value.takenOverBy);
  await assert.rejects(staff.takeOver(id, "staff-c", revision), (e) => e.code === "CHANNEL_STATE_CHANGED", "a stale revision is refused");
  await assert.rejects(staff.takeOver(id, "staff-c", await revisionOf(waId)), (e) => e.code === "ALREADY_TAKEN_OVER");
  const again = await staff.takeOver(id, holder, await revisionOf(waId));
  assert.equal(again.takenOverBy, holder, "the holder taking over again is a no-op");
  assert.equal((await services.channelStateService.get("whatsapp", id)).handoffEvents.length, 1);
  await assert.rejects(staff.takeOver(userOf("84900000299"), "staff-a", crypto.randomUUID()), (e) => e.code === "CONVERSATION_NOT_FOUND");
});

test("05 the list: latest customer message first, numbers masked, no full number in the response", async () => {
  await say("84900000205", "tin cũ hơn");
  await new Promise((resolve) => setTimeout(resolve, 1100)); // WhatsApp timestamps are in seconds
  await say("84900000206", "tin mới nhất", "Khách Mới");
  const list = await staff.list(50);
  assert.equal(list[0].customerId, userOf("84900000206"));
  assert.equal(list[0].profileName, "Khách Mới");
  assert.equal(list[0].contact, "84******206");
  assert.equal(list[0].withinWindow, true);
  assert.doesNotMatch(JSON.stringify(list), /849000002\d\d/, "only masked numbers");
  assert.ok(list.every((item, i) => i === 0 || list[i - 1].lastInboundAt >= item.lastInboundAt));
});
