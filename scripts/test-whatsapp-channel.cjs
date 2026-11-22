/* eslint-disable @typescript-eslint/no-require-imports -- Offline tests for the WhatsApp channel adapter (issue #16): synthetic Meta payloads, fake Graph API, no network. */
require("./offline-network-guard.cjs");
require("./register-typescript.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fixtures = require("../tests/data/whatsapp/meta-webhooks.json");
const { verifySignature, sameSecret } = require("../src/lib/channels/whatsapp/signature.ts");
const { normalizeWebhook } = require("../src/lib/channels/whatsapp/normalize.ts");
const { createLocalInboundQueue } = require("../src/lib/channels/queue.ts");
const { handleNotification, handleVerification } = require("../src/lib/channels/whatsapp/webhook.ts");
const { channelUserId, maskWaId, vietnamPhoneFromWaId } = require("../src/lib/channels/whatsapp/identity.ts");
const { toGraphPayloads, createWhatsAppSender, splitText, WHATSAPP_LIMITS } = require("../src/lib/channels/whatsapp/sender.ts");
const { UNSUPPORTED_REPLY } = require("../src/lib/channels/whatsapp/replies.ts");
const { readWhatsAppConfig } = require("../src/lib/channels/whatsapp/config.ts");
const { createWhatsAppWebhookHandler } = require("../src/channels/lambda/whatsapp-webhook.ts");

const SECRET = "synthetic-app-secret-for-offline-tests";
const bytes = (value) => new Uint8Array(Buffer.from(typeof value === "string" ? value : JSON.stringify(value), "utf8"));
const sign = (raw, secret = SECRET) => "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");
/** Test queue: records what was enqueued. */
const recorder = () => { const seen = []; return { seen, enqueue: async (messages) => { seen.push(...messages); } }; };
/** Captures console output so tests can assert what logs contain. */
async function captureLogs(run) {
  const lines = [], saved = { error: console.error, info: console.info, log: console.log, warn: console.warn };
  for (const name of Object.keys(saved)) console[name] = (...args) => lines.push(args.join(" "));
  try { await run(); } finally { Object.assign(console, saved); }
  return lines.join("\n");
}

test("01 signature: correct HMAC over the raw body passes; wrong secret, tampered body, bad format or missing header fail", () => {
  const raw = bytes(fixtures.text);
  assert.equal(verifySignature(raw, sign(raw), SECRET), true);
  assert.equal(verifySignature(raw, sign(raw).toUpperCase().replace("SHA256=", "sha256="), SECRET), true, "hex case does not matter");
  assert.equal(verifySignature(raw, sign(raw, "another-secret"), SECRET), false);
  assert.equal(verifySignature(bytes(JSON.stringify(fixtures.text) + " "), sign(raw), SECRET), false, "one changed byte fails");
  // Re-serialised JSON is not the raw body Meta signed.
  assert.equal(verifySignature(bytes(JSON.stringify(fixtures.text, null, 2)), sign(raw), SECRET), false);
  for (const header of [undefined, null, "", "sha256=", "sha1=" + "0".repeat(40), sign(raw).slice(0, -2), "sha256=" + "z".repeat(64)])
    assert.equal(verifySignature(raw, header, SECRET), false, String(header));
  assert.equal(verifySignature(raw, sign(raw), undefined), false, "no App Secret configured: fail closed");
  assert.equal(sameSecret("token-1", "token-1"), true);
  assert.equal(sameSecret("token-1", "token-12"), false);
});

test("02 webhook verification (GET): right mode and token return the challenge; anything else is refused", () => {
  const params = (values) => new URLSearchParams(values);
  const ok = handleVerification(params({ "hub.mode": "subscribe", "hub.verify_token": "verify-me", "hub.challenge": "1158201444" }), "verify-me");
  assert.deepEqual(ok, { status: 200, body: "1158201444" });
  assert.equal(handleVerification(params({ "hub.mode": "subscribe", "hub.verify_token": "wrong", "hub.challenge": "1" }), "verify-me").status, 403);
  assert.equal(handleVerification(params({ "hub.mode": "unsubscribe", "hub.verify_token": "verify-me", "hub.challenge": "1" }), "verify-me").status, 403);
  assert.equal(handleVerification(params({ "hub.mode": "subscribe", "hub.challenge": "1" }), "verify-me").status, 403);
  assert.equal(handleVerification(params({ "hub.mode": "subscribe", "hub.verify_token": "verify-me", "hub.challenge": "<script>" }), "verify-me").status, 403,
    "the challenge is never reflected unless it is plain");
  assert.equal(handleVerification(params({ "hub.mode": "subscribe", "hub.verify_token": "", "hub.challenge": "1" }), undefined).status, 503);
});

