/* eslint-disable @typescript-eslint/no-require-imports -- Offline tests for the channel queue, worker and identity (issue #16, phase 3). Mock AI, fake Graph API and SQS, no network. */
require("./offline-network-guard.cjs");
const os = require("node:os"), fs = require("node:fs"), path = require("node:path");
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "kfc-channel-queue-"));
Object.assign(process.env, {
  AI_PROVIDER: "mock", PERSISTENCE_DRIVER: "local", KFC_PURCHASE_ASSISTANT: "1", LOCAL_DATA_DIR: dataDir,
  SESSION_SECRET: "synthetic-channel-queue-signing-secret-2026-x",
  WHATSAPP_VERIFY_TOKEN: "verify-me", WHATSAPP_APP_SECRET: "synthetic-app-secret-for-offline-tests",
  WHATSAPP_ACCESS_TOKEN: "synthetic-access-token-do-not-log", WHATSAPP_PHONE_NUMBER_ID: "200000000000001", WHATSAPP_GRAPH_VERSION: "v21.0",
  CHANNEL_ID_SECRET: "synthetic-channel-id-secret-32-chars-min", CHANNEL_QUEUE_DRIVER: "local", CHANNEL_DEBOUNCE_MS: "60",
});
require("./register-typescript.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { services } = require("../src/lib/agent/agent-core.ts");
const { ChannelStateService } = require("../src/lib/channels/state-service.ts");
const { MockChannelRepository } = require("../src/lib/db/repositories/implementations/mock-repository.ts");
const { createChannelWorker, mergeTurnText, AGENT_ERROR_REPLY } = require("../src/lib/channels/worker.ts");
const { createTurnDebouncer } = require("../src/lib/channels/debounce.ts");
const { createSqsInboundQueue, parseInboundMessage } = require("../src/lib/channels/sqs-queue.ts");
const { createChannelWorkerHandler, agentCoreChatPort } = require("../src/channels/lambda/channel-worker.ts");
const { channelUserId } = require("../src/lib/channels/whatsapp/identity.ts");
const { UNSUPPORTED_REPLY } = require("../src/lib/channels/whatsapp/replies.ts");
const { invocationSchema } = require("../src/agentcore/invocation.ts");

const SECRET = process.env.WHATSAPP_APP_SECRET, ID_SECRET = process.env.CHANNEL_ID_SECRET;
const sign = (raw) => "sha256=" + crypto.createHmac("sha256", SECRET).update(raw).digest("hex");
let seq = 0;
const message = (waId, text, extra = {}) => ({ channel: "whatsapp", externalUserId: waId, externalMessageId: "wamid.T" + (++seq),
  receivedAt: new Date(Date.UTC(2026, 10, 22, 3, 0, seq)).toISOString(), kind: "text", text, ...extra });
const webhook = (waId, text, wamid, name = "Khách Test") => JSON.stringify({ object: "whatsapp_business_account", entry: [{ id: "1", changes: [{ field: "messages", value: {
  messaging_product: "whatsapp", metadata: { display_phone_number: "15550000000", phone_number_id: "200000000000001" },
  contacts: [{ profile: { name }, wa_id: waId }],
  messages: [{ from: waId, id: wamid, timestamp: String(1763780000 + (++seq)), type: "text", text: { body: text } }] } }] }] });
async function captureLogs(run) {
  const lines = [], saved = { error: console.error, info: console.info, log: console.log, warn: console.warn };
  for (const name of Object.keys(saved)) console[name] = (...args) => lines.push(args.join(" "));
  try { await run(); } finally { Object.assign(console, saved); }
  return lines.join("\n");
}
/** Fake ports for unit tests of the worker. */
function fakes({ agent } = {}) {
  const sent = [], asked = [];
  return {
    sent, asked,
    deps: {
      customerId: (waId) => channelUserId(waId, ID_SECRET),
      states: new ChannelStateService(new MockChannelRepository()),
      agent: { chat: agent ?? (async ({ userId, message }) => { asked.push({ userId, message }); return { reply: "Mình đã hiểu: " + message.replace(/\n/g, " | ") }; }) },
      sender: { send: async (to, out) => { sent.push({ to, out }); return { ok: true }; } },
      // Phase 4 port: an empty cart and no pending proposal, so replies stay plain text as in phase 3.
      commerce: { cart: async () => null, pendingConfirmation: async () => null, skipProposal: async () => "none",
        quote: async () => { throw new Error("not used"); }, placeOrder: async () => { throw new Error("not used"); }, orderingEnabled: () => true },
    },
  };
}

test("01 conversation state: created on first contact (AI), updated after, mode kept; concurrent writes are compare-and-set", async () => {
  const states = new ChannelStateService(new MockChannelRepository());
  const customerId = channelUserId("84900000001", ID_SECRET);
  const first = await states.recordInbound({ channel: "whatsapp", customerId, externalUserId: "84900000001", receivedAt: "2026-11-22T03:00:00.000Z", profileName: "Khách A" });
  assert.equal(first.mode, "AI");
  assert.equal(first.customerId, customerId);
  assert.ok(!customerId.includes("900000001"), "the id holds no phone number");
  const older = await states.recordInbound({ channel: "whatsapp", customerId, externalUserId: "84900000001", receivedAt: "2026-11-22T02:00:00.000Z" });
  assert.equal(older.lastInboundAt, "2026-11-22T03:00:00.000Z", "a late, older message does not move the 24-hour window back");
  assert.equal(older.profileName, "Khách A");
  assert.notEqual(older.revision, first.revision);

  // Another writer (e.g. staff takeover) changes the record between our read and write: retried once, its mode kept.
  const repository = new MockChannelRepository();
  const racing = new ChannelStateService(repository);
  await racing.recordInbound({ channel: "whatsapp", customerId, externalUserId: "84900000001", receivedAt: "2026-11-22T03:00:00.000Z" });
  const realGet = repository.getConversationState.bind(repository);
  let interfered = false;
  repository.getConversationState = async (...args) => {
    const state = await realGet(...args);
    if (!interfered && state) {
      interfered = true;
      await repository.saveConversationState({ ...state, mode: "HUMAN", takenOverBy: "staff-1", revision: crypto.randomUUID() }, state.revision);
    }
    return state;
  };
  const after = await racing.recordInbound({ channel: "whatsapp", customerId, externalUserId: "84900000001", receivedAt: "2026-11-22T03:05:00.000Z" });
  assert.equal(after.mode, "HUMAN", "the takeover written in between is not overwritten");
  assert.equal(after.lastInboundAt, "2026-11-22T03:05:00.000Z");
  // Always conflicting: gives up after one retry instead of looping.
  repository.saveConversationState = async () => { const { DomainError } = require("../src/lib/domain-error.ts"); throw new DomainError("CHANNEL_STATE_CHANGED", "x", 409); };
  await assert.rejects(racing.recordInbound({ channel: "whatsapp", customerId, externalUserId: "84900000001", receivedAt: "2026-11-22T03:06:00.000Z" }),
    (error) => error.code === "CHANNEL_STATE_CHANGED");
});

test("02 end to end (local): 'cho 2 gà' / 'à 3 đi' / 'thêm pepsi' sent quickly → one agent turn, one reply; a resent wamid is ignored", async () => {
  const graph = [];
  global.fetch = async (url, init) => {
    graph.push({ url, body: JSON.parse(init.body), auth: init.headers.Authorization });
    return new Response(JSON.stringify({ messages: [{ id: "wamid.OUT" + graph.length }] }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const route = require("../src/app/api/channels/whatsapp/webhook/route.ts");
  const { localWhatsAppRuntime } = require("../src/lib/channels/whatsapp/local-runtime.ts");
  const { readWhatsAppConfig } = require("../src/lib/channels/whatsapp/config.ts");
  const post = (raw) => route.POST(new Request("http://localhost/api/channels/whatsapp/webhook", { method: "POST", body: raw, headers: { "x-hub-signature-256": sign(raw) } }));
  const waId = "84900000011";
  const first = webhook(waId, "cho 2 gà", "wamid.E2E_1", "Khách E2E");
  const logs = await captureLogs(async () => {
    for (const raw of [first, webhook(waId, "à 3 đi", "wamid.E2E_2", "Khách E2E"), webhook(waId, "thêm pepsi", "wamid.E2E_3", "Khách E2E"), first])
      assert.equal((await post(raw)).status, 200);
    await localWhatsAppRuntime(readWhatsAppConfig()).drain();
  });
  assert.equal(graph.length, 1, "three quick messages and a resend give one reply");
  assert.equal(graph[0].body.to, waId);
  assert.equal(graph[0].body.type, "text");
  assert.ok(graph[0].body.text.body.length > 0);
  const userId = channelUserId(waId, ID_SECRET);
  const session = await services.sessionService.getActiveSession(userId);
  assert.equal(session.platform, "whatsapp");
  const messages = await services.sessionService.getMessages(session.id);
  assert.deepEqual(messages.filter((m) => m.role === "user").map((m) => m.content), ["cho 2 gà\nà 3 đi\nthêm pepsi"], "one merged customer turn");
  assert.equal(messages.filter((m) => m.role === "assistant").length, 1);
  const state = await services.channelStateService.get("whatsapp", userId);
  assert.equal(state.profileName, "Khách E2E");
  assert.equal(state.mode, "AI");
  // Durable in the local store, keyed by the pseudonymous id.
  const store = fs.readFileSync(path.join(dataDir, "store.json"), "utf8");
  assert.ok(store.includes(`whatsapp#${userId}`));
  assert.doesNotMatch(logs, /84900000011|cho 2 gà|thêm pepsi|synthetic-access-token/, "logs hold no number, message text or token");
});

test("03 two customers at once: a slow customer does not hold up another; each customer's turns stay in order", async () => {
  let releaseA;
  const gate = new Promise((resolve) => { releaseA = resolve; });
  const order = [];
  const f = fakes({ agent: async ({ message }) => { if (message === "A1") await gate; order.push(message); return { reply: "ok " + message }; } });
  const worker = createChannelWorker(f.deps);
  const debouncer = createTurnDebouncer((batch) => worker.handleTurn(batch), { windowMs: 5 });
  debouncer.push(message("84900000021", "A1"));
  debouncer.push(message("84900000022", "B1"));
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.deepEqual(order, ["B1"], "B answered while A is still waiting on the agent");
  debouncer.push(message("84900000021", "A2"));
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.deepEqual(order, ["B1"], "A's second turn waits for A's first");
  releaseA();
  await debouncer.flushAll();
  assert.deepEqual(order, ["B1", "A1", "A2"]);
});

test("04 worker: staff takeover silences the AI; unsupported kinds get a polite reply; agent failure is never silent", async () => {
  // HUMAN mode: no agent call, no reply.
  const human = fakes();
  const customerId = channelUserId("84900000031", ID_SECRET);
  await human.deps.states.recordInbound({ channel: "whatsapp", customerId, externalUserId: "84900000031", receivedAt: "2026-11-22T03:00:00.000Z" });
  const repo = human.deps.states.repository;
  const current = await repo.getConversationState("whatsapp", customerId);
  await repo.saveConversationState({ ...current, mode: "HUMAN", revision: crypto.randomUUID() }, current.revision);
  assert.equal(await createChannelWorker(human.deps).handleTurn([message("84900000031", "cho 1 gà")]), "human");
  assert.equal(human.asked.length + human.sent.length, 0);

  const unsupported = fakes();
  assert.equal(await createChannelWorker(unsupported.deps).handleTurn([message("84900000032", undefined, { kind: "unsupported" })]), "unsupported");
  assert.deepEqual(unsupported.sent.map((s) => s.out), [UNSUPPORTED_REPLY]);
  assert.equal(unsupported.asked.length, 0);
  // A photo with a caption-less text next to it: the text is answered.
  const mixed = fakes();
  assert.equal(await createChannelWorker(mixed.deps).handleTurn([message("84900000033", undefined, { kind: "unsupported" }), message("84900000033", "menu có gì")]), "replied");
  assert.equal(mixed.asked[0].message, "menu có gì");

  let result;
  const failing = fakes({ agent: async () => { throw new Error("bedrock down"); } });
  const logs = await captureLogs(async () => { result = await createChannelWorker(failing.deps).handleTurn([message("84900000034", "cho 1 gà")]); });
  assert.equal(result, "agent_error");
  assert.deepEqual(failing.sent.map((s) => s.out), [AGENT_ERROR_REPLY], "the customer is told, not left waiting");
  assert.doesNotMatch(logs, /84900000034|cho 1 gà|bedrock down/);

  const undelivered = fakes();
  undelivered.deps.sender = { send: async () => ({ ok: false }) };
  const sendLogs = await captureLogs(async () => { result = await createChannelWorker(undelivered.deps).handleTurn([message("84900000035", "hi")]); });
  assert.equal(result, "send_failed");
  assert.match(sendLogs, /84\*+035/);
  await assert.rejects(createChannelWorker(fakes().deps).handleTurn([message("84900000036", "a"), message("84900000037", "b")]), /một khách/);
});

test("05 merging: newest messages kept within the chat limit; debounce waits for a pause, caps the wait, sends buttons at once", async () => {
  const many = Array.from({ length: 30 }, (_, i) => message("84900000041", `tin ${i} ` + "x".repeat(60)));
  const merged = mergeTurnText(many);
  assert.ok(merged.length <= 1000);
  assert.ok(merged.endsWith(many.at(-1).text), "the latest message is always kept");
  assert.ok(!merged.includes("tin 0 "), "the oldest are dropped first");
  assert.equal(mergeTurnText([message("84900000041", "y".repeat(1500))]).length, 1000);
  assert.equal(mergeTurnText([message("84900000041", "  "), message("84900000041", undefined, { kind: "unsupported" })]), "");

  let clock = 0;
  const turns = [];
  const debouncer = createTurnDebouncer(async (batch) => { turns.push(batch.map((m) => m.text ?? m.kind)); }, { windowMs: 30, maxWaitMs: 100, now: () => clock });
  debouncer.push(message("84900000042", "a"));
  clock = 50; debouncer.push(message("84900000042", "b"));
  clock = 120; debouncer.push(message("84900000042", "c")); // waited past maxWaitMs: flushed now
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepEqual(turns, [["a", "b", "c"]]);
  debouncer.push(message("84900000042", "d"));
  debouncer.push(message("84900000042", "Xác nhận thao tác", { kind: "button_reply", replyId: "confirm:x" }));
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepEqual(turns[1], ["d", "Xác nhận thao tác"], "a button press is not held back");
  await debouncer.flushAll();
});

test("06 SQS FIFO driver: group = pseudonymous customer, dedup = hash of the message id, batches of 10, failures surface", async () => {
  const calls = [];
  const client = { sendMessageBatch: async (input) => { calls.push(input); return {}; } };
  const queue = createSqsInboundQueue({ queueUrl: "https://sqs.ap-southeast-1.amazonaws.com/000000000000/kfc-inbound.fifo", client,
    groupId: (m) => channelUserId(m.externalUserId, ID_SECRET) });
  const batch = Array.from({ length: 23 }, (_, i) => message(i % 2 ? "84900000051" : "84900000052", "m" + i));
  await queue.enqueue(batch);
  assert.deepEqual(calls.map((c) => c.Entries.length), [10, 10, 3]);
  const entry = calls[0].Entries[0];
  assert.equal(entry.MessageGroupId, channelUserId("84900000052", ID_SECRET));
  assert.match(entry.MessageDeduplicationId, /^[0-9a-f]{64}$/);
  assert.ok(calls.every((c) => c.Entries.every((e) => !e.MessageGroupId.includes("900000") && !e.MessageDeduplicationId.includes("wamid"))));
  assert.deepEqual(parseInboundMessage(entry.MessageBody), batch[0], "the body round-trips");
  const failing = createSqsInboundQueue({ queueUrl: "https://sqs.ap-southeast-1.amazonaws.com/000000000000/kfc-inbound.fifo",
    client: { sendMessageBatch: async () => ({ Failed: [{ Id: "0" }] }) }, groupId: () => "g" });
  await assert.rejects(failing.enqueue([message("84900000053", "x")]), /SQS_SEND_FAILED/);
  assert.throws(() => createSqsInboundQueue({ queueUrl: "https://sqs.ap-southeast-1.amazonaws.com/000000000000/standard", client, groupId: () => "g" }), /FIFO/);
  for (const bad of ["not json", "{}", JSON.stringify({ ...batch[0], externalUserId: "+84 900" }), JSON.stringify({ ...batch[0], extra: 1 })])
    assert.equal(parseInboundMessage(bad), null);
});

test("07 Lambda worker on SQS: one turn per customer per batch, in order; a failing customer is retried alone; AgentCore port", async () => {
  const turns = [];
  const worker = { handleTurn: async (batch) => {
    if (batch[0].externalUserId === "84900000062") throw new Error("dynamodb throttled");
    turns.push(batch.map((m) => m.text));
    return "replied";
  } };
  const handler = createChannelWorkerHandler({ worker });
  const records = [
    message("84900000061", "a1"), message("84900000062", "b1"), message("84900000061", "a2"), message("84900000062", "b2"),
  ].map((m, i) => ({ messageId: "r" + i, body: JSON.stringify(m) }));
  records.push({ messageId: "r-bad", body: "garbage" });
  let result;
  await captureLogs(async () => { result = await handler({ Records: records }); });
  assert.deepEqual(turns, [["a1", "a2"]], "A's two messages merged into one turn, in order");
  assert.deepEqual(result.batchItemFailures.map((f) => f.itemIdentifier).sort(), ["r1", "r3"], "only B's records come back; garbage is dropped");

  const payloads = [];
  const port = agentCoreChatPort(async (payload) => { payloads.push(payload); return { status: "success", reply: "Chào bạn" }; });
  assert.deepEqual(await port.chat({ userId: "wa_x", message: "hi" }), { reply: "Chào bạn", pendingConfirmation: null });
  assert.deepEqual(payloads, [{ userId: "wa_x", message: "hi", platform: "whatsapp" }]);
  assert.equal(invocationSchema.safeParse(payloads[0]).success, true, "AgentCore accepts the WhatsApp platform");
  await assert.rejects(agentCoreChatPort(async () => ({ status: "error", error: "internal_error" })).chat({ userId: "wa_x", message: "hi" }), /AGENTCORE_ERROR/);
});

test("08 local backup/restore accepts the new channel state and snapshots made before it; unknown repositories still fail", () => {
  const { validateSnapshot } = require("./local-data.cjs");
  const store = fs.readFileSync(path.join(dataDir, "store.json"));
  const parsed = JSON.parse(store.toString("utf8"));
  assert.ok(parsed.channelRepository.conversationStates.length >= 1, "test 02 wrote a conversation state");
  validateSnapshot(store);
  const { channelRepository, ...older } = parsed;
  void channelRepository;
  validateSnapshot(Buffer.from(JSON.stringify(older)));
  assert.throws(() => validateSnapshot(Buffer.from(JSON.stringify({ ...parsed, strangerRepository: {} }))), /Invalid local snapshot/);
  assert.throws(() => validateSnapshot(Buffer.from(JSON.stringify({ ...parsed, channelRepository: { other: [] } }))), /missing a required map/);
});
