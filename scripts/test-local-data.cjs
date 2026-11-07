/* eslint-disable @typescript-eslint/no-require-imports -- Offline CLI and recovery integration tests. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const base = fs.mkdtempSync(path.join(os.tmpdir(), "kfc-data-"));
const source = path.join(base, "source");
const archive = path.join(base, "private.kfcbackup");
const restored = path.join(base, "restored");
const password = crypto.randomBytes(24).toString("base64url");
const loginPassword = "Synthetic-Local-Recovery-123";
const env = {
  ...process.env,
  AI_PROVIDER: "mock",
  PERSISTENCE_DRIVER: "local",
  LOCAL_DATA_DIR: source,
  SESSION_SECRET: "",
  ADMIN_PASSWORD: "",
};
process.env.LOCAL_DATA_DIR = source;
process.env.PERSISTENCE_DRIVER = "local";
process.env.AI_PROVIDER = "mock";
process.env.SESSION_SECRET = "";
const operations = require("./local-data.cjs");
require("./register-typescript.cjs");
let checks = 0;
async function check(label, action) {
  await action();
  console.log("PASS " + ++checks + ": " + label);
}
function cli(args, input = password) {
  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, "local-data.cjs"), ...args, "--password-stdin"],
    {
      cwd: root,
      env,
      input: input + "\n",
      encoding: "utf8",
      windowsHide: true,
    },
  );
  if (result.error) throw result.error;
  return result;
}
async function main() {
  const {
    localRepositories,
  } = require("../src/lib/db/repositories/implementations/local-repository.ts");
  const { AccountService } = require("../src/lib/services/account-service.ts");
  const { AddressService } = require("../src/lib/services/address-service.ts");
  const {
    PromotionService,
  } = require("../src/lib/services/promotion-service.ts");
  const { MenuService } = require("../src/lib/services/menu-service.ts");
  const { CartService } = require("../src/lib/services/cart-service.ts");
  const {
    CheckoutService,
  } = require("../src/lib/services/checkout-service.ts");
  const { AdminService } = require("../src/lib/services/admin-service.ts");
  const { deriveSync, CURRENT_KDF } = require("../src/lib/password-crypto.cjs");
  const repositories = localRepositories();
  const accounts = new AccountService(repositories.accountRepository);
  const menu = new MenuService(repositories.menuRepository);
  const carts = new CartService(repositories.cartRepository, menu);
  const checkout = new CheckoutService(
    repositories.orderRepository,
    carts,
    menu,
  );
  const admin = new AdminService(
    repositories.orderRepository,
    repositories.menuRepository,
  );
  const account = await accounts.register({
    email: "recovery@example.test",
    fullName: "Recovery Demo",
    password: loginPassword,
  });
  const promotions = new PromotionService(repositories.menuRepository);
  await promotions.save({
    code: "RECOVERY20",
    title: "Recovery Promo",
    discountType: "percent",
    value: 20,
    minimumSubtotal: 0,
    maxDiscount: 5000,
    startsAt: "2020-01-01T00:00:00.000Z",
    endsAt: "2099-01-01T00:00:00.000Z",
    isActive: true,
  });
  const { ShopService } = require("../src/lib/services/shop-service.ts");
  const { defaultShopSettings } = require("../src/lib/shop-settings.ts");
  const shopFields = defaultShopSettings(); delete shopFields.updatedAt;
  await new ShopService(repositories.menuRepository).save({ ...shopFields, address: "789 Recovery shop", deliveryFee: 22000 });
  const legacy = JSON.parse(
    fs.readFileSync(path.join(source, "store.json"), "utf8"),
  );
  delete legacy.menuRepository.promotions;
  delete legacy.menuRepository.shopSettings;
  operations.validateSnapshot(Buffer.from(JSON.stringify(legacy)));
  const item = (await menu.getAvailableMenuItems())[0];
  await check("atomic cart writes roll back memory and disk on creation, edits, clearing and repricing faults", async () => {
    const owner = "synthetic-cart-atomic-" + crypto.randomUUID(), target = path.join(source, "store.json.tmp");
    const beforeFirst = fs.readFileSync(path.join(source, "store.json"));
    fs.mkdirSync(target);
    try { await assert.rejects(() => carts.addMenuItem(owner, item, 1)); } finally { fs.rmdirSync(target); }
    assert.equal(await repositories.cartRepository.getActiveCart(owner), null);
    assert.ok(beforeFirst.equals(fs.readFileSync(path.join(source, "store.json"))));
    const basket = await carts.addMenuItem(owner, item, 1), other = (await menu.getAvailableMenuItems()).find(entry => entry.id !== item.id);
    const cases = [() => carts.addMenuItem(owner, item, 1), () => carts.addMenuItem(owner, other, 1),
      () => carts.updateItemQuantity(owner, basket.items[0].id, 3), () => carts.removeItem(owner, basket.items[0].id), () => carts.clearCart(owner)];
    for (const action of cases) {
      const disk = fs.readFileSync(path.join(source, "store.json")), cart = structuredClone(await repositories.cartRepository.getCartById(basket.cart.id)), lines = structuredClone(await carts.getCartItems(basket.cart.id));
      fs.mkdirSync(target); try { await assert.rejects(action); } finally { fs.rmdirSync(target); }
      assert.ok(disk.equals(fs.readFileSync(path.join(source, "store.json"))));
      assert.deepEqual(await repositories.cartRepository.getCartById(basket.cart.id), cart); assert.deepEqual(await carts.getCartItems(basket.cart.id), lines);
    }
    await repositories.menuRepository.saveMenuItem({ ...item, price: item.price + 1000 });
    const disk = fs.readFileSync(path.join(source, "store.json")), lines = structuredClone(await carts.getCartItems(basket.cart.id));
    fs.mkdirSync(target); try { await assert.rejects(() => carts.getCartView(owner)); } finally { fs.rmdirSync(target); }
    assert.ok(disk.equals(fs.readFileSync(path.join(source, "store.json")))); assert.deepEqual(await carts.getCartItems(basket.cart.id), lines);
    const repriced = await carts.getCartView(owner); assert.equal(repriced.items[0].unitPrice, item.price + 1000); assert.equal(repriced.cart.total, item.price + 1000);
    await carts.clearCart(owner); await repositories.menuRepository.saveMenuItem(item);
    const report = path.resolve("output/verification/cart-atomic-after.json"); fs.mkdirSync(path.dirname(report), { recursive: true });
    fs.writeFileSync(report, JSON.stringify({ scope: "Synthetic local disk faults; no AWS or preview data", rollbackCases: 7, memoryAndDiskUnchanged: true, recoveryCommitSucceeded: true,
      sourceSha256: crypto.createHash("sha256").update(fs.readFileSync(path.join(root, "src/lib/services/cart-service.ts"))).digest("hex") }, null, 2) + "\n");
  });
  const addresses = new AddressService(repositories.userRepository);
  await addresses.save(
    account.id,
    {
      label: "Nhà recovery",
      recipientName: "Recovery Demo",
      phone: "0901234567",
      addressLine: "12 Đường Demo, phường kiểm thử",
      isDefault: true,
    },
    (await addresses.book(account.id)).revision,
  );
  const secret = crypto.randomBytes(48).toString("hex");
  fs.writeFileSync(path.join(source, "session-secret"), secret, {
    mode: 0o600,
  });
  let basket = await carts.addMenuItem(account.id, item, 1);
  const recoveryOrder = await checkout.checkout(account.id, {
    cartId: basket.cart.id,
    cartSignature: basket.signature,
    customerName: "Recovery Demo",
    phone: "0901234567",
    fulfillment: "pickup",
    address: "",
    note: "Synthetic recovery",
    expectedTotal: item.price,
    idempotencyKey: crypto.randomUUID(),
    confirm: true,
  });
  await admin.transition(recoveryOrder.id, "CONFIRMED", "PREPARING");
  await admin.transition(recoveryOrder.id, "PREPARING", "READY");
  await admin.transition(recoveryOrder.id, "READY", "COMPLETED");
  const { FeedbackService } = require("../src/lib/services/feedback-service.ts");
  const recoveryFeedback = new FeedbackService(repositories.orderRepository);
  const reviewed = await recoveryFeedback.save(account.id, { orderId: recoveryOrder.id, rating: 4, comment: "Recovery review" });
  await recoveryFeedback.reply({ orderId: recoveryOrder.id, revision: reviewed.revision, message: "Recovery reply" });
  const { ReorderService } = require("../src/lib/services/reorder-service.ts");
  const reorder = new ReorderService(
    repositories.orderRepository,
    repositories.cartRepository,
    carts,
    menu,
  );
  const reorderPlan = await reorder.preview(account.id, recoveryOrder.id);
  const beforeReorder = fs.readFileSync(path.join(source, "store.json"));
  const blockedWrite = path.join(source, "store.json.tmp");
  fs.mkdirSync(blockedWrite);
  await assert.rejects(() =>
    reorder.confirm(account.id, reorderPlan.confirmationToken),
  );
  assert.equal(await carts.getCartView(account.id), null);
  assert.ok(
    beforeReorder.equals(fs.readFileSync(path.join(source, "store.json"))),
  );
  fs.rmdirSync(blockedWrite); // Empty directory created by this synthetic test only.
  await reorder.confirm(account.id, reorderPlan.confirmationToken);
  basket = await carts.addMenuItem(account.id, item, 1);
  await accounts.createSession(
    "synthetic-session",
    account.id,
    Date.now() + 600000,
  );
  await admin.saveCategory({
    name: "Nhóm recovery",
    description: "",
    displayOrder: 0,
    isActive: true,
  });
  const salt = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(
    path.join(source, "admin-credentials.json"),
    JSON.stringify({
      salt,
      hash: deriveSync("Synthetic-Admin-123", salt).toString("hex"),
      kdf: CURRENT_KDF,
    }),
    { mode: 0o600 },
  );
  fs.writeFileSync(path.join(source, "admin-bootstrap.txt"), "NOT_FOR_BACKUP");
  fs.writeFileSync(path.join(source, "store.json.tmp"), "NOT_FOR_BACKUP");
  await check(
    "backup encrypts only canonical files and never copies bootstrap or temp data",
    () => {
      const result = cli(["backup", "--from", source, "--out", archive]);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(JSON.parse(result.stdout.trim()).encrypted, true);
      const bytes = fs.readFileSync(archive);
      assert.ok(!bytes.includes(Buffer.from(loginPassword)));
      assert.ok(!bytes.includes(Buffer.from(secret)));
      assert.ok(!bytes.includes(Buffer.from("NOT_FOR_BACKUP")));
      const { files } = operations.decrypt(bytes, password);
      assert.deepEqual(files.map((entry) => entry.name).sort(), [
        "admin-credentials.json",
        "session-secret",
        "store.json",
      ]);
    },
  );
  await check(
    "verify accepts the correct password and rejects wrong passwords or modified ciphertext",
    () => {
      assert.equal(cli(["verify", "--file", archive]).status, 0);
      assert.equal(
        cli(["verify", "--file", archive], "Wrong-Password-123").status,
        1,
      );
      const envelope = JSON.parse(fs.readFileSync(archive, "utf8"));
      const bytes = Buffer.from(envelope.ciphertext, "base64");
      bytes[0] ^= 1;
      envelope.ciphertext = bytes.toString("base64");
      const tampered = path.join(base, "tampered.kfcbackup");
      fs.writeFileSync(tampered, JSON.stringify(envelope));
      assert.equal(cli(["verify", "--file", tampered]).status, 1);
      const target = path.join(base, "bad-password-target");
      assert.equal(
        cli(
          ["restore", "--file", archive, "--to", target],
          "Wrong-Password-123",
        ).status,
        1,
      );
      assert.equal(fs.existsSync(target), false);
    },
  );
  await check(
    "restore publishes a new directory with byte-identical canonical files",
    () => {
      const result = cli(["restore", "--file", archive, "--to", restored]);
      assert.equal(result.status, 0, result.stderr);
      for (const name of [
        "store.json",
        "session-secret",
        "admin-credentials.json",
      ])
        assert.deepEqual(
          fs.readFileSync(path.join(restored, name)),
          fs.readFileSync(path.join(source, name)),
        );
      assert.equal(
        fs.existsSync(path.join(restored, "admin-bootstrap.txt")),
        false,
      );
    },
  );
  await check(
    "restore refuses existing destinations and mismatched environment signing secrets",
    () => {
      const before = fs.readFileSync(path.join(restored, "store.json"));
      assert.equal(
        cli(["restore", "--file", archive, "--to", restored]).status,
        1,
      );
      assert.deepEqual(
        fs.readFileSync(path.join(restored, "store.json")),
        before,
      );
      assert.throws(
        () =>
          operations.restore(archive, path.join(base, "wrong-env"), password, {
            SESSION_SECRET: "x".repeat(48),
          }),
        /override differs/,
      );
      assert.equal(fs.existsSync(path.join(base, "wrong-env")), false);
    },
  );
  await check(
    "authenticated backup manifests reject traversal and unexpected filenames",
    () => {
      const payload = operations.decrypt(
        fs.readFileSync(archive),
        password,
      ).payload;
      payload.files[0].name = "../escape";
      const forged = path.join(base, "unsafe.kfcbackup");
      fs.writeFileSync(forged, operations.encrypt(payload, password));
      const target = path.join(base, "unsafe-target");
      assert.equal(
        cli(["restore", "--file", forged, "--to", target]).status,
        1,
      );
      assert.equal(fs.existsSync(target), false);
      assert.equal(fs.existsSync(path.join(base, "escape")), false);
    },
  );
  await check(
    "the real services recover login, session, cart, order, addresses and catalog audit in a fresh process",
    () => {
      const code = [
        'require("./scripts/register-typescript.cjs");',
        "(async () => {",
        'const { services } = require("./src/lib/agent/agent-core.ts");',
        'const password = require("node:fs").readFileSync(0, "utf8");',
        'const account = await services.accountService.login("recovery@example.test", password);',
        "const cart = await services.cartService.getCartView(account.id);",
        "const orders = await services.orderService.getUserOrders(account.id);",
        "const feedback = await services.feedbackService.view(account.id, orders[0].id);",
        "const history = await services.adminService.catalogHistory();",
        'const session = await services.accountService.getSession("synthetic-session");',
        "const addresses = await services.addressService.book(account.id);",
        "const promotions = await services.promotionService.list();",
        "const shop = await services.shopService.view();",
        "const reorder = await services.reorderService.confirm(account.id, " +
          JSON.stringify(reorderPlan.confirmationToken) +
          ");",
        "console.log(JSON.stringify({ login: !!account.id, quantity: cart.items[0].quantity, orders: orders.length, audit: history.length, feedback: feedback.feedback.rating === 4 && feedback.feedback.reply.message === 'Recovery reply', shop: shop.settings.address === '789 Recovery shop' && shop.settings.deliveryFee === 22000, promotions: promotions.length, replayed: reorder.replayed && reorder.cart.id === cart.cart.id, addresses: addresses.addresses.length, session: session.accountId === account.id }));",
        "})().catch(() => process.exitCode = 1);",
      ].join("\n");
      const result = spawnSync(process.execPath, ["-e", code], {
        cwd: root,
        env: { ...env, LOCAL_DATA_DIR: restored },
        input: loginPassword,
        encoding: "utf8",
        windowsHide: true,
      });
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(JSON.parse(result.stdout.trim()), {
        login: true,
        quantity: 2,
        orders: 1,
        audit: 1,
        addresses: 1,
        promotions: 1,
        shop: true,
        feedback: true,
        replayed: true,
        session: true,
      });
    },
  );
  await check(
    "a source that changes during collection aborts before creating a backup",
    () => {
      const original = fs.readFileSync;
      let reads = 0;
      const target = path.join(base, "unstable.kfcbackup");
      try {
        fs.readFileSync = function (file, ...args) {
          const result = original.call(this, file, ...args);
          if (
            path.resolve(String(file)) === path.join(source, "store.json") &&
            ++reads > 1
          )
            return Buffer.concat([result, Buffer.from(" ")]);
          return result;
        };
        assert.throws(
          () => operations.backup(source, target, password, {}),
          /Source changed/,
        );
      } finally {
        fs.readFileSync = original;
      }
      assert.equal(fs.existsSync(target), false);
    },
  );
  await check(
    "invalid snapshots fail closed and an effective environment signing key is captured encrypted",
    () => {
      assert.throws(
        () =>
          operations.validateSnapshot(
            Buffer.from('{"menuRepository":{},"accountRepository":{}}'),
          ),
        /Invalid local snapshot/,
      );
      const target = path.join(base, "env-secret.kfcbackup");
      const effective = crypto.randomBytes(48).toString("hex");
      operations.backup(source, target, password, {
        SESSION_SECRET: effective,
      });
      const files = operations.decrypt(fs.readFileSync(target), password).files;
      assert.equal(
        files
          .find((entry) => entry.name === "session-secret")
          .data.toString("utf8"),
        effective,
      );
      assert.notEqual(effective, secret);
      const badSource = path.join(base, "malformed");
      fs.mkdirSync(badSource);
      fs.writeFileSync(
        path.join(badSource, "store.json"),
        "PRIVATE_PARSE_SENTINEL not json",
      );
      const rejected = cli([
        "backup",
        "--from",
        badSource,
        "--out",
        path.join(base, "bad-source.kfcbackup"),
      ]);
      assert.equal(rejected.status, 1);
      assert.ok(!rejected.stderr.includes("PRIVATE_PARSE_SENTINEL"));
      assert.equal(
        cli(["backup", "--from", source, "--out", archive]).status,
        1,
      );
    },
  );
  console.log(
    checks +
      " local backup/recovery checks passed. Synthetic data only. No AWS calls.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