test("03 normalize: text, button reply, list reply, profile name and timestamp", () => {
  const [text] = normalizeWebhook(fixtures.text);
  assert.deepEqual(text, {
    channel: "whatsapp", externalUserId: "84900000001", externalMessageId: "wamid.TEST_TEXT_1",
    receivedAt: "2025-11-22T00:00:00.000Z", profileName: "Khách Test", kind: "text", text: "cho mình 2 miếng gà rán",
  });
  const [button] = normalizeWebhook(fixtures.button_reply);
  assert.equal(button.kind, "button_reply");
  assert.equal(button.replyId, "confirm:00000000-0000-4000-8000-000000000001");
  assert.equal(button.text, "Xác nhận thao tác");
  const [row] = normalizeWebhook(fixtures.list_reply);
  assert.equal(row.kind, "list_reply");
  assert.equal(row.replyId, "fulfillment:pickup");
  // Template quick-reply buttons arrive as type "button" with a payload.
  const template = structuredClone(fixtures.text);
  template.entry[0].changes[0].value.messages = [{ from: "84900000001", id: "wamid.TEST_TPL_1", timestamp: "1763769600", type: "button", button: { payload: "reorder:yes", text: "Đặt lại" } }];
  assert.deepEqual(normalizeWebhook(template).map((m) => [m.kind, m.replyId]), [["button_reply", "reorder:yes"]]);
});

test("04 normalize: several messages in one webhook, status callbacks ignored, unsupported kinds and malformed messages", () => {
  const multi = normalizeWebhook(fixtures.multi);
  assert.deepEqual(multi.map((m) => [m.externalUserId, m.externalMessageId, m.profileName, m.text]), [
    ["84900000001", "wamid.TEST_MULTI_1", "Khách A", "cho 2 gà"],
    ["84900000002", "wamid.TEST_MULTI_2", "Khách B", "menu có gì"],
    ["84900000001", "wamid.TEST_MULTI_3", "Khách A", "à 3 đi"],
  ]);
  assert.deepEqual(normalizeWebhook(fixtures.status), [], "delivery/read receipts are not customer messages");
  const odd = normalizeWebhook(fixtures.unsupported);
  assert.deepEqual(odd.map((m) => [m.externalMessageId, m.kind]), [["wamid.TEST_IMAGE_1", "unsupported"], ["wamid.TEST_STICKER_1", "unsupported"]],
    "image and sticker become unsupported; a bad sender or missing id is dropped");
  for (const junk of [null, "x", [], { object: "page", entry: [] }, { object: "whatsapp_business_account" }, { object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { messages: "x" } }] }] }])
    assert.deepEqual(normalizeWebhook(junk), []);
  const long = structuredClone(fixtures.text);
  long.entry[0].changes[0].value.messages[0].text.body = "a".repeat(5000);
  assert.equal(normalizeWebhook(long)[0].text.length, 4096);
  assert.equal(UNSUPPORTED_REPLY.kind, "text");
  assert.match(UNSUPPORTED_REPLY.text, /chữ/);
});

test("05 notification (POST): valid signature enqueues and answers 200; a bad signature enqueues nothing", async () => {
  const queue = recorder();
  const raw = bytes(fixtures.multi);
  assert.deepEqual(await handleNotification({ rawBody: raw, signature: sign(raw), appSecret: SECRET, queue }), { status: 200, body: "EVENT_RECEIVED" });
  assert.equal(queue.seen.length, 3);
  const forged = recorder();
  assert.equal((await handleNotification({ rawBody: raw, signature: sign(raw, "attacker"), appSecret: SECRET, queue: forged })).status, 401);
  assert.equal((await handleNotification({ rawBody: raw, signature: undefined, appSecret: SECRET, queue: forged })).status, 401);
  assert.equal(forged.seen.length, 0);
  assert.equal((await handleNotification({ rawBody: raw, signature: sign(raw), appSecret: undefined, queue: forged })).status, 503, "not configured: fail closed");
  const notJson = bytes("not json");
  assert.equal((await handleNotification({ rawBody: notJson, signature: sign(notJson), appSecret: SECRET, queue: forged })).status, 400);
  const status = bytes(fixtures.status);
  assert.equal((await handleNotification({ rawBody: status, signature: sign(status), appSecret: SECRET, queue: forged })).status, 200);
  assert.equal(forged.seen.length, 0, "status callbacks are acknowledged, not enqueued");
  const huge = new Uint8Array(1_000_001);
  assert.equal((await handleNotification({ rawBody: huge, signature: sign(huge), appSecret: SECRET, queue: forged })).status, 413);
  const failing = { enqueue: async () => { throw new Error("queue down"); } };
  const logs = await captureLogs(async () => {
    assert.equal((await handleNotification({ rawBody: raw, signature: sign(raw), appSecret: SECRET, queue: failing })).status, 500, "queue failure: Meta retries");
  });
  assert.doesNotMatch(logs, /84900000001|cho 2 gà/, "no number or message text in logs");
});

