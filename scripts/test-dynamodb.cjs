/* eslint-disable @typescript-eslint/no-require-imports -- DynamoDB acceptance: real repository classes against DynamoDB Local (or an approved table). */
// Prerequisites (offline):
//   java -Djava.library.path=./DynamoDBLocal_lib -jar DynamoDBLocal.jar -inMemory -port 8000
//   DYNAMODB_ENDPOINT=http://127.0.0.1:8000 DYNAMODB_TABLE_NAME=KfcForceAgentTest npm run dynamodb:table create
//   DYNAMODB_ENDPOINT=http://127.0.0.1:8000 DYNAMODB_TABLE_NAME=KfcForceAgentTest npm run dynamodb:seed
//   DYNAMODB_ENDPOINT=http://127.0.0.1:8000 DYNAMODB_TABLE_NAME=KfcForceAgentTest npm run test:dynamodb
// Never points at real AWS by itself: it exits unless DYNAMODB_ENDPOINT is set or
// --approve-aws <account id> is passed. No Bedrock calls (AI_PROVIDER=mock).
const approve = process.argv.indexOf("--approve-aws") >= 0 ? process.argv[process.argv.indexOf("--approve-aws") + 1] : null;
if (!process.env.DYNAMODB_ENDPOINT && !/^\d{12}$/.test(approve ?? "")) {
  console.error("DYNAMODB_ENDPOINT is not set. Start DynamoDB Local (see header) or pass --approve-aws <account id> for an approved table.");
  process.exit(2);
}
process.env.PERSISTENCE_DRIVER = "dynamodb";
process.env.AI_PROVIDER = "mock";
process.env.KFC_PURCHASE_ASSISTANT = "1";
process.env.SESSION_SECRET ??= "synthetic-dynamodb-acceptance-signing-secret-2026";
process.env.BEDROCK_DAILY_REQUEST_LIMIT = "10";
require("./register-typescript.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { services } = require("../src/lib/agent/agent-core.ts");
const { reserveBedrockInvocationDynamoDB } = require("../src/lib/aws/invocation-budget.ts");
const { DomainError } = require("../src/lib/domain-error.ts");

const table = process.env.DYNAMODB_TABLE_NAME || "KfcForceAgent";
const user = () => "ddb-" + crypto.randomUUID();
const chat = (userId, message, extra = {}) =>
  services.chatService.processChat({ platform: "web", userId, sessionId: `chat_${userId}`, message, ...extra });

test("01 table is reachable and holds the seeded KFC catalog", async () => {
  const items = await services.menuService.getAvailableMenuItems();
  assert.ok(items.length >= 100, `expected the seeded catalog in ${table}, found ${items.length} items (run npm run dynamodb:seed)`);
  assert.ok(items.some((i) => i.name === "Pepsi (Đại)"));
});

test("02 chat → proposal → confirmation persists cart, messages and context in DynamoDB", async () => {
  const userId = user();
  const proposal = await chat(userId, "Thêm 1 pepsi lớn");
  assert.equal(proposal.requiresConfirmation, true);
  // The catalog snapshot stores decomposed (NFD) Vietnamese; compare in NFC.
  const summary = proposal.pendingConfirmation.summary.map((s) => s.normalize("NFC").replace(/[\s  ]+/g, " "));
  assert.equal(summary.length, 1);
  assert.match(summary[0], /^Thêm 1 × Pepsi \(Đại\): 20\.000 ₫$/, JSON.stringify([...summary[0]].map((c) => c.codePointAt(0).toString(16))));
  const session = await services.sessionService.getActiveSession(userId);
  const context = await services.sessionService.getConversationContext(session.id);
  assert.equal(context.context.pendingConfirmation.id, proposal.pendingConfirmation.id, "proposal stored server-side");
  const confirmed = await chat(userId, "Xác nhận", { confirm: true, confirmationId: proposal.pendingConfirmation.id });
  assert.ok(confirmed.execution.some((row) => row.executed));
  const view = await services.cartService.getCartView(userId);
  assert.equal(view.items.length, 1);
  assert.equal(view.items[0].nameSnapshot, "Pepsi (Đại)");
  assert.equal(view.items[0].quantity, 1);
  assert.equal(view.cart.total, 20000, "price comes from the catalog row, not the message");
  const messages = await services.sessionService.getMessages(session.id);
  assert.ok(messages.length >= 4, "user and assistant turns persisted");
  const again = await chat(userId, "Xác nhận", { confirm: true, confirmationId: proposal.pendingConfirmation.id });
  assert.ok(!again.execution.some((row) => row.executed), "a consumed proposal cannot execute twice");
});

test("03 concurrent cart writes are serialised by the conditional transaction (no lost updates)", async () => {
  const userId = user();
  const item = (await services.menuService.getAvailableMenuItems()).find((i) => i.name === "Pepsi (Lon)");
  const results = await Promise.allSettled(Array.from({ length: 10 }, () => services.cartService.addMenuItem(userId, item, 1)));
  const ok = results.filter((r) => r.status === "fulfilled").length;
  const conflicts = results.filter((r) => r.status === "rejected");
  for (const r of conflicts) assert.ok(r.reason instanceof DomainError || /Conditional|Transaction/i.test(String(r.reason)), String(r.reason));
  const view = await services.cartService.getCartView(userId);
  const quantity = view.items.find((line) => line.menuItemId === item.id)?.quantity ?? 0;
  assert.equal(quantity, ok, `every accepted write is reflected exactly once (${ok} ok, ${conflicts.length} rejected)`);
  assert.ok(ok >= 1);
});

test("04 cart edits via chat update and remove the right line", async () => {
  const userId = user();
  const add = await chat(userId, "Thêm 2 Pepsi (Lon)");
  await chat(userId, "Xác nhận", { confirm: true, confirmationId: add.pendingConfirmation.id });
  const update = await chat(userId, "Đổi Pepsi (Lon) thành 3");
  assert.equal(update.requiresConfirmation, true);
  await chat(userId, "Xác nhận", { confirm: true, confirmationId: update.pendingConfirmation.id });
  let view = await services.cartService.getCartView(userId);
  assert.equal(view.items[0].quantity, 3);
  const remove = await chat(userId, "Xoá Pepsi (Lon) khỏi giỏ");
  await chat(userId, "Xác nhận", { confirm: true, confirmationId: remove.pendingConfirmation.id });
  view = await services.cartService.getCartView(userId);
  assert.equal(view?.items.length ?? 0, 0);
});

test("05 checkout is idempotent and snapshots prices in DynamoDB", async (t) => {
  const userId = user();
  const item = (await services.menuService.getAvailableMenuItems()).find((i) => i.name === "Burger Tôm");
  await services.cartService.addMenuItem(userId, item, 2);
  const view = await services.cartService.getCartView(userId);
  const input = {
    cartId: view.cart.id, cartSignature: view.signature, customerName: "Khách Synthetic", phone: "0900000001",
    fulfillment: "pickup", address: "", note: "", idempotencyKey: crypto.randomUUID(), expectedTotal: view.cart.total, confirm: true,
  };
  let order;
  try {
    order = await services.checkoutService.checkout(userId, input);
  } catch (error) {
    if (error instanceof DomainError && error.code === "SHOP_CLOSED") return t.skip("shop schedule closed at test time: " + error.message);
    throw error;
  }
  assert.equal(order.total, 2 * item.price);
  const replay = await services.checkoutService.checkout(userId, input);
  assert.equal(replay.id, order.id, "same idempotency key returns the same order");
  const orders = await services.orderService.getUserOrders(userId);
  assert.equal(orders.filter((o) => o.id === order.id).length, 1);
  const items = await services.orderService.getOrderItems(order.id);
  assert.equal(items[0].unitPrice, item.price, "price snapshot stored with the order");
  const after = await services.cartService.getCartView(userId);
  assert.ok(!after || after.cart.id !== view.cart.id, "checked-out cart is closed");
});

test("06 Bedrock daily budget: conditional atomic counter never exceeds the limit under concurrency", async () => {
  const day = new Date(Date.UTC(2099, 0, 1 + Math.floor(Math.random() * 300)));
  const results = await Promise.allSettled(Array.from({ length: 25 }, () => reserveBedrockInvocationDynamoDB(day)));
  const ok = results.filter((r) => r.status === "fulfilled");
  const denied = results.filter((r) => r.status === "rejected");
  assert.equal(ok.length, 10, "exactly BEDROCK_DAILY_REQUEST_LIMIT reservations succeed");
  assert.equal(denied.length, 15);
  for (const r of denied) assert.match(String(r.reason.message), /ceiling has been reached/);
  assert.deepEqual([...new Set(ok.map((r) => r.value.used))].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], "each success gets a distinct sequence number");
  await assert.rejects(reserveBedrockInvocationDynamoDB(day), /ceiling/);
  const nextDay = new Date(day.getTime() + 86400000);
  assert.equal((await reserveBedrockInvocationDynamoDB(nextDay)).used, 1, "a new UTC day starts a fresh counter");
});

test("07 data from a second client instance is identical (no process-local state)", async () => {
  const { DynamoDBCartRepository } = require("../src/lib/db/repositories/implementations/dynamodb-repository.ts");
  const userId = user();
  const item = (await services.menuService.getAvailableMenuItems())[0];
  await services.cartService.addMenuItem(userId, item, 1);
  const fresh = new DynamoDBCartRepository();
  const cart = await fresh.getActiveCart(userId);
  assert.ok(cart);
  const lines = await fresh.getCartItems(cart.id);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].menuItemId, item.id);
});
