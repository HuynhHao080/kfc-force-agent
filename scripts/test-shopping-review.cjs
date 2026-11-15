/* eslint-disable @typescript-eslint/no-require-imports -- Offline regression tests for cart review and safe shopping-list export. */
const assert = require("node:assert/strict");
require("./register-typescript.cjs");
const {
  buildCartReview,
  shoppingListText,
} = require("../src/lib/cart-review.ts");
const {
  createMemoryRepositories,
} = require("../src/lib/db/repositories/implementations/mock-repository.ts");
const { MenuService } = require("../src/lib/services/menu-service.ts");
const { CartService } = require("../src/lib/services/cart-service.ts");
async function main() {
  const repositories = createMemoryRepositories();
  const menu = new MenuService(repositories.menuRepository);
  const carts = new CartService(repositories.cartRepository, menu);
  const item = (await menu.getAvailableMenuItems())[0];
  const original = await carts.addMenuItem(
    "synthetic-shopping-review",
    item,
    2,
  );
  const review = buildCartReview(
    original,
    await menu.getMenuItems(),
    new Date("2026-11-15T00:00:00Z"),
  );
  assert.equal(review.items[0].available, true);
  assert.equal(review.items[0].imageUrl, item.imageUrl);
  assert.equal(review.checkedAt, "2026-11-15T00:00:00.000Z");
  assert.deepEqual(review.basket, original);
  console.log(
    "PASS 1: Review matches current menu images and preserves the server cart",
  );

  await repositories.menuRepository.saveMenuItem({
    ...item,
    price: item.price + 1000,
  });
  const repriced = await carts.getCartView("synthetic-shopping-review");
  assert.notEqual(repriced.signature, original.signature);
  assert.equal(repriced.items[0].unitPrice, item.price + 1000);
  assert.equal(repriced.cart.total, (item.price + 1000) * 2);
  await repositories.menuRepository.saveMenuItem({
    ...item,
    isActive: false,
    isAvailable: false,
  });
  const retired = buildCartReview(
    await carts.getCartView("synthetic-shopping-review"),
    await menu.getMenuItems(),
  );
  assert.equal(retired.items[0].available, false);
  assert.equal(buildCartReview(original, []).items[0].available, false);
  console.log(
    "PASS 2: Price refresh changes the signature and retired or missing menu entries remain visible as warnings",
  );

  retired.basket.items[0].note = "PRIVATE_TEST_NOTE";
  retired.basket.cart.phone = "PRIVATE_TEST_PHONE";
  const text = shoppingListText(retired);
  assert.ok(text.includes(item.name));
  assert.ok(text.includes("2 ×"));
  assert.ok(text.includes("không được niêm yết"));
  assert.ok(text.includes("https://kfcvietnam.com.vn/menu"));
  for (const value of [
    "PRIVATE_TEST_NOTE",
    "PRIVATE_TEST_PHONE",
    original.cart.id,
    original.cart.userId,
  ])
    assert.ok(!text.includes(value));
  assert.equal(
    shoppingListText(buildCartReview({ cart: null, items: [] }, [])).includes(
      "undefined",
    ),
    false,
  );
  console.log(
    "PASS 3: Text exports include availability warnings and exclude contact, notes and identifiers",
  );
  console.log("3 shopping review regressions passed. No external calls.");
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