test("06 local queue: a resent message is handled once; one customer in order; customers do not block each other; errors do not stop the queue", async () => {
  const order = [];
  let releaseA;
  const gateA = new Promise((resolve) => { releaseA = resolve; });
  const queue = createLocalInboundQueue(async (message) => {
    if (message.externalMessageId === "wamid.TEST_MULTI_1") await gateA;
    if (message.text === "boom") throw new Error("handler failed");
    order.push(message.externalMessageId);
  }, { onError: () => order.push("error") });
  const [a1, b1, a2] = normalizeWebhook(fixtures.multi);
  await queue.enqueue([a1, b1, a2]);
  await queue.enqueue([a1]); // Meta resends the same wamid.
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(order, ["wamid.TEST_MULTI_2"], "customer B is not blocked by customer A's slow message");
  releaseA();
  await queue.idle();
  assert.deepEqual(order, ["wamid.TEST_MULTI_2", "wamid.TEST_MULTI_1", "wamid.TEST_MULTI_3"], "A's messages in arrival order; the resend is dropped");
  await queue.enqueue([{ ...a1, externalMessageId: "wamid.BOOM", text: "boom" }, { ...a1, externalMessageId: "wamid.AFTER" }]);
  await queue.idle();
  assert.deepEqual(order.slice(-2), ["error", "wamid.AFTER"]);
  // Bounded memory: old ids are forgotten after seenLimit.
  const handled = [];
  const tiny = createLocalInboundQueue(async (m) => { handled.push(m.externalMessageId); }, { seenLimit: 2 });
  for (const id of ["x1", "x2", "x3", "x1"]) await tiny.enqueue([{ ...a1, externalMessageId: id }]);
  await tiny.idle();
  assert.deepEqual(handled, ["x1", "x2", "x3", "x1"], "x1 fell out of the 2-id window");
});

test("07 identity: stable pseudonymous id without the number; masking; Vietnamese phone for orders", () => {
  const secret = "synthetic-channel-id-secret-32-chars-min";
  const id = channelUserId("84900000001", secret);
  assert.match(id, /^wa_[0-9a-f]{32}$/);
  assert.equal(channelUserId("84900000001", secret), id, "same customer, same id");
  assert.notEqual(channelUserId("84900000002", secret), id);
  assert.notEqual(channelUserId("84900000001", secret + "x"), id, "keyed: cannot be recomputed without the secret");
  assert.ok(!id.includes("900000001"));
  assert.throws(() => channelUserId("84900000001", "short"), /32/);
  assert.throws(() => channelUserId("+84 900", secret), /không hợp lệ/);
  assert.equal(maskWaId("84900000001"), "84******001");
  assert.equal(vietnamPhoneFromWaId("84900000001"), "0900000001");
  assert.equal(vietnamPhoneFromWaId("15550000000"), null, "foreign number: ask the customer at checkout");
  assert.equal(vietnamPhoneFromWaId("849000000012"), null);
});

