/* eslint-disable @typescript-eslint/no-require-imports -- Offline grounding, catalog migration and price-filter regressions. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");
require("./register-typescript.cjs");
const { catalogRecords } = require("../src/lib/catalog/kfc-catalog.ts");
const { mergeCatalog } = require("../src/lib/catalog/merge-catalog.ts");
const { catalogContext } = require("../src/lib/agent/catalog-context.ts");
const {
  createMemoryRepositories,
} = require("../src/lib/db/repositories/implementations/mock-repository.ts");
const { MenuService } = require("../src/lib/services/menu-service.ts");
const { CartService } = require("../src/lib/services/cart-service.ts");
const { MenuTool } = require("../src/lib/agent/tools/menu-tool.ts");
const { PolicyEngine } = require("../src/lib/policy/policy-engine.ts");
const { getToolMapping } = require("../src/lib/policy/policy-engine.ts");
const { CartTool } = require("../src/lib/agent/tools/cart-tool.ts");
const { officialAnswer } = require("../src/lib/agent/official-answer.ts");
const input = require("../src/lib/catalog/kfc-menu.snapshot.json");
const records = catalogRecords(input);
const r = createMemoryRepositories(records);
const menu = new MenuService(r.menuRepository);
const cart = new CartService(r.cartRepository, menu);
const tool = new MenuTool(menu);
const policy = new PolicyEngine(cart, menu);
const context = { userId: "guest_synthetic_learning", sessionId: "synthetic" };
const root = path.resolve(__dirname, "..");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "kfc-learning-"));
let count = 0;
async function check(name, operation) {
  await operation();
  console.log("PASS " + ++count + ": " + name);
}
function snapshot(catalog) {
  return {
    menuRepository: {
      categories: catalog.categories.map((row) => [row.id, row]),
      items: catalog.items.map((row) => [row.id, row]),
    },
    accountRepository: {
      accounts: [["retained", { privateTestSentinel: "synthetic-retained" }]],
    },
    cartRepository: { carts: [["cart", { total: 123000 }]] },
    orderRepository: { orders: [["order", { acceptedPrice: 37000 }]] },
  };
}
async function main() {
  await check('Vietnamese word boundaries separate gà from ngậy and ngày in menu and cart references', async () => {
    const { matchesMenuQuery } = require('../src/lib/menu-search.ts');
    assert.equal(matchesMenuQuery({ name: 'Khoai Lắc Phô Mai', description: 'Phô mai thơm ngậy' }, 'gà', { allowNamePrefix: true }), false);
    assert.equal(matchesMenuQuery({ name: 'Combo Ngày Hè' }, 'gà'), false);
    assert.equal(matchesMenuQuery({ name: '1 Miếng Gà Rán' }, 'ga ran'), true);
    assert.equal(matchesMenuQuery({ name: 'Burger Gà Yo' }, 'bur', { allowNamePrefix: true }), true);
    const found = await menu.searchMenuItemsForCustomer('gà');
    assert.ok(!found.some(item => item.name === 'Khoai Lắc Phô Mai (L)'));
  });
  await check(
    "Price bounds, sorting and limits use the full current catalog",
    async () => {
      const all = await menu.searchMenuItemsForCustomer("gà");
      const expected = all
        .filter((item) => item.price >= 20000 && item.price <= 60000)
        .sort((a, b) => a.price - b.price || a.id.localeCompare(b.id))
        .slice(0, 5);
      const response = await tool.execute(
        {
          operation: "search",
          query: "gà",
          minPrice: 20000,
          maxPrice: 60000,
          sort: "price_asc",
          limit: 5,
        },
        context,
      );
      assert.equal(response.success, true);
      assert.deepEqual(
        response.data.items.map((item) => item.id),
        expected.map((item) => item.id),
      );
      assert.ok(response.data.items.length > 0);
      assert.equal(
        (await menu.searchMenuItemsForCustomer("")).length,
        records.items.length,
      );
    },
  );
  await check(
    "Invalid, reversed or out-of-range filters fail without cart writes",
    async () => {
      for (const params of [
        { maxPrice: -1 },
        { maxPrice: "60000" },
        { limit: 0 },
        { limit: 101 },
        { sort: "invented" },
      ]) {
        const outcome = await policy.evaluateAction(
          {
            id: "invalid",
            type: "SEARCH_MENU",
            parameters: { query: "gà", ...params },
            requiresConfirmation: false,
          },
          context,
        );
        assert.equal(outcome.decision, "BLOCK");
      }
      const result = await tool.execute(
        { operation: "search", query: "gà", minPrice: 100000, maxPrice: 1000 },
        context,
      );
      assert.equal(result.success, false);
      assert.equal(await cart.getActiveCart(context.userId), null);
    },
  );
  await check(
    "Prompt context is bounded and excludes customer, secret and arbitrary metadata fields",
    () => {
      const sentinel = "PRIVATE_SENTINEL";
      const products = records.items.map((item) => ({
        ...item,
        metadata: { password: sentinel },
      }));
      const text = catalogContext("Thêm 1 Xô Zòn Zã 159K", products, [
        {
          menuItemId: "known",
          nameSnapshot: "Pepsi (Lon)",
          quantity: 2,
          unitPrice: 20000,
          note: sentinel,
        },
      ]);
      const data = JSON.parse(text.slice(text.indexOf(":") + 1));
      assert.equal(data.candidates.length, 12);
      assert.equal(data.candidates[0].name, "Xô Zòn Zã 159K");
      assert.equal(data.totalAvailableProducts, records.items.length);
      assert.ok(Buffer.byteLength(text) < 12000);
      assert.ok(!text.includes(sentinel));
    },
  );
  const prior = structuredClone(records);
  const oldDate = "2026-01-01T00:00:00.000Z";
  for (const item of prior.items)
    item.metadata.source = {
      ...item.metadata.source,
      fetchedAt: oldDate,
      rawSha256: "b".repeat(64),
    };
  for (const category of prior.categories) category.updatedAt = oldDate;
  prior.items = prior.items.slice(2);
  const original = snapshot(prior);
  await check(
    "Catalog merge adds current offers atomically while preserving accounts, carts and order snapshots",
    () => {
      const before = JSON.stringify(original);
      const merged = mergeCatalog(original, records);
      assert.equal(JSON.stringify(original), before);
      assert.equal(merged.added, 2);
      assert.equal(
        merged.snapshot.menuRepository.items.length,
        records.items.length,
      );
      for (const key of [
        "accountRepository",
        "cartRepository",
        "orderRepository",
      ])
        assert.deepEqual(merged.snapshot[key], original[key]);
      assert.equal(
        merged.snapshot.menuRepository.items[0][1].name,
        records.items[0].name,
      );
      assert.equal(mergeCatalog(merged.snapshot, records).changed, false);
    },
  );
  await check(
    "Retired official products are disabled with their historical records retained",
    () => {
      const before = structuredClone(original);
      before.menuRepository.items.push([
        "retired",
        { ...prior.items[0], id: "retired" },
      ]);
      const merged = mergeCatalog(before, records);
      assert.equal(merged.retired, 1);
      const item = merged.snapshot.menuRepository.items.find(
        ([id]) => id === "retired",
      )[1];
      assert.equal(item.isActive, false);
      assert.equal(item.isAvailable, false);
      assert.equal(item.price, prior.items[0].price);
    },
  );
  await check(
    "Older captures are rejected and replay of the accepted capture is a no-op",
    () => {
      const current = snapshot(records);
      assert.throws(() => mergeCatalog(current, prior), /older/);
      assert.equal(mergeCatalog(current, records).changed, false);
    },
  );
  await check(
    "Startup refresh writes a private backup and retains unrelated data",
    () => {
      const directory = path.join(temporary, "refresh");
      fs.mkdirSync(directory);
      fs.writeFileSync(
        path.join(directory, "store.json"),
        JSON.stringify(original),
      );
      const result = spawnSync(
        process.execPath,
        [
          "-e",
          "require('./scripts/register-typescript.cjs');require('./src/lib/db/repositories/implementations/local-repository.ts').localRepositories();",
        ],
        {
          cwd: root,
          encoding: "utf8",
          windowsHide: true,
          env: {
            ...process.env,
            LOCAL_DATA_DIR: directory,
            KFC_PURCHASE_ASSISTANT: "1",
            KFC_CATALOG_REFRESH: "1",
            KFC_CATALOG_FILE: path.join(
              root,
              "src/lib/catalog/kfc-menu.snapshot.json",
            ),
          },
        },
      );
      assert.equal(result.status, 0, result.stderr);
      const stored = JSON.parse(
        fs.readFileSync(path.join(directory, "store.json")),
      );
      assert.deepEqual(
        stored.accountRepository.accounts,
        original.accountRepository.accounts,
      );
      assert.deepEqual(stored.accountRepository.authSessions, []);
      assert.deepEqual(stored.accountRepository.emails, []);
      assert.deepEqual(stored.menuRepository.bundles, []);
      const backups = fs
        .readdirSync(directory)
        .filter((name) => name.startsWith("store.before-catalog-"));
      assert.equal(backups.length, 1);
      assert.equal(
        fs.readFileSync(path.join(directory, backups[0]), "utf8"),
        JSON.stringify(original),
      );
    },
  );
  await check(
    "Failure publishing a catalog leaves the original store intact",
    () => {
      const directory = path.join(temporary, "failed-refresh");
      fs.mkdirSync(directory);
      const bytes = JSON.stringify(original);
      fs.writeFileSync(path.join(directory, "store.json"), bytes);
      const result = spawnSync(
        process.execPath,
        [
          "-e",
          "const fs=require('node:fs');fs.renameSync=()=>{throw Object.assign(new Error('synthetic rename failure'),{code:'EIO'});};require('./scripts/register-typescript.cjs');require('./src/lib/db/repositories/implementations/local-repository.ts').localRepositories();",
        ],
        {
          cwd: root,
          encoding: "utf8",
          windowsHide: true,
          env: {
            ...process.env,
            LOCAL_DATA_DIR: directory,
            KFC_PURCHASE_ASSISTANT: "1",
            KFC_CATALOG_REFRESH: "1",
            KFC_CATALOG_FILE: path.join(
              root,
              "src/lib/catalog/kfc-menu.snapshot.json",
            ),
          },
        },
      );
      assert.notEqual(result.status, 0);
      assert.equal(
        fs.readFileSync(path.join(directory, "store.json"), "utf8"),
        bytes,
      );
    },
  );
  await check(
    "Development corpus replays 38 labeled tool and official-source cases without inference",
    async () => {
      const corpus = require("../tests/data/kfc-agent-development.vi.json");
      assert.equal(corpus.cases.length, 38);
      const messages = new Set();
      for (const example of corpus.cases) {
        assert.ok(!messages.has(example.message));
        messages.add(example.message);
        if (example.expectedAction === "OFFICIAL_SOURCE") {
          assert.ok(
            officialAnswer(example.message)?.includes(
              "https://kfcvietnam.com.vn/",
            ),
          );
          continue;
        }
        const repos = createMemoryRepositories(records);
        const menu = new MenuService(repos.menuRepository);
        const carts = new CartService(repos.cartRepository, menu);
        const gate = new PolicyEngine(carts, menu);
        const mapping = getToolMapping(example.expectedAction);
        const parameters = { ...example.expectedParameters };
        if (
          ["UPDATE_CART", "REMOVE_FROM_CART"].includes(example.expectedAction)
        ) {
          const item = records.items.find(
            (item) => item.name === parameters.query,
          );
          await carts.addMenuItem(context.userId, item, 2);
          parameters.itemId = (
            await carts.getCartView(context.userId)
          ).items[0].id;
        }
        if (example.expectedAction === "CLEAR_CART")
          await carts.addMenuItem(context.userId, records.items[0], 2);
        const action = {
          id: example.id,
          type: example.expectedAction,
          parameters,
          requiresConfirmation: example.requiresConfirmation,
        };
        assert.equal(
          mapping.parameterSchema.safeParse(parameters).success,
          true,
          example.id,
        );
        const storedState = async () => {
          const active = await carts.getActiveCart(context.userId);
          return { cart: active, items: active ? await carts.getCartItems(active.id) : [] };
        };
        const before = JSON.stringify(await storedState());
        const decision = await gate.evaluateAction(action, context);
        assert.equal(
          decision.decision,
          example.requiresConfirmation ? "REQUIRE_CONFIRMATION" : "ALLOW",
          example.id,
        );
        assert.equal(
          JSON.stringify(await storedState()),
          before,
        );
        if (!example.requiresConfirmation && mapping.tool === "menu") {
          const result = await new MenuTool(menu).execute(
            {
              ...parameters,
              operation:
                example.expectedAction === "LIST_MENU"
                  ? "list_items"
                  : "search",
            },
            context,
          );
          assert.equal(result.success, true, example.id);
          const prices = result.data.items.map((item) => item.price);
          if (parameters.maxPrice !== undefined)
            assert.ok(
              prices.every((price) => price <= parameters.maxPrice),
              example.id,
            );
          if (parameters.limit)
            assert.ok(prices.length <= parameters.limit, example.id);
          if (parameters.sort === "price_asc")
            assert.deepEqual(
              prices,
              [...prices].sort((a, b) => a - b),
              example.id,
            );
        }
        if (example.requiresConfirmation) {
          if (example.expectedAction === "ADD_TO_CART")
            parameters.itemId = records.items.find(
              (item) => item.name === parameters.query,
            ).id;
          const result = await new CartTool(carts, menu).execute(
            { ...parameters, operation: mapping.operation },
            { ...context, confirmed: true },
            true,
          );
          assert.equal(result.success, true, example.id);
          const after = await carts.getCartView(context.userId);
          if (["ADD_TO_CART", "UPDATE_CART"].includes(example.expectedAction))
            assert.equal(
              after.items[0].quantity,
              parameters.quantity,
              example.id,
            );
          else assert.equal(after.items.length, 0, example.id);
        }
      }
    },
  );
  console.log(
    count + " learning and refresh regressions passed. No provider calls.",
  );
}
main().catch((error) => {
  console.error(error.stack);
  process.exitCode = 1;
});
