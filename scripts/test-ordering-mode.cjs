/* eslint-disable @typescript-eslint/no-require-imports -- Offline test: the main flow (issue #16) orders from the real KFC catalog into the kitchen board. */
require("./offline-network-guard.cjs");
const os = require("node:os"), fs = require("node:fs"), path = require("node:path");
Object.assign(process.env, {
  AI_PROVIDER: "mock", PERSISTENCE_DRIVER: "local",
  // Main flow: real catalog, orders go to the kitchen (no redirect to the KFC website).
  KFC_PURCHASE_ASSISTANT: "0", KFC_CATALOG: "kfc",
  LOCAL_DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), "kfc-ordering-mode-")),
  SESSION_SECRET: "synthetic-ordering-mode-signing-secret-2026-x",
});
require("./register-typescript.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { kfcCatalogEnabled, kfcPurchaseAssistantEnabled } = require("../src/lib/purchase-mode.ts");
const { services } = require("../src/lib/agent/agent-core.ts");

test("01 the catalog flag is separate from the purchase-assistant flag; unset keeps the old behaviour", () => {
  const saved = { a: process.env.KFC_PURCHASE_ASSISTANT, c: process.env.KFC_CATALOG };
  try {
    const cases = [
      // [KFC_PURCHASE_ASSISTANT, KFC_CATALOG, real catalog?]
      ["0", "kfc", true], ["0", "demo", false], ["1", "demo", false], ["1", "kfc", true],
      ["0", undefined, false], ["1", undefined, true], ["0", " KFC ", true], ["1", "", true],
    ];
    for (const [assistant, catalog, expected] of cases) {
      process.env.KFC_PURCHASE_ASSISTANT = assistant;
      if (catalog === undefined) delete process.env.KFC_CATALOG; else process.env.KFC_CATALOG = catalog;
      assert.equal(kfcCatalogEnabled(), expected, `KFC_PURCHASE_ASSISTANT=${assistant} KFC_CATALOG=${catalog}`);
    }
  } finally {
    process.env.KFC_PURCHASE_ASSISTANT = saved.a;
    process.env.KFC_CATALOG = saved.c;
  }
});

test("02 main flow: real KFC catalog → checkout → CONFIRMED order on the kitchen board", async () => {
  assert.equal(kfcPurchaseAssistantEnabled(), false);
  const menu = await services.menuService.getAvailableMenuItems();
  const item = menu.find((entry) => entry.name.normalize("NFC") === "Burger Tôm");
  assert.ok(item, "the real KFC catalog is loaded, not the demo menu");
  assert.ok(menu.length >= 90, `real catalog size (${menu.length})`);

  const userId = "ordering-" + crypto.randomUUID();
  await services.cartService.addMenuItem(userId, item, 2);
  const view = await services.cartService.getCartView(userId);
  const input = {
    cartId: view.cart.id, cartSignature: view.signature, customerName: "Khách Synthetic", phone: "0900000001",
    fulfillment: "pickup", address: "", note: "", idempotencyKey: crypto.randomUUID(), expectedTotal: view.cart.total, confirm: true,
  };
  const order = await services.checkoutService.checkout(userId, input);
  assert.equal(order.status, "CONFIRMED");
  assert.equal(order.total, 2 * item.price, "price comes from the server catalog");
  const replay = await services.checkoutService.checkout(userId, input);
  assert.equal(replay.id, order.id, "same idempotency key, same order");

  const board = await services.adminService.kitchen();
  const card = board.cards.find((entry) => entry.id === order.id);
  assert.ok(card, "the order reaches the kitchen board");
  assert.equal(card.status, "CONFIRMED");
  assert.deepEqual(card.items.map((line) => [line.name.normalize("NFC"), line.quantity]), [["Burger Tôm", 2]]);
});