test("08 sender payloads: text, confirm buttons, list; limits are enforced, long text is split", () => {
  const [text] = toGraphPayloads("84900000001", { kind: "text", text: "Xin chào" });
  assert.deepEqual(text, { messaging_product: "whatsapp", recipient_type: "individual", to: "84900000001", type: "text", text: { body: "Xin chào", preview_url: false } });
  const buttons = toGraphPayloads("84900000001", { kind: "buttons", text: "Thêm 2 Miếng Gà Rán: 74.000 ₫",
    buttons: [{ id: "confirm:abc", title: "Xác nhận thao tác" }, { id: "skip:abc", title: "Bỏ qua" }] });
  assert.equal(buttons.length, 1);
  assert.deepEqual(buttons[0].interactive, { type: "button", body: { text: "Thêm 2 Miếng Gà Rán: 74.000 ₫" },
    action: { buttons: [{ type: "reply", reply: { id: "confirm:abc", title: "Xác nhận thao tác" } }, { type: "reply", reply: { id: "skip:abc", title: "Bỏ qua" } }] } });
  assert.ok("Xác nhận thao tác".length <= WHATSAPP_LIMITS.buttonTitle, "the existing confirm label fits a WhatsApp button");
  const list = toGraphPayloads("84900000001", { kind: "list", text: "Bạn nhận món thế nào?", buttonLabel: "Chọn",
    rows: [{ id: "fulfillment:pickup", title: "Nhận tại quán" }, { id: "fulfillment:delivery", title: "Giao hàng", description: "Phí giao theo cửa hàng" }] });
  assert.equal(list[0].interactive.type, "list");
  assert.deepEqual(list[0].interactive.action.sections[0].rows[1], { id: "fulfillment:delivery", title: "Giao hàng", description: "Phí giao theo cửa hàng" });
  const four = [1, 2, 3, 4].map((n) => ({ id: "b" + n, title: "Nút " + n }));
  assert.throws(() => toGraphPayloads("84900000001", { kind: "buttons", text: "x", buttons: four }), /1–3/);
  assert.throws(() => toGraphPayloads("84900000001", { kind: "buttons", text: "x", buttons: [{ id: "a", title: "x".repeat(21) }] }), /20/);
  assert.throws(() => toGraphPayloads("84900000001", { kind: "buttons", text: "x", buttons: [{ id: "a", title: "A" }, { id: "a", title: "B" }] }), /trùng/);
  assert.throws(() => toGraphPayloads("bad", { kind: "text", text: "x" }), /Người nhận/);
  assert.throws(() => toGraphPayloads("84900000001", { kind: "text", text: "   " }), /rỗng/);
  const long = ("Một dòng mô tả món ăn khá dài. ".repeat(200)).trim();
  const parts = splitText(long);
  assert.ok(parts.length >= 2 && parts.every((p) => p.length <= 4096));
  assert.equal(parts.join(" "), long, "splitting keeps every word");
  const longButtons = toGraphPayloads("84900000001", { kind: "buttons", text: "x".repeat(1500), buttons: [{ id: "confirm:abc", title: "Xác nhận thao tác" }] });
  assert.deepEqual(longButtons.map((p) => p.type), ["text", "interactive"], "a long preview goes first as text, the buttons follow");
  assert.equal(longButtons[0].text.body.length, 1500);
});

test("09 sender: retries 429/5xx and network errors, not other 4xx; logs never hold the token or the full number", async () => {
  const token = "synthetic-access-token-do-not-log";
  const calls = [];
  const fake = (responses) => async (url, init) => {
    calls.push({ url, init });
    const next = responses.shift();
    if (next === "network") throw new TypeError("fetch failed");
    return new Response(JSON.stringify(next.body), { status: next.status, headers: { "content-type": "application/json" } });
  };
  const sleeps = [];
  const make = (responses) => createWhatsAppSender({ accessToken: token, phoneNumberId: "200000000000001", graphVersion: "v21.0",
    fetch: fake(responses), sleep: async (ms) => { sleeps.push(ms); } });

  const ok = await make([{ status: 500, body: {} }, "network", { status: 200, body: { messages: [{ id: "wamid.OUT_1" }] } }]).send("84900000001", { kind: "text", text: "Chào bạn" });
  assert.deepEqual(ok, { ok: true, status: 200, attempts: 3, messageIds: ["wamid.OUT_1"] });
  assert.deepEqual(sleeps, [500, 1000]);
  assert.equal(calls[0].url, "https://graph.facebook.com/v21.0/200000000000001/messages");
  assert.equal(calls[0].init.headers.Authorization, "Bearer " + token);
  assert.equal(JSON.parse(calls[0].init.body).to, "84900000001");

  let result;
  const logs = await captureLogs(async () => {
    result = await make([{ status: 400, body: { error: { code: 131030, message: "Recipient phone number not in allowed list" } } }]).send("84900000001", { kind: "text", text: "Chào" });
  });
  assert.deepEqual(result, { ok: false, status: 400, attempts: 1, messageIds: [], errorCode: 131030 }, "no retry on a client error");
  assert.match(logs, /whatsapp_send_failed/);
  assert.match(logs, /84\*+001/);
  assert.doesNotMatch(logs, new RegExp(token));
  assert.doesNotMatch(logs, /84900000001|Chào|allowed list/, "no full number, message text or provider message");

  const limited = await captureLogs(async () => {
    result = await make([{ status: 429, body: {} }, { status: 429, body: {} }, { status: 429, body: {} }]).send("84900000001", { kind: "text", text: "x" });
  });
  assert.equal(result.ok, false);
  assert.equal(result.attempts, 3, "bounded retries");
  assert.doesNotMatch(limited, new RegExp(token));

  assert.throws(() => createWhatsAppSender({ phoneNumberId: "1", graphVersion: "v21.0" }), /ACCESS_TOKEN/);
  assert.throws(() => createWhatsAppSender({ accessToken: token, phoneNumberId: "abc", graphVersion: "v21.0" }), /PHONE_NUMBER_ID/);
  assert.throws(() => createWhatsAppSender({ accessToken: token, phoneNumberId: "200000000000001", graphVersion: "21" }), /GRAPH_VERSION/);
});

