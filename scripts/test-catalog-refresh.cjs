/* eslint-disable @typescript-eslint/no-require-imports -- Offline budget, restart and atomic publication regressions. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
require("./register-typescript.cjs");
const { CatalogRefresh } = require("../src/lib/catalog/catalog-refresh.ts");
const { catalogRecords } = require("../src/lib/catalog/kfc-catalog.ts");
const {
  localRepositories,
  applyLocalCatalog,
} = require("../src/lib/db/repositories/implementations/local-repository.ts");
const { withUserLock } = require("../src/lib/server/user-lock.ts");
const { SHOP_ORDER_GATE } = require("../src/lib/services/shop-service.ts");
const { fetchCatalog } = require("../src/lib/catalog/fetch-catalog.ts");
const fixture = require("../src/lib/catalog/kfc-menu.snapshot.json");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "kfc-refresh-"));
let count = 0;
async function check(name, action) {
  await action();
  console.log(`PASS ${++count}: ${name}`);
}
async function main() {
  let now = Date.parse("2026-11-15T00:00:00Z");
  let calls = 0;
  const stateDirectory = path.join(directory, "budget");
  const collect = async () => {
    calls++;
    return fixture;
  };
  let scheduler = new CatalogRefresh(
    stateDirectory,
    3600000,
    2,
    collect,
    async () => false,
    () => now,
  );
  await check(
    "Concurrent ticks, cache interval and restart consume one durable attempt",
    async () => {
      await Promise.all([scheduler.tick(), scheduler.tick()]);
      assert.equal(calls, 1);
      assert.equal(scheduler.status().outcome, "unchanged");
      scheduler = new CatalogRefresh(
        stateDirectory,
        3600000,
        2,
        collect,
        async () => false,
        () => now,
      );
      await scheduler.tick();
      assert.equal(calls, 1);
    },
  );
  await check(
    "Daily UTC budget survives restart and only renews on the next day",
    async () => {
      now += 3600000;
      await scheduler.tick();
      assert.equal(calls, 2);
      now += 3600000;
      await scheduler.tick();
      assert.equal(calls, 2);
      now = Date.parse("2026-11-16T00:00:00Z");
      await scheduler.tick();
      assert.equal(calls, 3);
    },
  );
  await check(
    "Provider failure backs off, retains last success and never retries immediately",
    async () => {
      const worker = new CatalogRefresh(
        path.join(directory, "failure"),
        3600000,
        24,
        async () => {
          throw new Error("private provider details");
        },
        async () => {
          throw new Error("must not publish");
        },
        () => now,
      );
      await worker.tick();
      assert.equal(worker.status().outcome, "error");
      assert.equal(Date.parse(worker.status().nextCheckAt) - now, 7200000);
      assert.equal(JSON.stringify(worker.status()).includes("private"), false);
      const disk = JSON.parse(
        fs.readFileSync(
          path.join(directory, "failure/catalog-refresh-state.json"),
        ),
      );
      assert.equal(disk.attempts, 1);
      await worker.tick();
      assert.equal(
        JSON.parse(
          fs.readFileSync(
            path.join(directory, "failure/catalog-refresh-state.json"),
          ),
        ).attempts,
        1,
      );
    },
  );
  await check(
    "A failed attempt-state write prevents the provider request",
    async () => {
      const worker = new CatalogRefresh(
        path.join(directory, "blocked"),
        3600000,
        24,
        collect,
        async () => true,
        () => now,
      );
      fs.writeFileSync(path.join(directory, "blocked"), "synthetic blocker");
      const previous = calls;
      await assert.rejects(worker.tick());
      assert.equal(calls, previous);
    },
  );
  await check("Long intervals are preserved and provider recovery clears backoff without losing the last success", async () => {
    const slow = new CatalogRefresh(path.join(directory, "daily"), 86400000, 24, collect, async () => false, () => now);
    await slow.tick();
    assert.equal(Date.parse(slow.status().nextCheckAt) - now, 86400000);
    let fail = false;
    const recovering = new CatalogRefresh(path.join(directory, "recovery"), 3600000, 24, async () => {
      if (fail) throw new Error("synthetic failure");
      return fixture;
    }, async () => false, () => now);
    await recovering.tick();
    const success = recovering.status().lastSuccessAt;
    now += 3600000;
    fail = true;
    await recovering.tick();
    assert.equal(recovering.status().lastSuccessAt, success);
    now += 7200000;
    fail = false;
    await recovering.tick();
    assert.equal(recovering.status().outcome, "unchanged");
    assert.equal(Date.parse(recovering.status().nextCheckAt) - now, 3600000);
  });
  process.env.LOCAL_DATA_DIR = path.join(directory, "store");
  process.env.KFC_PURCHASE_ASSISTANT = "1";
  process.env.KFC_CATALOG_REFRESH = "0";
  delete process.env.KFC_CATALOG_FILE;
  const repositories = localRepositories();
  const storeFile = path.join(process.env.LOCAL_DATA_DIR, "store.json");
  const incoming = structuredClone(fixture);
  incoming.source.fetchedAt = "2026-11-17T00:00:00Z";
  incoming.source.rawSha256 = "b".repeat(64);
  await check(
    "Identical public content skips store writes and backups despite new capture metadata",
    async () => {
      const before = fs.readFileSync(storeFile);
      assert.equal(await applyLocalCatalog(catalogRecords(incoming)), false);
      assert.ok(before.equals(fs.readFileSync(storeFile)));
      assert.equal(
        fs
          .readdirSync(process.env.LOCAL_DATA_DIR)
          .filter((name) => name.startsWith("store.before")).length,
        0,
      );
    },
  );
  await check(
    "Atomic publication waits for the order gate and preserves concurrent preference writes",
    async () => {
      let release, entered;
      const ready = new Promise((resolve) => {
        entered = resolve;
      });
      const held = withUserLock(
        SHOP_ORDER_GATE,
        () =>
          new Promise((resolve) => {
            release = resolve;
            entered();
          }),
      );
      await ready;
      incoming.catalog.items[0].price += 1000;
      let published = false;
      const pending = applyLocalCatalog(catalogRecords(incoming)).then(
        (result) => {
          published = result;
        },
      );
      await new Promise((resolve) => setImmediate(resolve));
      assert.equal(published, false);
      await repositories.userRepository.updateUserPreferences({
        id: "synthetic",
        userId: "synthetic",
        language: "vi",
        createdAt: "synthetic",
        updatedAt: "synthetic",
        favoriteMenuItemIds: [incoming.catalog.items[0].id],
      });
      release();
      await held;
      await pending;
      assert.equal(published, true);
      assert.equal(
        (
          await repositories.menuRepository.getMenuItemById(
            incoming.catalog.items[0].id,
          )
        ).price,
        incoming.catalog.items[0].price,
      );
      assert.deepEqual(
        (await repositories.userRepository.getUserPreferences("synthetic"))
          .favoriteMenuItemIds,
        [incoming.catalog.items[0].id],
      );
      const backup = fs
        .readdirSync(process.env.LOCAL_DATA_DIR)
        .find((name) => name.startsWith("store.before"));
      assert.ok(backup);
      assert.equal(
        JSON.parse(fs.readFileSync(storeFile)).userRepository.userPreferences
          .length,
        1,
      );
    },
  );
  await check(
    "Truncated pages, missing categories and older captures leave the serving catalog intact",
    async () => {
      const before = fs.readFileSync(storeFile);
      const partial = structuredClone(incoming);
      partial.catalog.items = partial.catalog.items.slice(0, 2);
      await assert.rejects(
        applyLocalCatalog(catalogRecords(partial)),
        /CATALOG_INCOMPLETE/,
      );
      const missingCategory = structuredClone(incoming);
      const removedCategory = missingCategory.catalog.categories.pop().id;
      missingCategory.catalog.items = missingCategory.catalog.items.filter(
        (item) => item.categoryId !== removedCategory,
      );
      await assert.rejects(
        applyLocalCatalog(catalogRecords(missingCategory)),
        /CATALOG_INCOMPLETE/,
      );
      const older = structuredClone(fixture);
      await assert.rejects(applyLocalCatalog(catalogRecords(older)), /older/);
      assert.ok(before.equals(fs.readFileSync(storeFile)));
    },
  );
  await check(
    "Disk publication failure preserves the in-memory and durable catalog",
    async () => {
      const before = fs.readFileSync(storeFile);
      const price = incoming.catalog.items[0].price;
      const newer = structuredClone(incoming);
      newer.source.fetchedAt = "2026-11-18T00:00:00Z";
      newer.source.rawSha256 = "c".repeat(64);
      newer.catalog.items[0].price += 1000;
      const rename = fs.renameSync;
      fs.renameSync = () => {
        throw new Error("synthetic publish failure");
      };
      try {
        await assert.rejects(
          applyLocalCatalog(catalogRecords(newer)),
          /synthetic publish failure/,
        );
      } finally {
        fs.renameSync = rename;
      }
      assert.ok(before.equals(fs.readFileSync(storeFile)));
      assert.equal(
        (
          await repositories.menuRepository.getMenuItemById(
            incoming.catalog.items[0].id,
          )
        ).price,
        price,
      );
    },
  );
  await check(
    "Fetch uses scoped cached HTML and the existing parser with no live provider request",
    async () => {
      process.env.TINYFISH_API_KEY = "synthetic-key-only";
      const html =
        '<h1 id="synthetic">Nhóm thử</h1><div class="item-card"><div class="title">Món thử</div><div class="price"><span>39.000 ₫</span><s>49.000 ₫</s></div><img src="https://static.kfcvietnam.com.vn/images/items/lg/test.jpg"><div class="content">Mô tả thử</div></div>';
      const capture = await fetchCatalog(async (url, options) => {
        assert.equal(url, "https://api.fetch.tinyfish.ai");
        const body = JSON.parse(options.body);
        assert.equal(body.ttl, 3600);
        assert.deepEqual(body.include_selectors, ["app-product"]);
        assert.deepEqual(body.urls, ["https://kfcvietnam.com.vn/menu"]);
        return new Response(
          JSON.stringify({
            results: [
              { url: body.urls[0], final_url: body.urls[0], text: html },
            ],
          }),
        );
      });
      assert.equal(capture.catalog.items[0].price, 39000);
      assert.equal(capture.catalog.items.length, 1);
    },
  );
  console.log(
    `${count} catalog refresh regressions passed. No network or paid calls.`,
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
