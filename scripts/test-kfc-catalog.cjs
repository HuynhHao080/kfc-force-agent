/* eslint-disable @typescript-eslint/no-require-imports -- Offline regressions for external catalog initialization. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
require("./register-typescript.cjs");
const {
  catalogRecords,
  kfcCatalogSchema,
} = require("../src/lib/catalog/kfc-catalog.ts");
const { isKfcImage, menuImage } = require("../src/lib/menu-images.ts");
const {
  createMemoryRepositories,
  mockRepositories,
} = require("../src/lib/db/repositories/implementations/mock-repository.ts");
const { plan, parseArgs, catalogFromRun } = require("./sync-kfc-menu.cjs");
const { adminMenuSchema } = require("../src/lib/validation/admin.ts");
const root = path.resolve(__dirname, "..");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "kfc-catalog-test-"));
const fixture = {
  version: 1,
  source: {
    provider: "tinyfish",
    url: "https://kfcvietnam.com.vn/menu",
    fetchedAt: "2026-11-15T00:00:00Z",
    runId: "synthetic-offline",
    rawSha256: "a".repeat(64),
  },
  catalog: {
    categories: [
      { id: "kfc_test_category", name: "Nhóm thử", displayOrder: 1 },
    ],
    items: [
      {
        id: "kfc_test_item",
        categoryId: "kfc_test_category",
        name: "Món thử hồi quy",
        description: "",
        price: 47000,
        imageUrl:
          "https://kfcvn-static.cognizantorderserv.com/images/synthetic.png",
        sourceUrl: "https://kfcvietnam.com.vn/menu",
        isAvailable: true,
      },
    ],
    exclusions: [],
  },
};
let count = 0;
async function check(name, operation) {
  await operation();
  console.log("PASS " + ++count + ": " + name);
}
function child(data, catalogFile, operation) {
  return spawnSync(
    process.execPath,
    [
      "-e",
      `require('./scripts/register-typescript.cjs'); const assert=require('node:assert/strict'); const r=require('./src/lib/db/repositories/implementations/local-repository.ts').localRepositories(); (async()=>{${operation}})().catch(e=>{console.error(e.message);process.exitCode=1;});`,
    ],
    {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
      env: {
        ...process.env,
        AI_PROVIDER: "mock",
        PERSISTENCE_DRIVER: "local",
        LOCAL_DATA_DIR: data,
        KFC_CATALOG_FILE: catalogFile,
      },
    },
  );
}
async function main() {
  await check(
    "Official PNG URLs are preserved and unsafe hosts, credentials, ports and schemes are rejected",
    () => {
      const url = fixture.catalog.items[0].imageUrl;
      assert.equal(menuImage(url), url);
      assert.equal(menuImage("/images/pepsi.png"), "/images/pepsi.svg");
      for (const value of [
        "http://kfcvietnam.com.vn/a.png",
        "https://kfcvietnam.com.vn.evil.test/a.png",
        "https://user@kfcvietnam.com.vn/a.png",
        "https://kfcvietnam.com.vn:444/a.png",
        "https://kfcvietnam.com.vn/a.svg",
        "javascript:alert(1)",
      ])
        assert.equal(isKfcImage(value), false);
    },
  );
  await check(
    "Catalog schema rejects duplicate IDs, orphan categories, invalid prices and unrelated sources",
    () => {
      const invalid = [
        (data) => data.catalog.items.push(data.catalog.items[0]),
        (data) => {
          data.catalog.items[0].categoryId = "missing";
        },
        (data) => {
          data.catalog.items[0].price = -1;
        },
        (data) => {
          data.source.url = "https://unrelated.example/menu";
        },
        (data) => {
          data.catalog.items[0].credentials = "forbidden";
        },
      ];
      for (const mutate of invalid) {
        const data = structuredClone(fixture);
        mutate(data);
        assert.equal(kfcCatalogSchema.safeParse(data).success, false);
      }
    },
  );
  await check(
    "Imported records preserve provenance and repositories are isolated from seeded test fixtures",
    async () => {
      const r = createMemoryRepositories(catalogRecords(fixture));
      assert.equal((await r.menuRepository.getMenuItems()).length, 1);
      assert.equal(
        await r.menuRepository.getMenuItemById("item_pepsi_004"),
        null,
      );
      assert.equal((await r.menuRepository.getProductBundles()).length, 0);
      assert.equal(
        (await r.menuRepository.getMenuItems())[0].metadata.source.provider,
        "tinyfish",
      );
      assert.ok(
        await mockRepositories.menuRepository.getMenuItemById("item_pepsi_004"),
      );
      assert.notEqual(r.cartRepository, mockRepositories.cartRepository);
    },
  );
  const file = path.join(temporary, "catalog.json");
  const data = path.join(temporary, "data");
  fs.writeFileSync(file, JSON.stringify(fixture));
  await check(
    "Fresh local initialization persists only imported catalog and server-authoritative cart prices",
    () => {
      const result = child(
        data,
        file,
        "const rows=await r.menuRepository.getMenuItems(); assert.equal(rows.length,1); assert.equal(rows[0].price,47000); const {MenuService}=require('./src/lib/services/menu-service.ts'); const {CartService}=require('./src/lib/services/cart-service.ts'); const cart=new CartService(r.cartRepository,new MenuService(r.menuRepository)); await cart.addMenuItem('guest_catalog_test',rows[0],2);",
      );
      assert.equal(result.status, 0, result.stderr);
      assert.ok(fs.existsSync(path.join(data, "store.json")));
      const snapshot = JSON.parse(
        fs.readFileSync(path.join(data, "store.json")),
      );
      assert.equal(snapshot.menuRepository.items.length, 1);
    },
  );
  await check(
    "Restart uses the accepted snapshot even when the external catalog file becomes unavailable",
    () => {
      const missing = path.join(temporary, "missing.json");
      const result = child(
        data,
        missing,
        "assert.equal((await r.menuRepository.getMenuItems()).length,1); assert.equal((await r.cartRepository.getActiveCart('guest_catalog_test')).total,94000);",
      );
      assert.equal(result.status, 0, result.stderr);
    },
  );
  await check(
    "Invalid configured catalog fails before creating a new store",
    () => {
      const invalidFile = path.join(temporary, "invalid.json");
      fs.writeFileSync(invalidFile, "{}");
      const destination = path.join(temporary, "invalid-data");
      assert.notEqual(child(destination, invalidFile, "").status, 0);
      assert.equal(fs.existsSync(path.join(destination, "store.json")), false);
    },
  );
  await check(
    "TinyFish request uses supported schema keywords and explicit commands without beta-only settings",
    () => {
      const request = plan();
      assert.equal(request.url, "https://kfcvietnam.com.vn/menu");
      assert.equal(request.agent_config, undefined);
      const schema = JSON.stringify(request.output_schema);
      for (const key of [
        "$schema",
        "additionalProperties",
        "maxLength",
        "pattern",
      ])
        assert.ok(!schema.includes('"' + key + '"'));
      assert.equal(parseArgs([]).action, "plan");
      assert.throws(() => parseArgs(["--start"]));
      assert.throws(() => parseArgs(["--collect", "--job", "../escape"]));
      assert.throws(() =>
        catalogFromRun({ status: "FAILED" }, Buffer.from("test")),
      );
      assert.equal(
        catalogFromRun(
          {
            status: "COMPLETED",
            run_id: "synthetic",
            finished_at: fixture.source.fetchedAt,
            result: fixture.catalog,
          },
          Buffer.from("test"),
        ).catalog.items.length,
        1,
      );
    },
  );
  await check(
    "Admin editing accepts official raster images and rejects external tracking URLs",
    () => {
      const item = fixture.catalog.items[0];
      const input = {
        name: item.name,
        description: "",
        categoryId: item.categoryId,
        price: item.price,
        isActive: true,
        isAvailable: true,
        imageUrl: item.imageUrl,
      };
      assert.equal(adminMenuSchema.safeParse(input).success, true);
      assert.equal(
        adminMenuSchema.safeParse({
          ...input,
          imageUrl: "https://example.com/tracking.png",
        }).success,
        false,
      );
    },
  );
  await check(
    "Fresh purchase assistant uses the bundled real catalog without synthetic seed items",
    () => {
      const destination = path.join(temporary, "bundled-data");
      const result = spawnSync(
        process.execPath,
        [
          "-e",
          "require('./scripts/register-typescript.cjs');const assert=require('node:assert/strict');const r=require('./src/lib/db/repositories/implementations/local-repository.ts').localRepositories();(async()=>{const rows=await r.menuRepository.getMenuItems();assert.equal(rows.length,require('./src/lib/catalog/kfc-menu.snapshot.json').catalog.items.length);assert.ok(rows.every(item=>item.metadata.source.provider==='tinyfish'));assert.equal(await r.menuRepository.getMenuItemById('item_pepsi_004'),null);})().catch(e=>{console.error(e.message);process.exitCode=1;});",
        ],
        {
          cwd: root,
          encoding: "utf8",
          windowsHide: true,
          env: {
            ...process.env,
            LOCAL_DATA_DIR: destination,
            KFC_CATALOG_FILE: "",
            KFC_PURCHASE_ASSISTANT: "1",
          },
        },
      );
      assert.equal(result.status, 0, result.stderr);
    },
  );
  await check(
    "Scoped TinyFish parser keeps current discounted price and its own product image",
    () => {
      const file = path.join(temporary, "fetch-fixture.json");
      fs.writeFileSync(
        file,
        JSON.stringify({
          results: [
            {
              url: "https://kfcvietnam.com.vn/menu",
              final_url: "https://kfcvietnam.com.vn/menu/hot-deal",
              text: '<h1 id="20">Nhóm thử</h1><div class="item-card"><div class="title">Món thử</div><div class="price"><span>49.000₫</span><span class="strike-price">59.000₫</span></div><img src="https://static.kfcvietnam.com.vn/images/items/lg/synthetic.jpg"/><div class="content">Mô tả thử</div><a aria-disabled="false">Thêm</a></div>',
            },
          ],
          errors: [],
        }),
      );
      const result = spawnSync("python", ["scripts/parse-kfc-menu.py", file], {
        cwd: root,
        encoding: "utf8",
        windowsHide: true,
      });
      assert.equal(result.status, 0, result.stderr);
      const parsed = JSON.parse(result.stdout);
      assert.equal(parsed.items[0].price, 49000);
      assert.equal(
        parsed.items[0].imageUrl,
        "https://static.kfcvietnam.com.vn/images/items/lg/synthetic.jpg",
      );
      assert.equal(parsed.items[0].categoryId, parsed.categories[0].id);
    },
  );
  await check(
    "Exact product names win over combo descriptions while broad Pepsi remains ambiguous",
    async () => {
      const { MenuService } = require("../src/lib/services/menu-service.ts");
      const { CartService } = require("../src/lib/services/cart-service.ts");
      const { PolicyEngine } = require("../src/lib/policy/policy-engine.ts");
      const catalog = require("../src/lib/catalog/kfc-menu.snapshot.json");
      const r = createMemoryRepositories(catalogRecords(catalog));
      const menu = new MenuService(r.menuRepository);
      const policy = new PolicyEngine(
        new CartService(r.cartRepository, menu),
        menu,
      );
      const exact = await policy.findMenuMatches("Pepsi (Lon)");
      assert.equal(exact.length, 1);
      assert.equal(exact[0].name, "Pepsi (Lon)");
      assert.ok((await policy.findMenuMatches("Pepsi")).length > 1);
      assert.equal((await policy.findMenuMatches("1 mieng ga ran")).length, 1);
    },
  );
  console.log(
    count + " external catalog checks passed. Offline synthetic fixtures only.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