test("10 Next.js route: GET verification; POST is refused until it can answer, and checks the signature", async () => {
  Object.assign(process.env, { WHATSAPP_VERIFY_TOKEN: "verify-me", WHATSAPP_APP_SECRET: SECRET, CHANNEL_QUEUE_DRIVER: "local" });
  const route = require("../src/app/api/channels/whatsapp/webhook/route.ts");
  const url = "http://localhost/api/channels/whatsapp/webhook";
  const get = await route.GET(new Request(url + "?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=42"));
  assert.equal(get.status, 200);
  assert.equal(await get.text(), "42");
  assert.equal(get.headers.get("cache-control"), "no-store");
  assert.equal((await route.GET(new Request(url + "?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=42"))).status, 403);
  const raw = JSON.stringify(fixtures.text);
  // Phase 3: without send settings and CHANNEL_ID_SECRET the route cannot reply, so it does not accept messages.
  assert.equal((await route.POST(new Request(url, { method: "POST", body: raw, headers: { "x-hub-signature-256": sign(bytes(raw)) } }))).status, 503);
  Object.assign(process.env, { WHATSAPP_ACCESS_TOKEN: "synthetic-access-token-do-not-log", WHATSAPP_PHONE_NUMBER_ID: "200000000000001",
    WHATSAPP_GRAPH_VERSION: "v21.0", CHANNEL_ID_SECRET: "synthetic-channel-id-secret-32-chars-min" });
  // Signed messages through the agent are tested end to end in test-channel-queue.cjs.
  assert.equal((await route.POST(new Request(url, { method: "POST", body: raw, headers: { "x-hub-signature-256": sign(bytes(raw), "x") } }))).status, 401);
  for (const key of ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_GRAPH_VERSION", "CHANNEL_ID_SECRET"]) delete process.env[key];
  process.env.CHANNEL_QUEUE_DRIVER = "sqs";
  assert.equal((await route.POST(new Request(url, { method: "POST", body: raw, headers: { "x-hub-signature-256": sign(bytes(raw)) } }))).status, 503,
    "the local route never pretends to use SQS");
  for (const key of ["WHATSAPP_VERIFY_TOKEN", "WHATSAPP_APP_SECRET", "CHANNEL_QUEUE_DRIVER"]) delete process.env[key];
  assert.equal((await route.GET(new Request(url + "?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=42"))).status, 503, "unconfigured: fail closed");
});

test("11 Lambda adapter (API Gateway HTTP API): GET, POST with base64 body, other methods", async () => {
  const queue = recorder();
  const config = () => readWhatsAppConfig({ WHATSAPP_VERIFY_TOKEN: "verify-me", WHATSAPP_APP_SECRET: SECRET });
  const handler = createWhatsAppWebhookHandler({ config, queue });
  const get = await handler({ requestContext: { http: { method: "GET" } }, queryStringParameters: { "hub.mode": "subscribe", "hub.verify_token": "verify-me", "hub.challenge": "777" } });
  assert.deepEqual([get.statusCode, get.body], [200, "777"]);
  const raw = JSON.stringify(fixtures.button_reply);
  const post = await handler({ requestContext: { http: { method: "POST" } }, headers: { "x-hub-signature-256": sign(bytes(raw)) },
    body: Buffer.from(raw).toString("base64"), isBase64Encoded: true });
  assert.equal(post.statusCode, 200);
  assert.deepEqual(queue.seen.map((m) => [m.kind, m.replyId]), [["button_reply", "confirm:00000000-0000-4000-8000-000000000001"]]);
  const plain = await handler({ requestContext: { http: { method: "POST" } }, headers: { "x-hub-signature-256": sign(bytes(raw)) }, body: raw });
  assert.equal(plain.statusCode, 200, "non-base64 body");
  const bad = await handler({ requestContext: { http: { method: "POST" } }, headers: {}, body: raw });
  assert.equal(bad.statusCode, 401);
  assert.equal((await handler({ requestContext: { http: { method: "PUT" } } })).statusCode, 405);
  assert.equal(readWhatsAppConfig({}).queueDriver, "local");
  assert.equal(readWhatsAppConfig({ CHANNEL_QUEUE_DRIVER: "SQS" }).queueDriver, "sqs");
});
