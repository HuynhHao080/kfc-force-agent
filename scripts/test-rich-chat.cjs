/* eslint-disable @typescript-eslint/no-require-imports -- Offline regressions for server-owned product cards and historical messages. */
const assert = require("node:assert/strict");
require("./register-typescript.cjs");
const {
  chatProducts,
  resultProductIds,
  hydrateChatMessages,
} = require("../src/lib/agent/chat-products.ts");
const { catalogRecords } = require("../src/lib/catalog/kfc-catalog.ts");
const records = catalogRecords(
  require("../src/lib/catalog/kfc-menu.snapshot.json"),
);
const items = records.items;
const result = {
  actionId: "synthetic",
  actionType: "SEARCH_MENU",
  decision: "ALLOW",
  executed: true,
  reason: "synthetic",
  data: { items: [...items, items[0]] },
};
const ids = resultProductIds([result]);
assert.equal(ids.length, 6);
assert.equal(new Set(ids).size, 6);
assert.deepEqual(resultProductIds([{ ...result, executed: false }]), []);
assert.deepEqual(
  resultProductIds([{ ...result, actionType: "VIEW_CART" }]),
  [],
);
assert.deepEqual(
  resultProductIds([
    { ...result, data: { items: [null, {}, { id: 10 }, { id: items[0].id }] } },
  ]),
  [items[0].id],
);
console.log(
  "PASS 1: Only executed menu tools produce bounded deduplicated card IDs",
);

const forged = {
  ...result,
  data: {
    items: [
      {
        id: items[0].id,
        name: "Forged name",
        price: 1,
        imageUrl: "https://attacker.invalid/test.jpg",
        contact: "PRIVATE_SYNTHETIC",
      },
      { id: "missing" },
    ],
  },
};
const cards = chatProducts(resultProductIds([forged]), items);
assert.equal(cards[0].price, items[0].price);
assert.equal(cards[0].name, items[0].name);
assert.equal(cards[0].imageUrl, items[0].imageUrl);
assert.equal(cards.length, 1);
assert.equal(JSON.stringify(cards).includes("PRIVATE_SYNTHETIC"), false);
assert.deepEqual(Object.keys(cards[0]).sort(), [
  "id",
  "imageUrl",
  "name",
  "price",
]);
console.log(
  "PASS 2: Card price, name and image are reloaded from the current catalog with a minimal DTO",
);

const messages = [
  {
    id: "legacy",
    sessionId: "synthetic",
    role: "assistant",
    content: "Legacy text",
    createdAt: "synthetic",
  },
  {
    id: "cards",
    sessionId: "synthetic",
    role: "assistant",
    content: "Found products",
    productIds: ids,
    createdAt: "synthetic",
  },
  {
    id: "user",
    sessionId: "synthetic",
    role: "user",
    content: "User input",
    productIds: ids,
    createdAt: "synthetic",
  },
];
const changed = structuredClone(items);
changed[0].price += 1000;
changed[1].isAvailable = false;
const hydrated = hydrateChatMessages(messages, changed);
assert.deepEqual(hydrated[0].products, []);
assert.equal(hydrated[1].products[0].price, changed[0].price);
assert.equal(
  hydrated[1].products.some((item) => item.id === changed[1].id),
  false,
);
assert.equal(hydrated[2].products, undefined);
assert.equal(hydrated[1].content, messages[1].content);
console.log(
  "PASS 3: Historical messages stay readable, cards use fresh prices and unavailable items disappear",
);
async function interactive() {
  process.env.PERSISTENCE_DRIVER = 'mock';
  process.env.AI_PROVIDER = 'mock';
  const { services } = require('../src/lib/agent/agent-core.ts');
  const { chatRequestSchema } = require('../src/lib/validation/chat.ts');
  const item = (await services.menuService.getAvailableMenuItems())[0];
  const request = { platform: 'web', userId: 'synthetic-rich-card', sessionId: 'synthetic-rich-card', message: 'Thêm 1 Deal 99K synthetic', selectedProduct: { itemId: item.id, quantity: 2 } };
  assert.equal(chatRequestSchema.safeParse(request).success, true);
  for (const invalid of [{ ...request, selectedProduct: { ...request.selectedProduct, price: 1 } }, { ...request, selectedProduct: { itemId: item.id, quantity: '2' } }, { ...request, selectedProduct: { itemId: item.id, quantity: 0 } }, { ...request, confirm: true, confirmationId: crypto.randomUUID() }])
    assert.equal(chatRequestSchema.safeParse(invalid).success, false);
  const provider = services.llmProvider;
  services.llmProvider = { generateResponse: async () => { throw new Error('Card selection must not call the provider'); } };
  try {
    const proposed = await services.chatService.processChat(request);
    assert.equal(proposed.requiresConfirmation, true);
    assert.equal(await services.cartService.getActiveCart(request.userId), null);
    const confirmed = await services.chatService.processChat({ ...request, selectedProduct: undefined, message: 'Xác nhận', confirm: true, confirmationId: proposed.pendingConfirmation.id });
    assert.equal(confirmed.requiresConfirmation, false);
    const cart = await services.cartService.getCartView(request.userId);
    assert.equal(cart.items[0].menuItemId, item.id);
    assert.equal(cart.items[0].quantity, 2);
    assert.equal(cart.items[0].unitPrice, item.price);
    await services.chatService.processChat({ ...request, selectedProduct: undefined, message: 'Xác nhận', confirm: true, confirmationId: proposed.pendingConfirmation.id });
    assert.equal((await services.cartService.getCartView(request.userId)).items[0].quantity, 2);
    const unknown = await services.chatService.processChat({ ...request, selectedProduct: { itemId: 'missing-product', quantity: 2 } });
    assert.equal(unknown.requiresConfirmation, false);
    assert.equal((await services.cartService.getCartView(request.userId)).items[0].quantity, 2);
  } finally { services.llmProvider = provider; }
  console.log('PASS 4: Explicit card choices skip inference, validate strict input and require one-time confirmation');
  console.log('4 rich chat regressions passed. No provider calls.');
}
interactive().catch(error => { console.error(error); process.exitCode = 1; });
