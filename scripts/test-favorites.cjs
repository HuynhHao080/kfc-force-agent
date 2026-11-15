/* eslint-disable @typescript-eslint/no-require-imports -- Offline regressions for legacy preferences and favorite revisions. */
const assert = require("node:assert/strict");
require("./register-typescript.cjs");
const {
  createMemoryRepositories,
} = require("../src/lib/db/repositories/implementations/mock-repository.ts");
const { MenuService } = require("../src/lib/services/menu-service.ts");
const {
  FavoritesService,
} = require("../src/lib/services/favorites-service.ts");

async function main() {
  const repositories = createMemoryRepositories();
  const users = repositories.userRepository;
  const menu = new MenuService(repositories.menuRepository);
  const service = new FavoritesService(users, menu);
  const items = await menu.getAvailableMenuItems();
  const owner = "synthetic-favorites";
  const legacy = {
    id: "legacy",
    userId: owner,
    language: "en",
    defaultAddressId: "retained-address",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  await users.updateUserPreferences(legacy);
  const original = await service.view(owner);
  assert.deepEqual(original.itemIds, []);
  assert.notEqual(
    original.revision,
    (await service.view("other-owner")).revision,
  );
  const saved = await service.set(owner, items[0].id, true, original.revision);
  const preferences = await users.getUserPreferences(owner);
  for (const field of ["id", "language", "defaultAddressId", "createdAt"])
    assert.equal(preferences[field], legacy[field]);
  const savedItem = saved.itemIds[0];
  saved.itemIds.length = 0;
  assert.deepEqual((await service.view(owner)).itemIds, [savedItem]);
  saved.itemIds.push(savedItem);
  console.log(
    "PASS 1: Legacy preferences retain existing fields and isolate owners",
  );

  await assert.rejects(
    service.set(owner, "missing-product", true, saved.revision),
    (error) => error.code === "MENU_ITEM_UNAVAILABLE",
  );
  assert.deepEqual(await service.view(owner), saved);
  const returned = await service.view(owner);
  returned.itemIds.length = 0;
  assert.deepEqual(await service.view(owner), saved);
  console.log(
    "PASS 2: Invalid items and editing a returned DTO cannot change stored favorites",
  );

  const outcomes = await Promise.allSettled(
    items
      .slice(1, 3)
      .map((item) => service.set(owner, item.id, true, saved.revision)),
  );
  assert.equal(
    outcomes.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.equal(
    outcomes.filter(
      (result) =>
        result.status === "rejected" &&
        result.reason.code === "FAVORITES_CHANGED",
    ).length,
    1,
  );
  const current = await service.view(owner);
  assert.equal(current.itemIds.length, 2);
  assert.deepEqual(
    await service.set(owner, items[0].id, true, current.revision),
    current,
  );
  console.log(
    "PASS 3: Concurrent direct callers serialize with revision checks and same-state requests are idempotent",
  );

  const removed = await service.set(
    owner,
    items[0].id,
    false,
    current.revision,
  );
  const restored = await service.set(
    owner,
    items[0].id,
    true,
    removed.revision,
  );
  assert.notEqual(restored.revision, current.revision);
  await assert.rejects(
    service.set(owner, items[0].id, false, current.revision),
    (error) => error.code === "FAVORITES_CHANGED",
  );
  console.log(
    "PASS 4: Removing and re-adding a favorite never restores an old revision",
  );

  const full = await users.getUserPreferences(owner);
  full.favoriteMenuItemIds = Array.from(
    { length: 200 },
    (_, index) => "retired-" + index,
  );
  await users.updateUserPreferences(full);
  const limit = await service.view(owner);
  await assert.rejects(
    service.set(owner, items[0].id, true, limit.revision),
    (error) => error.code === "FAVORITES_LIMIT",
  );
  const cleaned = await service.set(owner, "retired-0", false, limit.revision);
  assert.equal(cleaned.itemIds.length, 199);
  console.log(
    "PASS 5: Limit checks retain data and retired items can still be removed",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
