/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node HTTP integration test. */
const { spawn } = require("node:child_process");
const path = require("node:path");
const { mkdtempSync } = require("node:fs");
const { tmpdir } = require("node:os");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const dataDirectory = mkdtempSync(path.join(tmpdir(), "kfc-smoke-"));
const base = "http://localhost:3197";
const adminPassword = `Test-${crypto.randomUUID()}`;
let server;
let output = "";
let checks = 0;
async function check(label, run) {
  await run();
  console.log(`PASS ${++checks}: ${label}`);
}
async function start() {
  output = "";
  server = spawn(
    process.execPath,
    [path.resolve("node_modules/next/dist/bin/next"), "start", "-p", "3197"],
    {
      env: {
        ...process.env,
        AI_PROVIDER: "mock",
        PERSISTENCE_DRIVER: "local",
        LOCAL_DATA_DIR: dataDirectory,
        ADMIN_PASSWORD: adminPassword,
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  server.stdout.on("data", (data) => {
    output += data;
  });
  server.stderr.on("data", (data) => {
    output += data;
  });
  server.on("error", (error) => {
    output += error.message;
  });
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw new Error(output);
    try {
      if (
        (
          await fetch(`${base}/api/health`, {
            signal: AbortSignal.timeout(1000),
          })
        ).ok
      )
        return;
    } catch {
      /* still starting */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Server did not become ready: ${output}`);
}
async function stop() {
  if (!server || server.exitCode !== null || server.signalCode !== null) return;
  const exited = once(server, "exit");
  server.kill();
  await exited;
}
async function guest() {
  const response = await fetch(`${base}/api/session`);
  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie").split(";")[0];
  assert.match(response.headers.get("set-cookie"), /HttpOnly/i);
  return cookie;
}
async function request(cookie, route, method = "GET", body, headers = {}) {
  const response = await fetch(`${base}${route}`, {
    method,
    headers: { Cookie: cookie, "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: response.status,
    data: await response.json(),
    cookie: response.headers.get("set-cookie")?.split(";")[0],
    httpOnly: /httponly/i.test(response.headers.get("set-cookie") ?? ""),
  };
}
async function main() {
  try {
    await start();
    const alice = await guest();
    const bob = await guest();
    let seen;
    const send = async (message, confirm = false) => {
      const result = await request(alice, "/api/chat", "POST", {
        message,
        confirm,
        confirmationId: confirm ? (seen ?? crypto.randomUUID()) : undefined,
        userId: "forged",
      });
      if (result.data.pendingConfirmation)
        seen = result.data.pendingConfirmation.id;
      return result;
    };
    let item;
    let order;
    let input;
    await check(
      "oversized UTF-8 and chunked JSON bodies return 413 before domain processing",
      async () => {
        const unicode = await request(alice, "/api/chat", "POST", {
          message: "ế".repeat(6000),
        });
        assert.equal(unicode.status, 413);
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(
                '{"message":"' + "a".repeat(17000) + '"}',
              ),
            );
            controller.close();
          },
        });
        const response = await fetch(base + "/api/chat", {
          method: "POST",
          headers: { Cookie: alice, "Content-Type": "application/json" },
          body: stream,
          duplex: "half",
        });
        assert.equal(response.status, 413);
        assert.equal((await response.json()).code, "BODY_TOO_LARGE");
        const cart = await request(alice, "/api/cart");
        assert.equal(cart.data.cart, null);
      },
    );
    await check(
      "storefront serves successfully and private APIs require a signed session",
      async () => {
        assert.equal((await fetch(`${base}/chat`)).status, 200);
        assert.equal(
          (await request("", "/api/cart?userId=forged")).status,
          401,
        );
        assert.equal(
          (await request("kfc_guest=forged.invalid", "/api/orders")).status,
          401,
        );
      },
    );
    await check(
      "invalid JSON, invalid message and cross-site mutation are rejected",
      async () => {
        const malformed = await fetch(`${base}/api/chat`, {
          method: "POST",
          headers: { Cookie: alice },
          body: "{",
        });
        assert.equal(malformed.status, 400);
        assert.equal((await send("")).status, 400);
        assert.equal(
          (
            await request(
              alice,
              "/api/cart",
              "POST",
              {},
              { Origin: "https://other.example" },
            )
          ).status,
          403,
        );
      },
    );
    await check(
      "loopback mutations accept their real host and reject other or forwarded origins",
      async () => {
        const target = "http://127.0.0.1:3197";
        const probe = (headers) =>
          fetch(target + "/api/cart", {
            method: "POST",
            headers: {
              Cookie: alice,
              "Content-Type": "application/json",
              ...headers,
            },
            body: JSON.stringify({
              menuItemId: "item_burger_001",
              quantity: 0,
            }),
          });
        assert.equal((await probe({ Origin: target })).status, 400);
        assert.equal((await probe({ Origin: base })).status, 403);
        assert.equal(
          (
            await probe({
              Origin: "https://other.example",
              "X-Forwarded-Host": "other.example",
            })
          ).status,
          403,
        );
        assert.equal(
          (await probe({ Origin: target, "Sec-Fetch-Site": "cross-site" }))
            .status,
          403,
        );
      },
    );
    await check(
      "menu hides unavailable products and chat includes prices",
      async () => {
        const reply = await send("Cho mình xem thực đơn");
        assert.equal(reply.status, 200);
        const items = reply.data.execution.flatMap(
          (entry) => entry.data?.items ?? [],
        );
        assert.ok(items.every((entry) => entry.isActive && entry.isAvailable));
        item =
          items.find((entry) => entry.name.toLowerCase().includes("pepsi")) ??
          items[0];
        assert.ok(reply.data.reply.includes(item.name));
        assert.ok(reply.data.reply.includes("₫"));
      },
    );
    await check(
      "proposal requires confirmation; concurrent confirmations execute it once",
      async () => {
        const proposal = await send(`Thêm 2 ${item.name} vào giỏ hàng`);
        assert.equal(proposal.data.requiresConfirmation, true);
        assert.equal((await request(alice, "/api/cart")).data.items.length, 0);
        const results = await Promise.all([
          send("Xác nhận", true),
          send("Xác nhận", true),
        ]);
        assert.equal(
          results
            .flatMap((result) => result.data.execution)
            .filter((entry) => entry.executed).length,
          1,
        );
        assert.equal(
          (await request(alice, "/api/cart")).data.items[0].quantity,
          2,
        );
      },
    );
    await check(
      "forged identity cannot expose or modify another customer's cart",
      async () => {
        assert.equal(
          (await request(bob, "/api/cart?userId=forged")).data.items.length,
          0,
        );
        const line = (await request(alice, "/api/cart")).data.items[0];
        assert.equal(
          (
            await request(bob, "/api/cart", "PATCH", {
              userId: "forged",
              itemId: line.id,
              quantity: 9,
            })
          ).status,
          400,
        );
      },
    );
    await check(
      "cart mutations invalidate pending actions and enforce merged quantity limits",
      async () => {
        await send(`Thêm 1 ${item.name} vào giỏ hàng`);
        assert.equal(
          (
            await request(alice, "/api/cart", "POST", {
              menuItemId: item.id,
              quantity: 1,
              price: 1,
            })
          ).status,
          201,
        );
        assert.equal((await send("Xác nhận", true)).data.execution.length, 0);
        const tooMany = await request(alice, "/api/cart", "POST", {
          menuItemId: item.id,
          quantity: 100,
        });
        assert.equal(tooMany.status, 400);
        assert.equal(
          (await request(alice, "/api/cart")).data.cart.total,
          item.price * 3,
        );
      },
    );
    const checkoutBasket = (await request(alice, "/api/cart")).data;
    input = {
      cartId: checkoutBasket.cart.id,
      cartSignature: checkoutBasket.signature,
      customerName: "Khách thử nghiệm",
      phone: "0901234567",
      fulfillment: "delivery",
      address: "123 Đường Mẫu, Phường 1, TP Hồ Chí Minh",
      note: "Demo <img src=x onerror=alert(1)>",
      idempotencyKey: crypto.randomUUID(),
      expectedTotal: item.price * 3 + 15000,
      confirm: true,
    };
    await check(
      "checkout rejects bad contact details, missing confirmation and tampered totals",
      async () => {
        for (const changed of [
          { phone: "abc" },
          { confirm: false },
          { address: "" },
          { expectedTotal: 1 },
          { cartSignature: "a".repeat(64) },
        ]) {
          assert.equal(
            (
              await request(alice, "/api/orders", "POST", {
                ...input,
                ...changed,
              })
            ).status,
            400,
          );
        }
      },
    );
    await check("checkout status is private, strict and read-only before any order is committed", async () => {
      const route = "/api/checkout/status", attempt = { idempotencyKey: input.idempotencyKey, cartId: input.cartId };
      assert.equal((await request("", route, "POST", attempt)).status, 401);
      for (const body of [{ ...attempt, extra: true }, { ...attempt, idempotencyKey: "bad-key" }, { cartId: input.cartId }])
        assert.equal((await request(alice, route, "POST", body)).status, 400);
      assert.equal((await fetch(base + route, { headers: { Cookie: alice } })).status, 405);
      assert.equal((await request(alice, route, "POST", attempt, { Origin: "https://other.invalid" })).status, 403);
      const response = await fetch(base + route, { method: "POST", headers: { Cookie: alice, "Content-Type": "application/json" }, body: JSON.stringify(attempt) });
      assert.equal(response.status, 200);
      assert.match(response.headers.get("cache-control"), /no-store/);
      assert.deepEqual(await response.json(), { order: null });
      assert.equal((await request(alice, "/api/orders")).data.orders.length, 0);
    });
    await check(
      "checkout stores priced lines and delivery fee; retry returns the same order",
      async () => {
        const created = await request(alice, "/api/orders", "POST", input);
        assert.equal(created.status, 201);
        order = created.data;
        assert.equal(order.total, item.price * 3 + 15000);
        assert.equal(order.items[0].quantity, 3);
        assert.equal(order.events[0].type, "CONFIRMED");
        assert.equal(
          (await request(alice, "/api/orders", "POST", input)).data.id,
          order.id,
        );
        assert.equal(
          (await request(alice, "/api/orders")).data.orders.length,
          1,
        );
        assert.equal((await request(alice, "/api/cart")).data.items.length, 0);
        assert.equal(
          (
            await request(alice, "/api/orders", "POST", {
              ...input,
              idempotencyKey: crypto.randomUUID(),
            })
          ).status,
          400,
        );
      },
    );
    await check("checkout rejects reuse of a committed request key with different information", async () => {
      for (const changed of [{ phone: "0909999999" }, { note: "Changed after lost response" },
        { expectedTotal: input.expectedTotal + 1 }, { cartSignature: "b".repeat(64) }]) {
        const response = await request(alice, "/api/orders", "POST", { ...input, ...changed });
        assert.equal(response.status, 409);
        assert.equal(response.data.code, "IDEMPOTENCY_CONFLICT");
      }
      assert.equal((await request(alice, "/api/orders", "POST", input)).data.id, order.id);
      assert.equal((await request(alice, "/api/orders")).data.orders.length, 1);
    });
    await check("checkout status recovers the exact committed order and never exposes another owner or cart", async () => {
      const attempt = { idempotencyKey: input.idempotencyKey, cartId: input.cartId };
      const recovered = await request(alice, "/api/checkout/status", "POST", attempt);
      assert.equal(recovered.status, 200);
      assert.deepEqual(recovered.data.order, order);
      assert.equal((await request(bob, "/api/checkout/status", "POST", attempt)).data.order, null);
      assert.equal((await request(alice, "/api/checkout/status", "POST", { ...attempt, cartId: "other-cart" })).data.order, null);
      assert.equal((await request(alice, "/api/orders")).data.orders.length, 1);
      assert.equal((await request(alice, "/api/orders", "GET")).data.orders[0].status, "CONFIRMED");
    });
    await check(
      "receipt shows authoritative order snapshots, escaped notes and private cache headers",
      async () => {
        const response = await fetch(
          base + "/orders/" + order.id + "/receipt",
          { headers: { Cookie: alice } },
        );
        assert.equal(response.status, 200);
        assert.ok(response.headers.get("cache-control").includes("no-store"));
        const html = await response.text();
        assert.ok(html.includes("Phiếu đơn hàng"));
        assert.ok(html.includes(order.items[0].nameSnapshot));
        assert.ok(html.includes("Không phải hoá đơn VAT"));
        assert.ok(html.includes("Demo &lt;img"));
        assert.ok(!/<img[^>]*onerror=/i.test(html));
      },
    );
    await check(
      "receipt denies missing sessions, other customers and nonexistent orders without exposing contacts",
      async () => {
        for (const cookie of ["", bob]) {
          const response = await fetch(
            base + "/orders/" + order.id + "/receipt",
            { headers: { Cookie: cookie } },
          );
          assert.equal(response.status, 404);
          const html = await response.text();
          assert.ok(!html.includes(order.phone));
          assert.ok(!html.includes(order.customerName));
        }
        assert.equal(
          (
            await fetch(base + "/orders/order_unknown/receipt", {
              headers: { Cookie: alice },
            })
          ).status,
          404,
        );
      },
    );
    await check(
      "order ownership protects details and cancellation",
      async () => {
        assert.equal(
          (await request(bob, `/api/orders?orderId=${order.id}`)).status,
          404,
        );
        assert.equal((await request(bob, "/api/orders")).data.orders.length, 0);
        assert.equal(
          (
            await request(bob, "/api/orders", "PATCH", {
              orderId: order.id,
              confirm: true,
            })
          ).status,
          400,
        );
      },
    );
    await check(
      "new cart and its conversation survive a complete server restart",
      async () => {
        await request(alice, "/api/cart", "POST", {
          menuItemId: item.id,
          quantity: 1,
        });
        await send(`Thêm 1 ${item.name} vào giỏ hàng`);
        await stop();
        await start();
        assert.equal(
          (await request(alice, "/api/cart")).data.items[0].quantity,
          1,
        );
        const session = await request(alice, "/api/session");
        assert.ok(session.data.messages.length > 0);
        assert.equal(session.data.requiresConfirmation, true);
        assert.equal(
          (await request(alice, `/api/orders?orderId=${order.id}`)).data.total,
          order.total,
        );
        assert.equal(
          (await send("Xác nhận", true)).data.execution[0].executed,
          true,
        );
      },
    );
    await check(
      "cancellation updates status and persists its event exactly once",
      async () => {
        const first = await request(alice, "/api/orders", "PATCH", {
          orderId: order.id,
          confirm: true,
        });
        assert.equal(first.data.status, "CANCELLED");
        assert.equal(first.data.events.length, 2);
        const again = await request(alice, "/api/orders", "PATCH", {
          orderId: order.id,
          confirm: true,
        });
        assert.equal(again.data.events.length, 2);
      },
    );
    await check(
      "quantity edits through natural chat remain pending until confirmed",
      async () => {
        const proposal = await send("Đổi Pepsi thành 4");
        assert.equal(proposal.data.actions[0].type, "UPDATE_CART");
        assert.ok(
          proposal.data.pendingConfirmation.summary[0].includes("4 phần"),
        );
        const typed = await send("Xác nhận");
        assert.equal(typed.data.execution.length, 0);
        assert.equal(
          typed.data.pendingConfirmation.id,
          proposal.data.pendingConfirmation.id,
        );

        assert.equal(
          (await request(alice, "/api/cart")).data.items[0].quantity,
          2,
        );
        await send("Xác nhận", true);
        assert.equal(
          (await request(alice, "/api/cart")).data.items[0].quantity,
          4,
        );
      },
    );
    await check(
      "stale-tab confirmation and dismissal cannot consume a newer proposal",
      async () => {
        const old = (await send("Thêm 1 Pepsi")).data.pendingConfirmation;
        const current = (await send("Thêm 2 Pepsi")).data.pendingConfirmation;
        const stale = await request(alice, "/api/chat", "POST", {
          message: "Xác nhận",
          confirm: true,
          confirmationId: old.id,
        });
        assert.equal(stale.data.execution.length, 0);
        assert.equal(stale.data.pendingConfirmation.id, current.id);
        assert.equal(
          (await request(alice, `/api/chat?confirmationId=${old.id}`, "DELETE"))
            .status,
          409,
        );
        assert.equal(
          (await request(alice, "/api/session")).data.pendingConfirmation.id,
          current.id,
        );
        assert.equal(
          (
            await request(alice, "/api/chat", "POST", {
              message: "Xác nhận",
              confirm: true,
            })
          ).status,
          400,
        );
        assert.equal(
          (await request(alice, "/api/cart")).data.items[0].quantity,
          4,
        );
        await send("Xác nhận", true);
        assert.equal(
          (await request(alice, "/api/cart")).data.items[0].quantity,
          6,
        );
      },
    );
    await check(
      "correct dismissal clears the proposal and whitespace-only messages are rejected",
      async () => {
        const proposal = (await send("Thêm 1 Pepsi")).data.pendingConfirmation;
        assert.equal(
          (
            await request(
              alice,
              `/api/chat?confirmationId=${proposal.id}`,
              "DELETE",
            )
          ).status,
          200,
        );
        assert.equal(
          (await request(alice, "/api/session")).data.pendingConfirmation,
          null,
        );
        assert.equal((await send("   ")).status, 400);
      },
    );
    let accountCookie,
      secondCookie,
      otherCookie,
      staffCookie,
      accountOrder,
      deliveryOrder;
    const email = `student-${crypto.randomUUID()}@example.test`;
    const password = `Customer-${crypto.randomUUID()}`;
    await check(
      "customer registration stores a private hash and issues a role-specific session",
      async () => {
        const result = await request(alice, "/api/auth/register", "POST", {
          email,
          password,
          fullName: "Sinh viên kiểm thử",
        });
        assert.equal(result.status, 201);
        assert.ok(result.httpOnly);
        accountCookie = result.cookie;
        assert.equal(result.data.profile.email, email);
        assert.equal(result.data.profile.passwordHash, undefined);
        assert.equal(
          (await request(accountCookie, "/api/session")).data.profile.email,
          email,
        );
        assert.equal(
          (await request(accountCookie, "/api/cart")).data.items.length,
          0,
        );
        const duplicate = await request("", "/api/auth/register", "POST", {
          email: email.toUpperCase(),
          password,
          fullName: "Duplicate",
        });
        assert.equal(duplicate.status, 409);
        assert.equal(
          (
            await request("", "/api/auth/register", "POST", {
              email: "short@example.test",
              password: "short",
              fullName: "Test",
            })
          ).status,
          400,
        );
      },
    );
    await check(
      "login validates credentials and works from a second browser without transferring guest data",
      async () => {
        assert.equal(
          (
            await request("", "/api/auth/login", "POST", {
              email,
              password: "incorrect-password",
            })
          ).status,
          401,
        );
        const login = await request(bob, "/api/auth/login", "POST", {
          email,
          password,
        });
        assert.equal(login.status, 200);
        secondCookie = login.cookie;
        assert.equal(
          (await request(secondCookie, "/api/auth/session")).data.profile.email,
          email,
        );
        assert.equal(
          (await request(secondCookie, "/api/cart")).data.items.length,
          0,
        );
        assert.equal(
          (await request(secondCookie, "/api/orders")).data.orders.length,
          0,
        );
      },
    );
    await check(
      "account cart, order and authenticated sessions survive server restart",
      async () => {
        await request(accountCookie, "/api/cart", "POST", {
          menuItemId: item.id,
          quantity: 1,
        });
        const basket = (await request(accountCookie, "/api/cart")).data;
        const created = await request(accountCookie, "/api/orders", "POST", {
          cartId: basket.cart.id,
          cartSignature: basket.signature,
          customerName: "Sinh viên kiểm thử",
          phone: "0901234567",
          fulfillment: "pickup",
          address: "",
          note: "Demo pickup",
          expectedTotal: item.price,
          idempotencyKey: crypto.randomUUID(),
          confirm: true,
        });
        assert.equal(created.status, 201);
        accountOrder = created.data;
        await stop();
        await start();
        assert.equal(
          (await request(accountCookie, "/api/auth/session")).data.profile
            .email,
          email,
        );
        assert.equal(
          (
            await request(
              secondCookie,
              `/api/orders?orderId=${accountOrder.id}`,
            )
          ).data.total,
          item.price,
        );
        assert.equal(
          (await request(alice, `/api/orders?orderId=${accountOrder.id}`))
            .status,
          404,
        );
      },
    );
    await check(
      "another account cannot read orders and logout revokes only its own session",
      async () => {
        const other = await request("", "/api/auth/register", "POST", {
          email: `other-${crypto.randomUUID()}@example.test`,
          password,
          fullName: "Khách thứ hai",
        });
        assert.equal(other.status, 201);
        otherCookie = other.cookie;
        assert.equal(
          (await request(otherCookie, `/api/orders?orderId=${accountOrder.id}`))
            .status,
          404,
        );
        assert.equal(
          (await request(accountCookie, "/api/auth/session", "DELETE")).status,
          200,
        );
        assert.equal(
          (await request(accountCookie, "/api/auth/session")).data.profile,
          null,
        );
        assert.equal((await request(accountCookie, "/api/cart")).status, 401);
        assert.equal(
          (await request(secondCookie, "/api/auth/session")).data.profile.email,
          email,
        );
      },
    );
    await check(
      "guest and customer tokens cannot access staff APIs; admin login is protected",
      async () => {
        for (const cookie of [
          "",
          alice,
          secondCookie,
          "kfc_staff=forged.invalid",
        ]) {
          assert.equal(
            (await request(cookie, "/api/admin/orders")).status,
            401,
          );
          assert.equal(
            (await request(cookie, "/api/admin/menu", "POST", {})).status,
            401,
          );
        }
        assert.equal(
          (
            await request("", "/api/admin/auth", "POST", {
              password: "incorrect-admin",
            })
          ).status,
          401,
        );
        const login = await request("", "/api/admin/auth", "POST", {
          password: adminPassword,
        });
        assert.equal(login.status, 200);
        assert.ok(login.httpOnly);
        staffCookie = login.cookie;
        assert.equal(
          (await request(staffCookie, "/api/admin/auth")).data.authenticated,
          true,
        );
        assert.equal(
          (
            await request(
              staffCookie,
              "/api/admin/menu",
              "POST",
              {},
              { Origin: "https://other.example" },
            )
          ).status,
          403,
        );
      },
    );
    await check(
      "pickup workflow rejects skipped steps and records transitions once",
      async () => {
        const change = (expectedStatus, nextStatus) =>
          request(staffCookie, "/api/admin/orders", "PATCH", {
            orderId: accountOrder.id,
            expectedStatus,
            nextStatus,
          });
        assert.equal((await change("CONFIRMED", "COMPLETED")).status, 409);
        const preparing = await change("CONFIRMED", "PREPARING");
        assert.equal(preparing.status, 200);
        assert.equal(preparing.data.events.at(-1).metadata.actor, "admin");
        assert.equal(
          (
            await request(secondCookie, "/api/orders", "PATCH", {
              orderId: accountOrder.id,
              confirm: true,
            })
          ).status,
          400,
        );
        assert.equal((await change("PREPARING", "DELIVERING")).status, 409);
        assert.equal((await change("PREPARING", "READY")).status, 200);
        const repeat = await change("PREPARING", "READY");
        assert.equal(repeat.status, 200);
        assert.equal(repeat.data.events.length, 3);
        assert.equal((await change("READY", "COMPLETED")).status, 200);
        assert.equal((await change("COMPLETED", "PREPARING")).status, 409);
        const owner = await request(
          secondCookie,
          `/api/orders?orderId=${accountOrder.id}`,
        );
        assert.equal(owner.data.status, "COMPLETED");
        assert.equal(owner.data.events.length, 4);
        assert.equal(owner.data.items[0].unitPrice, item.price);
      },
    );
    await check(
      "delivery workflow and report values reflect persisted demo orders",
      async () => {
        await request(secondCookie, "/api/cart", "POST", {
          menuItemId: item.id,
          quantity: 2,
        });
        const basket = (await request(secondCookie, "/api/cart")).data;
        const created = await request(secondCookie, "/api/orders", "POST", {
          ...input,
          cartId: basket.cart.id,
          cartSignature: basket.signature,
          idempotencyKey: crypto.randomUUID(),
          expectedTotal: item.price * 2 + 15000,
        });
        assert.equal(created.status, 201);
        deliveryOrder = created.data;
        for (const [expectedStatus, nextStatus] of [
          ["CONFIRMED", "PREPARING"],
          ["PREPARING", "DELIVERING"],
          ["DELIVERING", "COMPLETED"],
        ]) {
          assert.equal(
            (
              await request(staffCookie, "/api/admin/orders", "PATCH", {
                orderId: deliveryOrder.id,
                expectedStatus,
                nextStatus,
              })
            ).status,
            200,
          );
        }
        const report = await request(staffCookie, "/api/admin/orders");
        assert.equal(report.data.stats.completedOrders, 2);
        assert.equal(
          report.data.stats.completedValue,
          accountOrder.total + deliveryOrder.total,
        );
        assert.equal(report.data.stats.totalOrders, 3);
        assert.equal(
          report.data.stats.daily.reduce((sum, day) => sum + day.count, 0),
          3,
        );
      },
    );
    await check(
      "customer cancellation and staff preparation racing produce one winning transition",
      async () => {
        await request(secondCookie, "/api/cart", "POST", {
          menuItemId: item.id,
          quantity: 1,
        });
        const basket = (await request(secondCookie, "/api/cart")).data;
        const created = (
          await request(secondCookie, "/api/orders", "POST", {
            ...input,
            fulfillment: "pickup",
            address: "",
            cartId: basket.cart.id,
            cartSignature: basket.signature,
            expectedTotal: item.price,
            idempotencyKey: crypto.randomUUID(),
          })
        ).data;
        const results = await Promise.all([
          request(secondCookie, "/api/orders", "PATCH", {
            orderId: created.id,
            confirm: true,
          }),
          request(staffCookie, "/api/admin/orders", "PATCH", {
            orderId: created.id,
            expectedStatus: "CONFIRMED",
            nextStatus: "PREPARING",
          }),
        ]);
        assert.equal(
          results.filter((result) => result.status === 200).length,
          1,
        );
        const detail = (
          await request(staffCookie, `/api/admin/orders?orderId=${created.id}`)
        ).data;
        assert.equal(detail.events.length, 2);
        assert.ok(["CANCELLED", "PREPARING"].includes(detail.status));
      },
    );
    await check(
      "staff can create/edit/hide menu items while customer prices remain authoritative",
      async () => {
        const catalog = (await request(staffCookie, "/api/admin/menu")).data;
        const fields = {
          name: `Burger thử ${crypto.randomUUID().slice(0, 8)}`,
          description: "Món minh hoạ",
          price: 49000,
          categoryId: catalog.categories.find((category) => category.isActive)
            .id,
          imageUrl: "/images/burger.svg",
          isActive: true,
          isAvailable: true,
        };
        assert.equal(
          (
            await request(staffCookie, "/api/admin/menu", "POST", {
              ...fields,
              price: -1,
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await request(staffCookie, "/api/admin/menu", "POST", {
              ...fields,
              imageUrl: "https://other.example/image.svg",
            })
          ).status,
          400,
        );
        const added = await request(
          staffCookie,
          "/api/admin/menu",
          "POST",
          fields,
        );
        assert.equal(added.status, 201);
        const newItem = added.data.item;
        assert.equal(
          (await request(staffCookie, "/api/admin/menu", "POST", fields))
            .status,
          409,
        );
        await request(otherCookie, "/api/cart", "POST", {
          menuItemId: newItem.id,
          quantity: 1,
          price: 1,
        });
        const oldBasket = (await request(otherCookie, "/api/cart")).data;
        assert.equal(oldBasket.cart.total, 49000);
        assert.equal(
          (
            await request(staffCookie, "/api/admin/menu", "PATCH", {
              ...fields,
              itemId: newItem.id,
              price: 59000,
            })
          ).status,
          200,
        );
        assert.equal(
          (await request(otherCookie, "/api/cart")).data.cart.total,
          59000,
        );
        assert.equal(
          (
            await request(otherCookie, "/api/orders", "POST", {
              ...input,
              cartId: oldBasket.cart.id,
              cartSignature: oldBasket.signature,
              expectedTotal: 49000,
              idempotencyKey: crypto.randomUUID(),
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await request(staffCookie, "/api/admin/menu", "PATCH", {
              ...fields,
              itemId: newItem.id,
              price: 59000,
              isAvailable: false,
            })
          ).status,
          200,
        );
        assert.equal(
          (await fetch(`${base}/api/menu?itemId=${newItem.id}`)).status,
          404,
        );
        assert.equal(
          (
            await request(otherCookie, "/api/cart", "POST", {
              menuItemId: newItem.id,
              quantity: 1,
            })
          ).status,
          404,
        );
        assert.equal(
          (
            await request(
              secondCookie,
              `/api/orders?orderId=${accountOrder.id}`,
            )
          ).data.items[0].unitPrice,
          item.price,
        );
      },
    );
    await check(
      "staff logout revokes its token and login attempts are rate limited",
      async () => {
        assert.equal(
          (await request(staffCookie, "/api/admin/auth", "DELETE")).status,
          200,
        );
        assert.equal(
          (await request(staffCookie, "/api/admin/orders")).status,
          401,
        );
        let limited = false;
        for (let attempt = 0; attempt < 12; attempt++) {
          const result = await request("", "/api/admin/auth", "POST", {
            password: "incorrect-admin",
          });
          if (result.status === 429) {
            limited = true;
            break;
          }
        }
        assert.equal(limited, true);
      },
    );
    let recoveryCookie, parallelCookie;
    const nextPassword = "New-" + crypto.randomUUID();
    await check(
      "account profile is private, validated and updates only the signed-in owner",
      async () => {
        const beforeOther = (await request(otherCookie, "/api/auth/session"))
          .data.profile;
        assert.equal(
          (
            await request(alice, "/api/account/profile", "PATCH", {
              fullName: "Guest",
            })
          ).status,
          401,
        );
        assert.equal(
          (
            await request(staffCookie, "/api/account/profile", "PATCH", {
              fullName: "Staff",
            })
          ).status,
          401,
        );
        assert.equal(
          (
            await request(secondCookie, "/api/account/profile", "PATCH", {
              fullName: "New",
              userId: beforeOther.id,
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await request(secondCookie, "/api/account/profile", "PATCH", {
              fullName: " ",
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await request(
              secondCookie,
              "/api/account/profile",
              "PATCH",
              { fullName: "Test" },
              { Origin: "https://outside.example" },
            )
          ).status,
          403,
        );
        const result = await request(
          secondCookie,
          "/api/account/profile",
          "PATCH",
          { fullName: "  Sinh viên cập nhật  " },
        );
        assert.equal(result.status, 200);
        assert.equal(result.data.profile.fullName, "Sinh viên cập nhật");
        assert.equal(result.data.profile.email, email);
        assert.equal(result.data.profile.passwordHash, undefined);
        assert.deepEqual(
          (await request(otherCookie, "/api/auth/session")).data.profile,
          beforeOther,
        );
      },
    );
    await check(
      "password changes reject wrong current secrets and mismatched confirmation without logging out",
      async () => {
        const change = {
          currentPassword: password,
          newPassword: nextPassword,
          confirmPassword: nextPassword,
        };
        assert.equal(
          (
            await request(secondCookie, "/api/account/password", "POST", {
              ...change,
              confirmPassword: "mismatch",
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await request(secondCookie, "/api/account/password", "POST", {
              ...change,
              currentPassword: "wrong",
            })
          ).data.code,
          "PASSWORD_INCORRECT",
        );
        assert.equal(
          (await request(secondCookie, "/api/auth/session")).data.profile.email,
          email,
        );
        parallelCookie = (
          await request("", "/api/auth/login", "POST", { email, password })
        ).cookie;
        assert.ok(parallelCookie);
        await request(secondCookie, "/api/cart", "POST", {
          menuItemId: item.id,
          quantity: 2,
        });
      },
    );
    await check(
      "password rotation expires all old browsers and the old password cannot log in",
      async () => {
        const result = await request(
          secondCookie,
          "/api/account/password",
          "POST",
          {
            currentPassword: password,
            newPassword: nextPassword,
            confirmPassword: nextPassword,
          },
        );
        assert.equal(result.status, 200);
        assert.equal(result.data.reauthenticate, true);
        assert.equal(result.cookie, "kfc_customer=");
        for (const cookie of [secondCookie, parallelCookie]) {
          assert.equal(
            (await request(cookie, "/api/auth/session")).data.profile,
            null,
          );
          assert.equal((await request(cookie, "/api/cart")).status, 401);
          assert.equal(
            (
              await request(cookie, "/api/account/profile", "PATCH", {
                fullName: "Stale",
              })
            ).status,
            401,
          );
        }
        assert.equal(
          (await request("", "/api/auth/login", "POST", { email, password }))
            .status,
          401,
        );
        const login = await request("", "/api/auth/login", "POST", {
          email,
          password: nextPassword,
        });
        assert.equal(login.status, 200);
        recoveryCookie = login.cookie;
        assert.equal(login.data.profile.fullName, "Sinh viên cập nhật");
      },
    );
    await check(
      "updated credentials, profile, cart and orders survive restart; old sessions stay revoked",
      async () => {
        await stop();
        await start();
        assert.equal(
          (await request(secondCookie, "/api/auth/session")).data.profile,
          null,
        );
        const profile = (await request(recoveryCookie, "/api/auth/session"))
          .data.profile;
        assert.equal(profile.fullName, "Sinh viên cập nhật");
        assert.equal(
          (await request(recoveryCookie, "/api/cart")).data.items[0].quantity,
          2,
        );
        assert.equal(
          (
            await request(
              recoveryCookie,
              "/api/orders?orderId=" + accountOrder.id,
            )
          ).data.id,
          accountOrder.id,
        );
        assert.equal(
          (
            await request("", "/api/auth/login", "POST", {
              email,
              password: nextPassword,
            })
          ).status,
          200,
        );
        for (let index = 0; index < 10; index++) {
          const result = await request(
            recoveryCookie,
            "/api/account/password",
            "POST",
            {
              currentPassword: "wrong",
              newPassword: password,
              confirmPassword: password,
            },
          );
          assert.equal(result.status, 400);
        }
        assert.equal(
          (
            await request(recoveryCookie, "/api/account/password", "POST", {
              currentPassword: nextPassword,
              newPassword: password,
              confirmPassword: password,
            })
          ).status,
          429,
        );
        assert.equal(
          (
            await request(otherCookie, "/api/account/password", "POST", {
              currentPassword: "wrong",
              newPassword: nextPassword,
              confirmPassword: nextPassword,
            })
          ).status,
          400,
        );
      },
    );
    let categoryFixture, categoryFields, categoryMenuItem;
    await check(
      "category APIs enforce staff role, schema/origin and create one category for concurrent duplicates",
      async () => {
        staffCookie = (
          await request("", "/api/admin/auth", "POST", {
            password: adminPassword,
          })
        ).cookie;
        assert.ok(staffCookie);
        assert.equal(
          (await request(alice, "/api/admin/categories")).status,
          401,
        );
        assert.equal(
          (await request(recoveryCookie, "/api/admin/categories", "POST", {}))
            .status,
          401,
        );
        categoryFields = {
          name: "Nhóm mới " + crypto.randomUUID(),
          description: "Danh mục kiểm thử",
          displayOrder: 0,
          isActive: true,
        };
        assert.equal(
          (
            await request(staffCookie, "/api/admin/categories", "POST", {
              ...categoryFields,
              displayOrder: -1,
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await request(
              staffCookie,
              "/api/admin/categories",
              "POST",
              categoryFields,
              { Origin: "https://outside.example" },
            )
          ).status,
          403,
        );
        const results = await Promise.all([
          request(staffCookie, "/api/admin/categories", "POST", categoryFields),
          request(staffCookie, "/api/admin/categories", "POST", categoryFields),
        ]);
        assert.deepEqual(
          results.map((result) => result.status).sort(),
          [201, 409],
        );
        categoryFixture = results.find((result) => result.status === 201).data
          .category;
        assert.equal(
          (await (await fetch(base + "/api/menu")).json()).categories[0].id,
          categoryFixture.id,
        );
      },
    );
    await check(
      "hidden items prevent category disabling until moved; inactive categories reject new items",
      async () => {
        const fields = {
          name: "Món thử danh mục " + crypto.randomUUID(),
          description: "",
          price: 45000,
          categoryId: categoryFixture.id,
          imageUrl: "/images/burger.svg",
          isActive: false,
          isAvailable: false,
        };
        const saved = await request(
          staffCookie,
          "/api/admin/menu",
          "POST",
          fields,
        );
        assert.equal(saved.status, 201);
        categoryMenuItem = saved.data.item;
        const disabled = {
          ...categoryFields,
          categoryId: categoryFixture.id,
          isActive: false,
        };
        const rejected = await request(
          staffCookie,
          "/api/admin/categories",
          "PATCH",
          disabled,
        );
        assert.equal(rejected.status, 409);
        assert.equal(rejected.data.code, "CATEGORY_IN_USE");
        const other = (
          await request(staffCookie, "/api/admin/categories")
        ).data.categories.find(
          (category) => category.id !== categoryFixture.id && category.isActive,
        );
        assert.equal(
          (
            await request(staffCookie, "/api/admin/menu", "PATCH", {
              ...fields,
              itemId: categoryMenuItem.id,
              categoryId: other.id,
            })
          ).status,
          200,
        );
        const changed = await request(
          staffCookie,
          "/api/admin/categories",
          "PATCH",
          {
            ...disabled,
            name: categoryFields.name + " cập nhật",
            displayOrder: 999,
          },
        );
        assert.equal(changed.status, 200);
        assert.equal(
          changed.data.category.createdAt,
          categoryFixture.createdAt,
        );
        assert.equal(
          (
            await request(staffCookie, "/api/admin/menu", "POST", {
              ...fields,
              name: fields.name + " khác",
            })
          ).status,
          400,
        );
        assert.ok(
          !(await (await fetch(base + "/api/menu")).json()).categories.some(
            (category) => category.id === categoryFixture.id,
          ),
        );
      },
    );
    await check(
      "category edits and item moves survive restart without orphaning the menu",
      async () => {
        await stop();
        await start();
        staffCookie = (
          await request("", "/api/admin/auth", "POST", {
            password: adminPassword,
          })
        ).cookie;
        const categories = (await request(staffCookie, "/api/admin/categories"))
          .data.categories;
        assert.equal(categories.at(-1).id, categoryFixture.id);
        assert.equal(categories.at(-1).isActive, false);
        const catalog = (await request(staffCookie, "/api/admin/menu")).data;
        assert.notEqual(
          catalog.items.find((entry) => entry.id === categoryMenuItem.id)
            .categoryId,
          categoryFixture.id,
        );
        assert.ok(
          !(await (await fetch(base + "/api/menu")).json()).categories.some(
            (category) => category.id === categoryFixture.id,
          ),
        );
      },
    );
    await check(
      "storefront snapshot returns one private owner with coherent cart, conversation and order detail",
      async () => {
        const response = await fetch(base + "/api/storefront");
        assert.equal(response.status, 200);
        assert.ok(response.headers.get("cache-control").includes("no-store"));
        const snapshot = await response.json();
        const cookie = response.headers.get("set-cookie").split(";")[0];
        assert.match(snapshot.ownerId, /^guest_/);
        assert.equal(snapshot.session.profile, null);
        assert.equal(snapshot.basket, null);
        await request(
          cookie,
          "/api/cart",
          "POST",
          { menuItemId: item.id, quantity: 1 },
          { "X-KFC-Owner": snapshot.ownerId },
        );
        const loaded = (
          await request(cookie, "/api/storefront?orderId=" + accountOrder.id)
        ).data;
        assert.equal(loaded.ownerId, loaded.basket.cart.userId);
        assert.equal(loaded.basket.items.length, 1);
        assert.equal(loaded.detail, null);
        assert.equal(loaded.history.orders.length, 0);
        const own = (
          await request(alice, "/api/storefront?orderId=" + order.id)
        ).data;
        assert.equal(own.detail.userId, own.ownerId);
        assert.equal(own.detail.id, order.id);
      },
    );
    await check(
      "stale displayed-owner headers reject cart, profile and logout without touching the new account",
      async () => {
        const snapshot = (await request(recoveryCookie, "/api/storefront"))
          .data;
        assert.equal(snapshot.ownerId, snapshot.session.profile.id);
        const before = JSON.stringify(snapshot.basket);
        const headers = { "X-KFC-Owner": "guest_different-display" };
        for (const [path, method, body] of [
          ["/api/cart", "POST", { menuItemId: item.id, quantity: 1 }],
          ["/api/account/profile", "PATCH", { fullName: "Unexpected rename" }],
          ["/api/auth/session", "DELETE", undefined],
        ]) {
          const result = await request(
            recoveryCookie,
            path,
            method,
            body,
            headers,
          );
          assert.equal(result.status, 409);
          assert.equal(result.data.code, "IDENTITY_CHANGED");
        }
        assert.equal(
          (await request(recoveryCookie, "/api/auth/session")).data.profile
            .fullName,
          "Sinh viên cập nhật",
        );
        assert.equal(
          JSON.stringify(
            (await request(recoveryCookie, "/api/storefront")).data.basket
              .items,
          ),
          JSON.stringify(snapshot.basket.items),
        );
        assert.ok(before);
      },
    );
    await check(
      "revoked customer cookies never fall through to a valid old guest; bootstrap explicitly clears the invalid account",
      async () => {
        const combined = secondCookie + "; " + alice;
        const before = (await request(alice, "/api/cart")).data.items;
        for (const [path, method, body] of [
          ["/api/cart", "POST", { menuItemId: item.id, quantity: 1 }],
          ["/api/cart", "DELETE", undefined],
          ["/api/chat", "POST", { message: "Thêm 1 Pepsi" }],
        ])
          assert.equal(
            (await request(combined, path, method, body)).status,
            401,
          );
        assert.equal(
          (
            await fetch(base + "/orders/" + order.id + "/receipt", {
              headers: { Cookie: combined },
            })
          ).status,
          404,
        );
        const recovery = await request(combined, "/api/storefront");
        assert.equal(recovery.status, 200);
        assert.equal(recovery.cookie, "kfc_customer=");
        assert.equal(recovery.data.session.profile, null);
        assert.equal(
          recovery.data.ownerId,
          (await request(alice, "/api/storefront")).data.ownerId,
        );
        assert.deepEqual(
          (await request(alice, "/api/cart")).data.items,
          before,
        );
      },
    );
    let auditItemId;
    await check(
      "catalog audit is staff-only, records price changes and skips no-op or rejected writes",
      async () => {
        assert.equal(
          (await request(alice, "/api/admin/catalog-audit")).status,
          401,
        );
        assert.equal(
          (await request(recoveryCookie, "/api/admin/catalog-audit")).status,
          401,
        );
        assert.equal(
          (
            await fetch(base + "/api/admin/catalog-audit", {
              method: "POST",
              headers: {
                Cookie: staffCookie,
                "Content-Type": "application/json",
              },
              body: "{}",
            })
          ).status,
          405,
        );
        const catalog = (await request(staffCookie, "/api/admin/menu")).data;
        const fields = {
          name: "Món audit " + crypto.randomUUID(),
          description: "Dữ liệu catalog demo",
          price: 39000,
          categoryId: catalog.categories.find((entry) => entry.isActive).id,
          imageUrl: "/images/burger.svg",
          isActive: true,
          isAvailable: true,
        };
        const created = await request(
          staffCookie,
          "/api/admin/menu",
          "POST",
          fields,
        );
        assert.equal(created.status, 201);
        auditItemId = created.data.item.id;
        const changed = {
          ...fields,
          itemId: auditItemId,
          price: 49000,
          isAvailable: false,
        };
        assert.equal(
          (await request(staffCookie, "/api/admin/menu", "PATCH", changed))
            .status,
          200,
        );
        assert.equal(
          (await request(staffCookie, "/api/admin/menu", "PATCH", changed))
            .status,
          200,
        );
        assert.equal(
          (await request(staffCookie, "/api/admin/menu", "POST", fields))
            .status,
          409,
        );
        const history = (await request(staffCookie, "/api/admin/catalog-audit"))
          .data;
        const entries = history.entries.filter(
          (entry) => entry.entityId === auditItemId,
        );
        assert.equal(history.limit, 200);
        assert.equal(entries.length, 2);
        const updated = entries.find(
          (entry) => entry.action === "MENU_UPDATED",
        );
        assert.deepEqual(
          updated.changes.find((change) => change.field === "price"),
          { field: "price", before: 39000, after: 49000 },
        );
        assert.ok(
          !/"(phone|password|passwordHash|sessionId|token)"\s*:/.test(
            JSON.stringify(history),
          ),
        );
        const response = await fetch(base + "/api/admin/catalog-audit", {
          headers: { Cookie: staffCookie },
        });
        assert.ok(response.headers.get("cache-control").includes("no-store"));
      },
    );
    await check(
      "catalog audit and canonical data survive restart together, including category changes",
      async () => {
        await stop();
        await start();
        staffCookie = (
          await request("", "/api/admin/auth", "POST", {
            password: adminPassword,
          })
        ).cookie;
        const history = (await request(staffCookie, "/api/admin/catalog-audit"))
          .data.entries;
        assert.equal(
          history.filter((entry) => entry.entityId === auditItemId).length,
          2,
        );
        assert.ok(
          history.some(
            (entry) =>
              entry.entityId === categoryFixture.id &&
              entry.action === "CATEGORY_UPDATED",
          ),
        );
        const catalog = (await request(staffCookie, "/api/admin/menu")).data;
        assert.equal(
          catalog.items.find((entry) => entry.id === auditItemId).price,
          49000,
        );
        assert.equal(
          catalog.items.find((entry) => entry.id === auditItemId).isAvailable,
          false,
        );
      },
    );
    let savedBook, savedAddressId, addressOrder;
    const savedFields = {
      label: "Nhà demo",
      recipientName: "Người nhận demo",
      phone: "0901234567",
      addressLine: "123 Đường Địa Chỉ Mẫu, Thành phố Demo",
      isDefault: false,
    };
    await check(
      "saved addresses are account-only, owner-bound and strict about input fields",
      async () => {
        assert.equal(
          (await request(alice, "/api/account/addresses")).status,
          401,
        );
        assert.equal(
          (await request(staffCookie, "/api/account/addresses")).status,
          401,
        );
        savedBook = (await request(recoveryCookie, "/api/account/addresses"))
          .data;
        assert.equal(savedBook.addresses.length, 0);
        assert.equal(
          (
            await request(recoveryCookie, "/api/account/addresses", "POST", {
              ...savedFields,
              revision: savedBook.revision,
              userId: "forged",
            })
          ).status,
          400,
        );
        const created = await request(
          recoveryCookie,
          "/api/account/addresses",
          "POST",
          { ...savedFields, revision: savedBook.revision },
        );
        assert.equal(created.status, 201);
        savedBook = created.data;
        savedAddressId = savedBook.addresses[0].id;
        assert.equal(savedBook.addresses[0].isDefault, true);
        const otherBook = (await request(otherCookie, "/api/account/addresses"))
          .data;
        assert.equal(otherBook.addresses.length, 0);
        assert.equal(
          (
            await request(otherCookie, "/api/account/addresses", "PATCH", {
              ...savedFields,
              addressId: savedAddressId,
              revision: otherBook.revision,
            })
          ).status,
          404,
        );
        assert.equal(
          (
            await request(
              recoveryCookie,
              "/api/account/addresses",
              "PATCH",
              {
                ...savedFields,
                addressId: savedAddressId,
                revision: savedBook.revision,
              },
              { "X-KFC-Owner": "wrong" },
            )
          ).status,
          409,
        );
      },
    );
    await check(
      "address revisions reject stale writes, defaults stay unique and order contact snapshots do not change",
      async () => {
        const oldRevision = savedBook.revision;
        savedBook = (
          await request(recoveryCookie, "/api/account/addresses", "POST", {
            ...savedFields,
            label: "Công ty demo",
            isDefault: true,
            revision: oldRevision,
          })
        ).data;
        assert.equal(
          savedBook.addresses.filter((entry) => entry.isDefault).length,
          1,
        );
        assert.equal(
          (
            await request(recoveryCookie, "/api/account/addresses", "PATCH", {
              ...savedFields,
              addressId: savedAddressId,
              revision: oldRevision,
            })
          ).status,
          409,
        );
        const basket = (await request(recoveryCookie, "/api/cart")).data;
        const selected = savedBook.addresses[0];
        const created = await request(recoveryCookie, "/api/orders", "POST", {
          cartId: basket.cart.id,
          cartSignature: basket.signature,
          customerName: selected.recipientName,
          phone: selected.phone,
          address: selected.addressLine,
          fulfillment: "delivery",
          expectedTotal: basket.cart.subtotal + 15000,
          idempotencyKey: crypto.randomUUID(),
          confirm: true,
        });
        assert.equal(created.status, 201);
        addressOrder = created.data;
        savedBook = (
          await request(recoveryCookie, "/api/account/addresses", "PATCH", {
            ...savedFields,
            addressLine: "456 Địa Chỉ Sau Khi Chỉnh Sửa, Thành phố Demo",
            addressId: savedAddressId,
            revision: savedBook.revision,
          })
        ).data;
        assert.equal(
          (
            await request(
              recoveryCookie,
              "/api/orders?orderId=" + addressOrder.id,
            )
          ).data.shippingAddress.address,
          savedFields.addressLine,
        );
        assert.equal(
          (
            await request(recoveryCookie, "/api/account/addresses", "DELETE", {
              addressId: savedAddressId,
              revision: savedBook.revision,
            })
          ).status,
          400,
        );
        savedBook = (
          await request(recoveryCookie, "/api/account/addresses", "DELETE", {
            addressId: savedAddressId,
            revision: savedBook.revision,
            confirm: true,
          })
        ).data;
        assert.equal(savedBook.addresses.length, 1);
        assert.equal(savedBook.addresses[0].isDefault, true);
      },
    );
    await check(
      "saved addresses survive restart and the five-address limit is enforced",
      async () => {
        await stop();
        await start();
        savedBook = (await request(recoveryCookie, "/api/account/addresses"))
          .data;
        assert.equal(savedBook.addresses.length, 1);
        const snapshot = (await request(recoveryCookie, "/api/storefront"))
          .data;
        assert.equal(snapshot.addressBook.revision, savedBook.revision);
        for (let index = 0; index < 4; index++) {
          const result = await request(
            recoveryCookie,
            "/api/account/addresses",
            "POST",
            {
              ...savedFields,
              label: "Địa chỉ " + index,
              revision: savedBook.revision,
            },
          );
          assert.equal(result.status, 201);
          savedBook = result.data;
        }
        assert.equal(
          (
            await request(recoveryCookie, "/api/account/addresses", "POST", {
              ...savedFields,
              revision: savedBook.revision,
            })
          ).data.code,
          "ADDRESS_LIMIT",
        );
        assert.equal(
          (await request(alice, "/api/storefront")).data.addressBook,
          null,
        );
      },
    );
    let promoStaff,
      promoCookie,
      promoEntry,
      promoBasket,
      promoOrder,
      promoInput;
    const promoFields = {
      code: "KFC20TEST",
      title: "Ưu đãi tích hợp",
      discountType: "percent",
      value: 20,
      minimumSubtotal: 0,
      maxDiscount: 10000,
      startsAt: "2020-01-01T00:00:00.000Z",
      endsAt: "2099-01-01T00:00:00.000Z",
      isActive: true,
    };
    await check(
      "promotion administration is staff-only, strict and revision-protected",
      async () => {
        promoStaff = (
          await request("", "/api/admin/auth", "POST", {
            password: adminPassword,
          })
        ).cookie;
        promoCookie = await guest();
        assert.equal(
          (await request(promoCookie, "/api/admin/promotions")).status,
          401,
        );
        assert.equal(
          (
            await request(
              recoveryCookie,
              "/api/admin/promotions",
              "POST",
              promoFields,
            )
          ).status,
          401,
        );
        assert.equal(
          (
            await fetch(base + "/api/admin/promotions", {
              method: "DELETE",
              headers: { Cookie: promoStaff },
            })
          ).status,
          405,
        );
        for (const extra of [
          { value: 101 },
          { endsAt: promoFields.startsAt },
          { ownerId: "forged" },
        ])
          assert.equal(
            (
              await request(promoStaff, "/api/admin/promotions", "POST", {
                ...promoFields,
                ...extra,
              })
            ).status,
            400,
          );
        const created = await request(
          promoStaff,
          "/api/admin/promotions",
          "POST",
          promoFields,
        );
        assert.equal(created.status, 201);
        promoEntry = created.data;
        assert.equal(
          (
            await request(promoStaff, "/api/admin/promotions", "POST", {
              ...promoFields,
              code: promoFields.code.toLowerCase(),
            })
          ).status,
          409,
        );
        const edits = await Promise.all(
          [10, 15].map((value) =>
            request(promoStaff, "/api/admin/promotions", "PATCH", {
              ...promoFields,
              value,
              revision: promoEntry.revision,
            }),
          ),
        );
        assert.equal(edits.filter((r) => r.status === 200).length, 1);
        assert.equal(edits.filter((r) => r.status === 409).length, 1);
        promoEntry = edits.find((r) => r.status === 200).data;
        const list = await fetch(base + "/api/admin/promotions", {
          headers: { Cookie: promoStaff },
        });
        assert.match(list.headers.get("cache-control"), /no-store/);
      },
    );
    let promoQuoteInput, promoQuote;
    await check(
      "promotion quotes use private server prices and reject inactive, dated, minimum and foreign-owner requests",
      async () => {
        const menu = (await request(promoCookie, "/api/menu")).data;
        const selected = menu.items[0];
        const added = await request(promoCookie, "/api/cart", "POST", {
          menuItemId: selected.id,
          quantity: 2,
        });
        assert.equal(added.status, 201);
        promoBasket = added.data;
        promoQuoteInput = {
          cartId: promoBasket.cart.id,
          cartSignature: promoBasket.signature,
          fulfillment: "delivery",
          promotionCode: promoEntry.code.toLowerCase(),
        };
        const response = await request(
          promoCookie,
          "/api/checkout/quote",
          "POST",
          promoQuoteInput,
        );
        assert.equal(response.status, 200);
        promoQuote = response.data;
        assert.equal(
          promoQuote.discount,
          Math.min(
            10000,
            Math.floor((promoBasket.cart.subtotal * promoEntry.value) / 100),
          ),
        );
        assert.equal(
          promoQuote.total,
          promoBasket.cart.subtotal - promoQuote.discount + 15000,
        );
        assert.equal(
          (
            await request(promoCookie, "/api/checkout/quote", "POST", {
              ...promoQuoteInput,
              discount: 999999,
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await request(
              promoCookie,
              "/api/checkout/quote",
              "POST",
              promoQuoteInput,
              { "X-KFC-Owner": "wrong-owner" },
            )
          ).status,
          409,
        );
        assert.equal(
          (await request(bob, "/api/checkout/quote", "POST", promoQuoteInput))
            .status,
          400,
        );
        for (const [code, extra, error] of [
          ["OFFTEST", { isActive: false }, "PROMOTION_UNAVAILABLE"],
          [
            "FUTURETEST",
            { startsAt: "2098-01-01T00:00:00.000Z" },
            "PROMOTION_UNAVAILABLE",
          ],
          [
            "EXPIREDTEST",
            {
              startsAt: "2000-01-01T00:00:00.000Z",
              endsAt: "2001-01-01T00:00:00.000Z",
            },
            "PROMOTION_UNAVAILABLE",
          ],
          ["MINIMUMTEST", { minimumSubtotal: 10000000 }, "PROMOTION_MINIMUM"],
        ]) {
          assert.equal(
            (
              await request(promoStaff, "/api/admin/promotions", "POST", {
                ...promoFields,
                code,
                ...extra,
              })
            ).status,
            201,
          );
          const failed = await request(
            promoCookie,
            "/api/checkout/quote",
            "POST",
            { ...promoQuoteInput, promotionCode: code },
          );
          assert.equal(failed.status, 400);
          assert.equal(failed.data.code, error);
        }
        assert.equal(
          (await request(promoCookie, "/api/cart")).data.items[0].quantity,
          2,
        );
      },
    );
    await check(
      "checkout rejects stale promotions and tampered totals; retries and receipts retain the discount snapshot",
      async () => {
        promoInput = {
          cartId: promoBasket.cart.id,
          cartSignature: promoBasket.signature,
          customerName: "Promo Test",
          phone: "0901234567",
          fulfillment: "delivery",
          address: "12 Đường Demo, Thành phố Demo",
          note: "",
          expectedTotal: promoQuote.total,
          idempotencyKey: crypto.randomUUID(),
          confirm: true,
          promotionCode: promoEntry.code,
          promotionRevision: promoEntry.revision,
        };
        const updated = await request(
          promoStaff,
          "/api/admin/promotions",
          "PATCH",
          {
            ...promoFields,
            value: promoEntry.value,
            title: "Điều kiện được cập nhật",
            revision: promoEntry.revision,
          },
        );
        assert.equal(updated.status, 200);
        promoEntry = updated.data;
        const stale = await request(
          promoCookie,
          "/api/orders",
          "POST",
          promoInput,
        );
        assert.equal(stale.status, 400);
        assert.equal(stale.data.code, "PROMOTION_CHANGED");
        promoQuote = (
          await request(
            promoCookie,
            "/api/checkout/quote",
            "POST",
            promoQuoteInput,
          )
        ).data;
        promoInput = {
          ...promoInput,
          expectedTotal: promoQuote.total,
          promotionRevision: promoQuote.promotion.revision,
        };
        const tampered = await request(promoCookie, "/api/orders", "POST", {
          ...promoInput,
          expectedTotal: promoInput.expectedTotal + 1,
        });
        assert.equal(tampered.status, 400);
        assert.equal(tampered.data.code, "PRICE_CHANGED");
        const results = await Promise.all([
          request(promoCookie, "/api/orders", "POST", promoInput),
          request(promoCookie, "/api/orders", "POST", promoInput),
        ]);
        assert.ok(results.every((r) => r.status === 201));
        assert.equal(results[0].data.id, results[1].data.id);
        promoOrder = results[0].data;
        assert.equal(promoOrder.discount, promoQuote.discount);
        assert.equal(promoOrder.deliveryFee, 15000);
        assert.equal(promoOrder.promotion.code, promoEntry.code);
        const disabled = await request(
          promoStaff,
          "/api/admin/promotions",
          "PATCH",
          {
            ...promoFields,
            value: promoEntry.value,
            isActive: false,
            revision: promoEntry.revision,
          },
        );
        assert.equal(disabled.status, 200);
        assert.deepEqual(
          (await request(promoCookie, "/api/orders", "POST", promoInput)).data,
          promoOrder,
        );
        const receipt = await fetch(
          base + "/orders/" + promoOrder.id + "/receipt",
          { headers: { Cookie: promoCookie } },
        );
        assert.equal(receipt.status, 200);
        assert.ok((await receipt.text()).includes(promoEntry.code));
      },
    );
    await check(
      "promotion books and order snapshots persist; full discounts allow zero pickup totals but preserve delivery fees",
      async () => {
        await stop();
        await start();
        promoStaff = (
          await request("", "/api/admin/auth", "POST", {
            password: adminPassword,
          })
        ).cookie;
        const entries = (await request(promoStaff, "/api/admin/promotions"))
          .data.promotions;
        assert.equal(
          entries.find((e) => e.code === promoEntry.code).isActive,
          false,
        );
        const detail = await request(
          promoCookie,
          "/api/orders?orderId=" + promoOrder.id,
        );
        assert.equal(detail.status, 200);
        assert.equal(detail.data.discount, promoOrder.discount);
        assert.equal(detail.data.promotion.title, "Điều kiện được cập nhật");
        const free = await request(
          promoStaff,
          "/api/admin/promotions",
          "POST",
          { ...promoFields, code: "FREEFOODTEST", value: 100, maxDiscount: 0 },
        );
        assert.equal(free.status, 201);
        const selected = (await request(promoCookie, "/api/menu")).data
          .items[0];
        const basket = (
          await request(promoCookie, "/api/cart", "POST", {
            menuItemId: selected.id,
            quantity: 1,
          })
        ).data;
        const q = {
          cartId: basket.cart.id,
          cartSignature: basket.signature,
          fulfillment: "pickup",
          promotionCode: "FREEFOODTEST",
        };
        const quote = (
          await request(promoCookie, "/api/checkout/quote", "POST", q)
        ).data;
        assert.equal(quote.total, 0);
        assert.equal(
          (
            await request(promoCookie, "/api/checkout/quote", "POST", {
              ...q,
              fulfillment: "delivery",
            })
          ).data.total,
          15000,
        );
        const created = await request(promoCookie, "/api/orders", "POST", {
          ...promoInput,
          cartId: q.cartId,
          cartSignature: q.cartSignature,
          fulfillment: "pickup",
          address: "",
          expectedTotal: 0,
          promotionCode: q.promotionCode,
          promotionRevision: quote.promotion.revision,
          idempotencyKey: crypto.randomUUID(),
        });
        assert.equal(created.status, 201);
        assert.equal(created.data.total, 0);
        assert.equal(created.data.discount, basket.cart.subtotal);
      },
    );
    let reorderPreview, reorderCart, reorderSource, reorderMenuItem;
    const updateReorderMenu = async (extra) =>
      request(promoStaff, "/api/admin/menu", "PATCH", {
        itemId: reorderMenuItem.id,
        name: reorderMenuItem.name,
        description: reorderMenuItem.description ?? "",
        categoryId: reorderMenuItem.categoryId,
        price: reorderMenuItem.price,
        isActive: reorderMenuItem.isActive,
        isAvailable: reorderMenuItem.isAvailable,
        imageUrl: reorderMenuItem.imageUrl.replace(/\.png$/, ".svg"),
        ...extra,
      });
    await check(
      "reorder preview is private, strict and read-only, exposing current lines without order contact",
      async () => {
        promoStaff = (
          await request("", "/api/admin/auth", "POST", {
            password: adminPassword,
          })
        ).cookie;
        const body = { orderId: promoOrder.id };
        assert.equal(
          (await request("", "/api/orders/reorder", "POST", body)).status,
          401,
        );
        assert.equal(
          (await request(promoStaff, "/api/orders/reorder", "POST", body))
            .status,
          401,
        );
        assert.equal(
          (await request(bob, "/api/orders/reorder", "POST", body)).status,
          404,
        );
        assert.equal(
          (
            await request(promoCookie, "/api/orders/reorder", "POST", {
              ...body,
              userId: "forged",
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await fetch(base + "/api/orders/reorder", {
              headers: { Cookie: promoCookie },
            })
          ).status,
          405,
        );
        const response = await fetch(base + "/api/orders/reorder", {
          method: "POST",
          headers: { Cookie: promoCookie, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        assert.equal(response.status, 200);
        assert.match(response.headers.get("cache-control"), /no-store/);
        reorderPreview = await response.json();
        assert.ok(reorderPreview.items.length > 0);
        assert.equal((await request(promoCookie, "/api/cart")).data.cart, null);
        assert.ok(!JSON.stringify(reorderPreview).includes("0901234567"));
        assert.ok(!JSON.stringify(reorderPreview).includes("Promo Test"));
        reorderSource = (
          await request(promoCookie, "/api/orders?orderId=" + promoOrder.id)
        ).data;
        reorderMenuItem = (
          await request(promoStaff, "/api/admin/menu")
        ).data.items.find((i) => i.id === reorderPreview.items[0].menuItemId);
        assert.equal(reorderPreview.items[0].unitPrice, reorderMenuItem.price);
      },
    );
    await check(
      "reorder confirmations reject forged tokens, stale menu prices, unavailable items and changed owners",
      async () => {
        const token = reorderPreview.confirmationToken;
        assert.equal(
          (
            await request(promoCookie, "/api/orders/reorder", "PUT", {
              confirmationToken: token,
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await request(promoCookie, "/api/orders/reorder", "PUT", {
              confirmationToken: token,
              confirm: true,
              quantity: 99,
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await request(
              promoCookie,
              "/api/orders/reorder",
              "PUT",
              { confirmationToken: token, confirm: true },
              { "X-KFC-Owner": "wrong-owner" },
            )
          ).status,
          409,
        );
        assert.equal(
          (
            await request(bob, "/api/orders/reorder", "PUT", {
              confirmationToken: token,
              confirm: true,
            })
          ).data.code,
          "REORDER_EXPIRED",
        );
        const forged = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");
        assert.equal(
          (
            await request(promoCookie, "/api/orders/reorder", "PUT", {
              confirmationToken: forged,
              confirm: true,
            })
          ).data.code,
          "REORDER_EXPIRED",
        );
        assert.equal(
          (await updateReorderMenu({ price: reorderMenuItem.price + 1000 }))
            .status,
          200,
        );
        assert.equal(
          (
            await request(promoCookie, "/api/orders/reorder", "PUT", {
              confirmationToken: token,
              confirm: true,
            })
          ).data.code,
          "REORDER_CHANGED",
        );
        assert.equal((await request(promoCookie, "/api/cart")).data.cart, null);
        assert.equal(
          (await updateReorderMenu({ isAvailable: false })).status,
          200,
        );
        assert.equal(
          (
            await request(promoCookie, "/api/orders/reorder", "POST", {
              orderId: promoOrder.id,
            })
          ).data.code,
          "REORDER_UNAVAILABLE",
        );
        assert.equal((await updateReorderMenu({})).status, 200);
      },
    );
    await check(
      "reorder preserves nonempty carts and confirms exactly once without copying promotions or clearing newer proposals on retry",
      async () => {
        const added = (
          await request(promoCookie, "/api/cart", "POST", {
            menuItemId: reorderMenuItem.id,
            quantity: 1,
          })
        ).data;
        assert.equal(
          (
            await request(promoCookie, "/api/orders/reorder", "POST", {
              orderId: promoOrder.id,
            })
          ).data.code,
          "REORDER_CART_NOT_EMPTY",
        );
        assert.equal(
          (
            await request(promoCookie, "/api/orders/reorder", "PUT", {
              confirmationToken: reorderPreview.confirmationToken,
              confirm: true,
            })
          ).data.code,
          "REORDER_CART_NOT_EMPTY",
        );
        assert.equal(
          (await request(promoCookie, "/api/cart")).data.items[0].quantity,
          1,
        );
        assert.equal(
          (await request(promoCookie, "/api/cart", "DELETE")).status,
          200,
        );
        assert.equal(
          (
            await request(promoCookie, "/api/orders/reorder", "PUT", {
              confirmationToken: reorderPreview.confirmationToken,
              confirm: true,
            })
          ).data.code,
          "REORDER_CHANGED",
        );
        reorderPreview = (
          await request(promoCookie, "/api/orders/reorder", "POST", {
            orderId: promoOrder.id,
          })
        ).data;
        const countBefore = (await request(promoCookie, "/api/orders")).data
          .orders.length;
        const replies = await Promise.all([
          request(promoCookie, "/api/orders/reorder", "PUT", {
            confirmationToken: reorderPreview.confirmationToken,
            confirm: true,
          }),
          request(promoCookie, "/api/orders/reorder", "PUT", {
            confirmationToken: reorderPreview.confirmationToken,
            confirm: true,
          }),
        ]);
        assert.ok(replies.every((r) => r.status === 200));
        assert.equal(replies[0].data.cart.id, replies[1].data.cart.id);
        assert.equal(replies.filter((r) => !r.data.replayed).length, 1);
        reorderCart = replies[0].data;
        assert.notEqual(reorderCart.cart.id, added.cart.id);
        assert.equal(reorderCart.cart.discount, 0);
        assert.equal(reorderCart.cart.deliveryFee, 0);
        assert.equal(reorderCart.cart.sourceOrderId, promoOrder.id);
        assert.ok(reorderSource.discount > 0);
        assert.equal(
          (await request(promoCookie, "/api/orders")).data.orders.length,
          countBefore,
        );
        const proposal = await request(promoCookie, "/api/chat", "POST", {
          message: "Thêm 1 " + reorderMenuItem.name,
        });
        assert.equal(proposal.status, 200);
        assert.ok(proposal.data.pendingConfirmation);
        assert.equal(
          (
            await request(promoCookie, "/api/orders/reorder", "PUT", {
              confirmationToken: reorderPreview.confirmationToken,
              confirm: true,
            })
          ).data.replayed,
          true,
        );
        assert.equal(
          (await request(promoCookie, "/api/storefront")).data.session
            .pendingConfirmation.id,
          proposal.data.pendingConfirmation.id,
        );
      },
    );
    await check(
      "reorder retries survive restart and preserve later quantity edits; checked-out reorder carts cannot be reopened",
      async () => {
        await stop();
        await start();
        const repeated = await request(
          promoCookie,
          "/api/orders/reorder",
          "PUT",
          {
            confirmationToken: reorderPreview.confirmationToken,
            confirm: true,
          },
        );
        assert.equal(repeated.status, 200);
        assert.equal(repeated.data.replayed, true);
        assert.equal(repeated.data.cart.id, reorderCart.cart.id);
        const qty = repeated.data.items[0].quantity + 1;
        const changed = (
          await request(promoCookie, "/api/cart", "PATCH", {
            itemId: repeated.data.items[0].id,
            quantity: qty,
          })
        ).data;
        const replay = await request(
          promoCookie,
          "/api/orders/reorder",
          "PUT",
          {
            confirmationToken: reorderPreview.confirmationToken,
            confirm: true,
          },
        );
        assert.equal(replay.data.items[0].quantity, qty);
        const created = await request(promoCookie, "/api/orders", "POST", {
          cartId: changed.cart.id,
          cartSignature: changed.signature,
          customerName: "Reorder Demo",
          phone: "0901234567",
          fulfillment: "pickup",
          address: "",
          note: "",
          expectedTotal: changed.cart.subtotal,
          idempotencyKey: crypto.randomUUID(),
          confirm: true,
        });
        assert.equal(created.status, 201);
        assert.equal(created.data.discount, 0);
        assert.equal(created.data.deliveryFee, 0);
        const used = await request(promoCookie, "/api/orders/reorder", "PUT", {
          confirmationToken: reorderPreview.confirmationToken,
          confirm: true,
        });
        assert.equal(used.status, 409);
        assert.equal(used.data.code, "REORDER_ALREADY_USED");
        assert.equal((await request(promoCookie, "/api/cart")).data.cart, null);
        assert.equal(
          (await request(promoCookie, "/api/orders?orderId=" + promoOrder.id))
            .data.discount,
          promoOrder.discount,
        );
      },
    );
    let languageCookie, languagePepsi, languageOther;
    const languageSend = (message, confirmationId) =>
      request(languageCookie, "/api/chat", "POST", {
        message,
        confirm: !!confirmationId,
        ...(confirmationId ? { confirmationId } : {}),
      });
    const languageCart = async () => {
      const v = (await request(languageCookie, "/api/cart")).data;
      return {
        id: v.cart?.id ?? null,
        items: v.items.map((i) => [
          i.id,
          i.menuItemId,
          i.quantity,
          i.unitPrice,
        ]),
      };
    };
    await check(
      "spoken Vietnamese quantities remain proposals and commit their exact counts only after confirmation",
      async () => {
        languageCookie = await guest();
        const menu = (await request(languageCookie, "/api/menu")).data;
        languagePepsi = menu.items.find((i) =>
          i.name.toLowerCase().includes("pepsi"),
        );
        languageOther = menu.items.find((i) => i.id !== languagePepsi.id);
        const proposal = await languageSend("Cho mình hai chai Pepsi 1,5 lít");
        assert.equal(proposal.status, 200);
        assert.equal(proposal.data.actions[0].parameters.quantity, 2);
        assert.equal(
          proposal.data.actions[0].parameters.itemId,
          languagePepsi.id,
        );
        assert.equal(
          (await request(languageCookie, "/api/cart")).data.cart,
          null,
        );
        assert.equal(
          (await languageSend("Xác nhận", proposal.data.pendingConfirmation.id))
            .status,
          200,
        );
        assert.equal(
          (await request(languageCookie, "/api/cart")).data.items[0].quantity,
          2,
        );
        const update = await languageSend("Giảm Pepsi còn một");
        assert.equal(update.data.actions[0].parameters.quantity, 1);
        assert.equal(
          (await request(languageCookie, "/api/cart")).data.items[0].quantity,
          2,
        );
        await languageSend("Xác nhận", update.data.pendingConfirmation.id);
        assert.equal(
          (await request(languageCookie, "/api/cart")).data.items[0].quantity,
          1,
        );
      },
    );
    await check(
      "inside-cart language removes the named line without clearing another product",
      async () => {
        assert.equal(
          (
            await request(languageCookie, "/api/cart", "POST", {
              menuItemId: languageOther.id,
              quantity: 1,
            })
          ).status,
          201,
        );
        const remove = await languageSend("Xoá Pepsi trong giỏ hàng");
        assert.equal(remove.data.actions[0].type, "REMOVE_FROM_CART");
        assert.equal(
          (await request(languageCookie, "/api/cart")).data.items.length,
          2,
        );
        await languageSend("Xác nhận", remove.data.pendingConfirmation.id);
        const remaining = (await request(languageCookie, "/api/cart")).data;
        assert.equal(remaining.items.length, 1);
        assert.equal(remaining.items[0].menuItemId, languageOther.id);
        const clear = await languageSend("Làm rỗng giỏ");
        assert.equal(clear.data.actions[0].type, "CLEAR_CART");
        assert.equal(
          (await request(languageCookie, "/api/cart")).data.items.length,
          1,
        );
        await languageSend("Xác nhận", clear.data.pendingConfirmation.id);
        assert.equal(
          (await request(languageCookie, "/api/cart")).data.items.length,
          0,
        );
      },
    );
    await check(
      "ambiguous, mixed, negated and relative messages never change an existing multi-item basket",
      async () => {
        await request(languageCookie, "/api/cart", "POST", {
          menuItemId: languagePepsi.id,
          quantity: 1,
        });
        await request(languageCookie, "/api/cart", "POST", {
          menuItemId: languageOther.id,
          quantity: 1,
        });
        const before = await languageCart();
        for (const message of [
          "Thêm hai Pepsi và một Burger",
          "Thêm 2 Pepsi, 1 Burger",
          "Thêm hai hoặc ba Pepsi",
          "Đổi Pepsi từ 2 thành 3",
          "Thêm một ít Pepsi",
          "Thêm 1.000 Pepsi",
          "Thêm .5 Pepsi",
          "Đừng xoá toàn bộ giỏ",
          "Giảm Pepsi bớt hai",
          "Nếu rẻ thì thêm hai Pepsi",
          "Xem giỏ rồi xoá toàn bộ",
        ]) {
          const r = await languageSend(message);
          assert.equal(r.status, 200);
          assert.equal(r.data.requiresConfirmation, false, message);
          assert.deepEqual(await languageCart(), before, message);
        }
      },
    );
    await check(
      "size and quantity limits stay authoritative; compound number words do not degrade to one",
      async () => {
        const before = await languageCart();
        for (const message of [
          "Thêm hai chai Pepsi 500ml",
          "Thêm Pepsi 2L",
          "Thêm âm hai Pepsi",
          "Thêm một trăm linh một Pepsi",
          "Thêm 2.5 Pepsi",
          "Thêm 0 Pepsi",
        ]) {
          const r = await languageSend(message);
          assert.equal(r.status, 200);
          assert.equal(r.data.requiresConfirmation, false, message);
          assert.deepEqual(await languageCart(), before, message);
        }
        const proposal = await languageSend("Mua giúp tôi hai mươi mốt Pepsi");
        assert.equal(proposal.data.actions[0].parameters.quantity, 21);
        assert.deepEqual(await languageCart(), before);
        await languageSend("Xác nhận", proposal.data.pendingConfirmation.id);
        const cart = (await request(languageCookie, "/api/cart")).data;
        assert.equal(
          cart.items.find((i) => i.menuItemId === languagePepsi.id).quantity,
          22,
        );
        assert.equal(
          cart.items.find((i) => i.menuItemId === languageOther.id).quantity,
          1,
        );
      },
    );
    let salesStaff, salesDashboard, salesReport, salesRenamed;
    await check(
      "product sales are staff-only and reject invalid, unknown or duplicated filters",
      async () => {
        salesStaff = (
          await request("", "/api/admin/auth", "POST", {
            password: adminPassword,
          })
        ).cookie;
        for (const cookie of ["", languageCookie, recoveryCookie])
          assert.equal((await request(cookie, "/api/admin/sales")).status, 401);
        for (const query of [
          "?status=INVALID",
          "?from=2026-02-30",
          "?from=2026-11-08&to=2026-11-07",
          "?status=all&status=COMPLETED",
          "?userId=forged",
          "?basisRevision=bad",
          "?search=" + "x".repeat(101),
        ])
          assert.equal(
            (await request(salesStaff, "/api/admin/sales" + query)).status,
            400,
            query,
          );
        assert.equal(
          (
            await fetch(base + "/api/admin/sales", {
              method: "POST",
              headers: { Cookie: salesStaff },
            })
          ).status,
          405,
        );
        const raw = await fetch(base + "/api/admin/sales", {
          headers: { Cookie: salesStaff },
        });
        assert.equal(raw.status, 200);
        assert.match(raw.headers.get("cache-control"), /no-store/);
      },
    );
    await check(
      "sales totals reconcile completed order snapshots and ignore later catalog renames",
      async () => {
        salesDashboard = (await request(salesStaff, "/api/admin/orders")).data;
        const response = await request(
          salesStaff,
          "/api/admin/sales?basisRevision=" + salesDashboard.revision,
        );
        assert.equal(response.status, 200);
        salesReport = response.data;
        const completed = salesDashboard.orders.filter(
          (o) => o.status === "COMPLETED",
        );
        assert.ok(completed.length > 0);
        assert.equal(salesReport.completedOrders, completed.length);
        assert.equal(salesReport.excludedOrders, 0);
        assert.equal(salesReport.sampledOrders, salesDashboard.orders.length);
        assert.equal(salesReport.basisRevision, salesDashboard.revision);
        for (const [field, source] of [
          ["gross", "subtotal"],
          ["discount", "discount"],
          ["deliveryFee", "deliveryFee"],
          ["net", "total"],
        ])
          assert.equal(
            salesReport[field],
            completed.reduce((sum, o) => sum + o[source], 0),
          );
        let units = 0;
        for (const o of completed)
          units += (
            await request(salesStaff, "/api/admin/orders?orderId=" + o.id)
          ).data.items.reduce((sum, i) => sum + i.quantity, 0);
        assert.equal(salesReport.units, units);
        assert.equal(
          salesReport.net,
          salesReport.gross - salesReport.discount + salesReport.deliveryFee,
        );
        for (const key of [
          '"customerName"',
          '"phone"',
          '"shippingAddress"',
          '"note"',
        ])
          assert.ok(!JSON.stringify(salesReport).includes(key));
        const top = salesReport.products[0],
          catalog = (await request(salesStaff, "/api/admin/menu")).data.items,
          product = catalog.find((i) => i.id === top.menuItemId);
        salesRenamed = product.name.slice(0, 70) + " Hiện Tại";
        assert.equal(
          (
            await request(salesStaff, "/api/admin/menu", "PATCH", {
              itemId: product.id,
              name: salesRenamed,
              description: product.description,
              categoryId: product.categoryId,
              price: product.price,
              isActive: product.isActive,
              isAvailable: product.isAvailable,
              imageUrl: product.imageUrl.replace(/\.png$/, ".svg"),
            })
          ).status,
          200,
        );
        assert.deepEqual(
          (
            await request(
              salesStaff,
              "/api/admin/sales?basisRevision=" + salesDashboard.revision,
            )
          ).data.products,
          salesReport.products,
        );
        assert.equal(
          (await request(salesStaff, "/api/admin/sales?status=CONFIRMED")).data
            .completedOrders,
          0,
        );
        const privateSearch = "PRIVATE_SALES_QUERY_MARKER";
        const empty = (
          await request(salesStaff, "/api/admin/sales?search=" + privateSearch)
        ).data;
        assert.equal(empty.completedOrders, 0);
        assert.ok(!JSON.stringify(empty).includes(privateSearch));
      },
    );
    await check(
      "sales source revisions reject shifted windows; filters and completed totals survive restart",
      async () => {
        const basket = (await request(languageCookie, "/api/cart")).data;
        const placed = await request(languageCookie, "/api/orders", "POST", {
          cartId: basket.cart.id,
          cartSignature: basket.signature,
          customerName: "Sales Demo",
          phone: "0901234567",
          fulfillment: "pickup",
          address: "",
          note: "",
          expectedTotal: basket.cart.subtotal,
          idempotencyKey: crypto.randomUUID(),
          confirm: true,
        });
        assert.equal(placed.status, 201);
        const stale = await request(
          salesStaff,
          "/api/admin/sales?basisRevision=" + salesDashboard.revision,
        );
        assert.equal(stale.status, 409);
        assert.equal(stale.data.code, "SALES_CHANGED");
        let state = "CONFIRMED";
        for (const next of ["PREPARING", "READY", "COMPLETED"]) {
          const moved = await request(
            salesStaff,
            "/api/admin/orders",
            "PATCH",
            {
              orderId: placed.data.id,
              expectedStatus: state,
              nextStatus: next,
            },
          );
          assert.equal(moved.status, 200);
          state = next;
        }
        const dashboard = (await request(salesStaff, "/api/admin/orders")).data,
          report = (
            await request(
              salesStaff,
              "/api/admin/sales?basisRevision=" + dashboard.revision,
            )
          ).data;
        assert.equal(report.completedOrders, salesReport.completedOrders + 1);
        assert.equal(report.net, salesReport.net + placed.data.total);
        const day = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Ho_Chi_Minh",
        }).format(new Date(placed.data.createdAt));
        const filtered = (
          await request(
            salesStaff,
            "/api/admin/sales?status=COMPLETED&fulfillment=pickup&search=" +
              placed.data.id +
              "&from=" +
              day +
              "&to=" +
              day,
          )
        ).data;
        assert.equal(filtered.completedOrders, 1);
        assert.equal(filtered.net, placed.data.total);
        await stop();
        await start();
        salesStaff = (
          await request("", "/api/admin/auth", "POST", {
            password: adminPassword,
          })
        ).cookie;
        const recovered = (
          await request(
            salesStaff,
            "/api/admin/sales?basisRevision=" + dashboard.revision,
          )
        ).data;
        assert.deepEqual(recovered.products, report.products);
        assert.equal(recovered.net, report.net);
        require("node:fs").writeFileSync(
          path.resolve("output/verification/sales-report-demo.json"),
          JSON.stringify(recovered, null, 2) + "\n",
        );
      },
    );
    let cancellationOwner, cancellationOrder, cancellationStaff;
    const publicReason = 'Cửa hàng tạm nghỉ <img src=x onerror=alert(1)>';
    await check("staff cancellation requires a public reason and preserves the exact reason on duplicate requests", async () => {
      cancellationOwner = await guest();
      cancellationStaff = (await request("", "/api/admin/auth", "POST", { password: adminPassword })).cookie;
      const available = (await request(cancellationOwner, "/api/menu")).data.items[0];
      const basket = (await request(cancellationOwner, "/api/cart", "POST", { menuItemId: available.id, quantity: 1 })).data;
      cancellationOrder = (await request(cancellationOwner, "/api/orders", "POST", {
        cartId: basket.cart.id, cartSignature: basket.signature, customerName: "Synthetic cancellation owner",
        phone: "0901234567", fulfillment: "pickup", expectedTotal: basket.cart.subtotal,
        idempotencyKey: crypto.randomUUID(), confirm: true,
      })).data;
      assert.equal(cancellationOrder.status, "CONFIRMED");
      const base = { orderId: cancellationOrder.id, expectedStatus: "CONFIRMED", nextStatus: "CANCELLED" };
      for (const changed of [{}, { cancellationReason: " " }, { cancellationReason: "abc" },
        { cancellationReason: "x".repeat(301) }, { cancellationReason: publicReason, nextStatus: "PREPARING" }]) {
        const response = await request(cancellationStaff, "/api/admin/orders", "PATCH", { ...base, ...changed });
        assert.equal(response.status, 400);
      }
      const pending = (await request(cancellationOwner, "/api/orders?orderId=" + cancellationOrder.id)).data;
      assert.equal(pending.status, "CONFIRMED");
      assert.equal(pending.events.length, 1);
      const body = { ...base, cancellationReason: publicReason };
      assert.equal((await request(cancellationOwner, "/api/admin/orders", "PATCH", body)).status, 401);
      const cancelled = await request(cancellationStaff, "/api/admin/orders", "PATCH", body);
      assert.equal(cancelled.status, 200);
      assert.equal(cancelled.data.status, "CANCELLED");
      assert.equal(cancelled.data.events.at(-1).metadata.cancellationReason, publicReason);
      const duplicate = await request(cancellationStaff, "/api/admin/orders", "PATCH", body);
      assert.deepEqual(duplicate.data, cancelled.data);
      assert.equal((await request(cancellationStaff, "/api/admin/orders", "PATCH", { ...body, cancellationReason: "Lý do khác sau khi huỷ" })).status, 409);
    });
    await check("public cancellation reason is owner-private, read-only after cancellation and survives restart", async () => {
      await stop();
      await start();
      const detail = (await request(cancellationOwner, "/api/orders?orderId=" + cancellationOrder.id)).data;
      assert.equal(detail.status, "CANCELLED");
      assert.equal(detail.events.length, 2);
      assert.equal(detail.events.at(-1).metadata.cancellationReason, publicReason);
      assert.equal((await request(await guest(), "/api/orders?orderId=" + cancellationOrder.id)).status, 404);
      const repeat = await request(cancellationOwner, "/api/orders", "PATCH", { orderId: cancellationOrder.id, confirm: true });
      assert.equal(repeat.status, 200);
      assert.equal(repeat.data.events.length, 2);
      assert.equal(repeat.data.events.at(-1).metadata.cancellationReason, publicReason);
    });
    let kitchenStaff;
    await check("kitchen board is staff-only, no-store and rejects unknown or duplicate filters", async () => {
      assert.equal((await request("", "/api/admin/kitchen")).status, 401);
      assert.equal((await request(cancellationOwner, "/api/admin/kitchen")).status, 401);
      kitchenStaff = (await request("", "/api/admin/auth", "POST", { password: adminPassword })).cookie;
      for (const query of ["fulfillment=drone", "unknown=true", "fulfillment=pickup&fulfillment=delivery"])
        assert.equal((await request(kitchenStaff, "/api/admin/kitchen?" + query)).status, 400);
      const response = await fetch(base + "/api/admin/kitchen", { headers: { Cookie: kitchenStaff } });
      assert.equal(response.status, 200);
      assert.match(response.headers.get("cache-control"), /no-store/);
      const board = await response.json();
      assert.equal(board.sampleLimit, 200);
      for (const card of board.cards) {
        assert.deepEqual(Object.keys(card).sort(), ["id", "status", "fulfillment", "createdAt", "updatedAt", "note", "items"].sort());
        for (const line of card.items) assert.deepEqual(Object.keys(line).sort(), ["menuItemId", "name", "quantity"].sort());
      }
      assert.equal((await fetch(base + "/api/admin/kitchen", { method: "POST", headers: { Cookie: kitchenStaff } })).status, 405);
    });
    await check("kitchen lanes follow pickup and delivery workflows, filter consistently and survive restart", async () => {
      const owner = await guest(), available = (await request(owner, "/api/menu")).data.items[0], placed = [];
      const initial = (await request(kitchenStaff, "/api/admin/kitchen")).data;
      const beforeUnits = initial.preparation.find(row => row.menuItemId === available.id)?.total ?? 0;
      for (const [fulfillment, quantity] of [["pickup", 2], ["delivery", 3]]) {
        const basket = (await request(owner, "/api/cart", "POST", { menuItemId: available.id, quantity })).data;
        const created = await request(owner, "/api/orders", "POST", { cartId: basket.cart.id, cartSignature: basket.signature,
          customerName: "PRIVATE_KITCHEN_CUSTOMER", phone: "0901234567", address: "123 Synthetic address", fulfillment,
          note: "Kitchen note for synthetic staff", expectedTotal: basket.cart.subtotal + (fulfillment === "delivery" ? 15000 : 0),
          idempotencyKey: crypto.randomUUID(), confirm: true });
        assert.equal(created.status, 201); placed.push(created.data);
      }
      let board = (await request(kitchenStaff, "/api/admin/kitchen")).data;
      assert.equal(board.preparation.find(row => row.menuItemId === available.id).total, beforeUnits + 5);
      assert.ok(!JSON.stringify(board).includes("PRIVATE_KITCHEN_CUSTOMER"));
      for (const order of placed) {
        const card = board.cards.find(entry => entry.id === order.id);
        assert.equal(card.status, "CONFIRMED");
        assert.equal(card.items[0].name, order.items[0].nameSnapshot);
        assert.equal(card.note, order.note);
        for (const [expectedStatus, nextStatus] of [["CONFIRMED", "PREPARING"], ["PREPARING", order.fulfillment === "delivery" ? "DELIVERING" : "READY"]])
          assert.equal((await request(kitchenStaff, "/api/admin/orders", "PATCH", { orderId: order.id, expectedStatus, nextStatus })).status, 200);
      }
      board = (await request(kitchenStaff, "/api/admin/kitchen")).data;
      assert.equal(board.cards.find(card => card.id === placed[0].id).status, "READY");
      assert.equal(board.cards.find(card => card.id === placed[1].id).status, "DELIVERING");
      assert.equal(board.preparation.find(row => row.menuItemId === available.id)?.total ?? 0, beforeUnits);
      const onlyDelivery = (await request(kitchenStaff, "/api/admin/kitchen?fulfillment=delivery")).data;
      assert.ok(onlyDelivery.cards.every(card => card.fulfillment === "delivery"));
      assert.ok(!onlyDelivery.cards.some(card => card.id === placed[0].id));
      await request(kitchenStaff, "/api/admin/orders", "PATCH", { orderId: placed[0].id, expectedStatus: "READY", nextStatus: "COMPLETED" });
      assert.ok(!(await request(kitchenStaff, "/api/admin/kitchen")).data.cards.some(card => card.id === placed[0].id));
      const snapshot = board.cards.find(card => card.id === placed[1].id);
      await stop(); await start();
      kitchenStaff = (await request("", "/api/admin/auth", "POST", { password: adminPassword })).cookie;
      const restored = (await request(kitchenStaff, "/api/admin/kitchen")).data;
      assert.deepEqual(restored.cards.find(card => card.id === placed[1].id), snapshot);
      assert.ok(!restored.cards.some(card => card.id === placed[0].id));
      assert.equal((await request(owner, "/api/orders?orderId=" + placed[1].id)).data.events.length, 3);
    });
    let shopStaff, shopView, shopOwner, shopOrder, shopOrderInput, shopPending;
    const shopFields = view => Object.fromEntries(Object.entries(view.settings).filter(([name]) => name !== "updatedAt"));
    await check("public shop status needs no session while staff settings enforce schema and revision", async () => {
      const response = await fetch(base + "/api/shop");
      assert.equal(response.status, 200); assert.equal(response.headers.get("set-cookie"), null);
      assert.match(response.headers.get("cache-control"), /no-store/);
      shopView = await response.json();
      assert.equal(shopView.configured, false); assert.equal(shopView.settings.deliveryFee, 15000);
      assert.equal((await request("", "/api/admin/shop")).status, 401);
      shopStaff = (await request("", "/api/admin/auth", "POST", { password: adminPassword })).cookie;
      const body = shopFields(shopView);
      for (const changed of [{ deliveryFee: -1 }, { hours: [] }, { privateSecret: "invalid" }, { phone: "bad" }])
        assert.equal((await request(shopStaff, "/api/admin/shop", "PATCH", { ...body, ...changed })).status, 400);
      assert.equal((await request(shopStaff, "/api/admin/shop", "PATCH", { ...body, revision: crypto.randomUUID() })).status, 409);
      shopOwner = await guest();
      assert.equal((await request(shopOwner, "/api/admin/shop", "PATCH", body)).status, 401);
      const result = await request(shopStaff, "/api/admin/shop", "PATCH", { ...body, address: "123 Store snapshot <img src=x onerror=alert(1)>",
        phone: "0901111111", deliveryFee: 23000, minimumSubtotal: 100000, announcement: "Synthetic shop announcement" });
      assert.equal(result.status, 200); shopView = result.data;
      assert.notEqual(shopView.settings.revision, "default");
      assert.deepEqual((await request("", "/api/shop")).data.settings, shopView.settings);
    });
    await check("checkout enforces shop revision, minimum and channel availability and snapshots accepted terms", async () => {
      const available = (await request(shopOwner, "/api/menu")).data.items[0];
      let basket = (await request(shopOwner, "/api/cart", "POST", { menuItemId: available.id, quantity: 1 })).data;
      const minimum = basket.cart.subtotal + 1;
      shopView = (await request(shopStaff, "/api/admin/shop", "PATCH", { ...shopFields(shopView), minimumSubtotal: minimum })).data;
      shopOrderInput = { cartId: basket.cart.id, cartSignature: basket.signature, customerName: "Synthetic shop owner", phone: "0901234567",
        fulfillment: "delivery", address: "123 Synthetic delivery address", expectedTotal: basket.cart.subtotal + 23000,
        idempotencyKey: crypto.randomUUID(), confirm: true, shopRevision: shopView.settings.revision };
      assert.equal((await request(shopOwner, "/api/orders", "POST", { ...shopOrderInput, shopRevision: "default" })).data.code, "SHOP_CHANGED");
      assert.equal((await request(shopOwner, "/api/orders", "POST", shopOrderInput)).data.code, "MINIMUM_ORDER");
      basket = (await request(shopOwner, "/api/cart", "POST", { menuItemId: available.id, quantity: 1 })).data;
      shopOrderInput = { ...shopOrderInput, cartSignature: basket.signature, expectedTotal: basket.cart.subtotal + 23000 };
      const created = await request(shopOwner, "/api/orders", "POST", shopOrderInput);
      assert.equal(created.status, 201); shopOrder = created.data;
      assert.equal(shopOrder.deliveryFee, 23000); assert.equal(shopOrder.store.address, shopView.settings.address);
      shopView = (await request(shopStaff, "/api/admin/shop", "PATCH", { ...shopFields(shopView), address: "456 New pickup location", deliveryFee: 31000, deliveryEnabled: false })).data;
      basket = (await request(shopOwner, "/api/cart", "POST", { menuItemId: available.id, quantity: 2 })).data;
      shopPending = { ...shopOrderInput, cartId: basket.cart.id, cartSignature: basket.signature,
        expectedTotal: basket.cart.subtotal + 31000, idempotencyKey: crypto.randomUUID(), shopRevision: shopView.settings.revision };
      assert.equal((await request(shopOwner, "/api/orders", "POST", shopPending)).data.code, "SHOP_CLOSED");
      shopView = (await request(shopStaff, "/api/admin/shop", "PATCH", { ...shopFields(shopView), acceptingOrders: false })).data;
      assert.equal((await request(shopOwner, "/api/orders", "POST", { ...shopPending, fulfillment: "pickup", expectedTotal: basket.cart.subtotal, shopRevision: shopView.settings.revision })).data.code, "SHOP_CLOSED");
      assert.equal((await request(shopOwner, "/api/cart")).data.items[0].quantity, 2);
      const replay = await request(shopOwner, "/api/orders", "POST", shopOrderInput);
      assert.equal(replay.status, 201); assert.deepEqual(replay.data, shopOrder);
      assert.equal((await request(shopStaff, "/api/admin/orders", "PATCH", { orderId: shopOrder.id, expectedStatus: "CONFIRMED", nextStatus: "PREPARING" })).status, 200);
    });
    await check("weekly shop closures and public settings survive restart while old receipts keep their store snapshot", async () => {
      shopView = (await request(shopStaff, "/api/admin/shop", "PATCH", { ...shopFields(shopView), acceptingOrders: true, deliveryEnabled: true,
        scheduleEnabled: true, hours: shopView.settings.hours.map(day => ({ ...day, closed: true })) })).data;
      const rejected = await request(shopOwner, "/api/orders", "POST", { ...shopPending, shopRevision: shopView.settings.revision });
      assert.equal(rejected.status, 409); assert.equal(rejected.data.code, "SHOP_CLOSED");
      assert.equal((await request(shopOwner, "/api/orders")).data.orders.length, 1);
      await stop(); await start();
      const restored = (await request("", "/api/shop")).data;
      assert.deepEqual(restored.settings, shopView.settings); assert.equal(restored.availability.canDelivery, false);
      const detail = (await request(shopOwner, "/api/orders?orderId=" + shopOrder.id)).data;
      assert.equal(detail.store.address, shopOrder.store.address); assert.equal(detail.deliveryFee, 23000);
      const receipt = await fetch(base + "/orders/" + shopOrder.id + "/receipt", { headers: { Cookie: shopOwner } });
      assert.equal(receipt.status, 200);
      const html = await receipt.text(); assert.ok(html.includes("123 Store snapshot &lt;img")); assert.ok(!html.includes("456 New pickup location"));
    });
    let feedbackOwner, feedbackOrder, feedbackPendingOrder, feedbackStaff, feedbackRecord;
    const privateFeedback = 'PRIVATE_FEEDBACK_MARKER <img src=x onerror=alert(1)>';
    const privateReply = 'PRIVATE_FEEDBACK_REPLY Cảm ơn bạn đã chia sẻ.';
    await check("customer feedback requires an owned completed order and validates private input", async () => {
      feedbackStaff = (await request("", "/api/admin/auth", "POST", { password: adminPassword })).cookie;
      const current = (await request("", "/api/shop")).data;
      const open = await request(feedbackStaff, "/api/admin/shop", "PATCH", { ...shopFields(current), acceptingOrders: true,
        pickupEnabled: true, deliveryEnabled: true, scheduleEnabled: false, minimumSubtotal: 0 });
      assert.equal(open.status, 200);
      feedbackOwner = await guest();
      const available = (await request(feedbackOwner, "/api/menu")).data.items[0];
      const place = async () => {
        const basket = (await request(feedbackOwner, "/api/cart", "POST", { menuItemId: available.id, quantity: 1 })).data;
        const created = await request(feedbackOwner, "/api/orders", "POST", { cartId: basket.cart.id, cartSignature: basket.signature,
          customerName: "PRIVATE_FEEDBACK_CUSTOMER", phone: "0901234567", fulfillment: "pickup", expectedTotal: basket.cart.subtotal,
          idempotencyKey: crypto.randomUUID(), confirm: true, shopRevision: open.data.settings.revision });
        assert.equal(created.status, 201); return created.data;
      };
      feedbackOrder = await place(); feedbackPendingOrder = await place();
      for (const [expectedStatus, nextStatus] of [["CONFIRMED", "PREPARING"], ["PREPARING", "READY"], ["READY", "COMPLETED"]])
        assert.equal((await request(feedbackStaff, "/api/admin/orders", "PATCH", { orderId: feedbackOrder.id, expectedStatus, nextStatus })).status, 200);
      const route = "/api/orders/feedback", query = route + "?orderId=" + feedbackOrder.id;
      assert.equal((await request("", query)).status, 401);
      assert.equal((await request(await guest(), query)).status, 404);
      assert.equal((await request(feedbackOwner, route + "?orderId=" + feedbackPendingOrder.id)).data.eligible, false);
      assert.equal((await request(feedbackOwner, route, "POST", { orderId: feedbackPendingOrder.id, rating: 5 })).status, 409);
      for (const changed of [{ rating: 0 }, { rating: 6 }, { rating: 1.5 }, { comment: "x".repeat(1001) }, { userId: "forged" }])
        assert.equal((await request(feedbackOwner, route, "POST", { orderId: feedbackOrder.id, rating: 5, ...changed })).status, 400);
      assert.equal((await request(feedbackOwner, route, "POST", { orderId: feedbackOrder.id, rating: 5 }, { Origin: "https://other.invalid" })).status, 403);
      assert.equal((await request(feedbackOwner, route, "POST", { orderId: feedbackOrder.id, rating: 5 }, { "X-KFC-Owner": "wrong-owner" })).status, 409);
      const saved = await request(feedbackOwner, route, "POST", { orderId: feedbackOrder.id, rating: 5, comment: privateFeedback });
      assert.equal(saved.status, 200); feedbackRecord = saved.data;
      const response = await fetch(base + query, { headers: { Cookie: feedbackOwner } });
      assert.match(response.headers.get("cache-control"), /no-store/);
      assert.equal((await response.json()).feedback.revision, feedbackRecord.revision);
    });
    await check("merchant feedback inbox filters private reviews and replies once without overwriting customer context", async () => {
      const route = "/api/orders/feedback", baseInput = { orderId: feedbackOrder.id, rating: 5, comment: privateFeedback };
      assert.deepEqual((await request(feedbackOwner, route, "POST", baseInput)).data, feedbackRecord);
      assert.equal((await request(feedbackOwner, route, "POST", { ...baseInput, rating: 4 })).status, 409);
      const edited = await request(feedbackOwner, route, "POST", { ...baseInput, rating: 4, revision: feedbackRecord.revision });
      assert.equal(edited.status, 200);
      assert.equal((await request(feedbackOwner, "/api/admin/feedback")).status, 401);
      for (const query of ["rating=6", "unknown=1", "response=pending&response=replied"])
        assert.equal((await request(feedbackStaff, "/api/admin/feedback?" + query)).status, 400);
      const inbox = (await request(feedbackStaff, "/api/admin/feedback?rating=4&response=pending")).data;
      assert.equal(inbox.matchedFeedbacks, 1); assert.equal(inbox.averageRating, 4); assert.equal(inbox.unanswered, 1);
      assert.ok(!JSON.stringify(inbox).includes("PRIVATE_FEEDBACK_CUSTOMER"));
      assert.equal((await request(feedbackStaff, "/api/admin/feedback?rating=5")).data.matchedFeedbacks, 0);
      const reply = { orderId: feedbackOrder.id, revision: edited.data.revision, message: privateReply };
      assert.equal((await request(feedbackOwner, "/api/admin/feedback", "POST", reply)).status, 401);
      assert.equal((await request(feedbackStaff, "/api/admin/feedback", "POST", { ...reply, revision: feedbackRecord.revision })).status, 409);
      const replied = await request(feedbackStaff, "/api/admin/feedback", "POST", reply);
      assert.equal(replied.status, 200); feedbackRecord = replied.data;
      assert.deepEqual((await request(feedbackStaff, "/api/admin/feedback", "POST", reply)).data, feedbackRecord);
      assert.equal((await request(feedbackStaff, "/api/admin/feedback", "POST", { ...reply, message: "Other reply after publish" })).status, 409);
      assert.equal((await request(feedbackOwner, route, "POST", { ...baseInput, rating: 3, revision: feedbackRecord.revision })).status, 409);
      assert.deepEqual((await request(feedbackOwner, route, "POST", { ...baseInput, rating: 4 })).data, feedbackRecord);
      assert.equal((await request(feedbackStaff, "/api/admin/feedback?response=replied")).data.matchedFeedbacks, 1);
      assert.ok(!JSON.stringify((await request("", "/api/menu")).data).includes("PRIVATE_FEEDBACK_MARKER"));
      assert.ok(!JSON.stringify((await request("", "/api/shop")).data).includes("PRIVATE_FEEDBACK_REPLY"));
    });
    await check("private feedback and reply survive restart without changing order money or status events", async () => {
      await stop(); await start();
      const restored = await request(feedbackOwner, "/api/orders/feedback?orderId=" + feedbackOrder.id);
      assert.deepEqual(restored.data.feedback, feedbackRecord);
      const detail = (await request(feedbackOwner, "/api/orders?orderId=" + feedbackOrder.id)).data;
      assert.equal(detail.status, "COMPLETED"); assert.equal(detail.total, feedbackOrder.total); assert.equal(detail.events.length, 4);
      assert.deepEqual(detail.items, feedbackOrder.items);
      feedbackStaff = (await request("", "/api/admin/auth", "POST", { password: adminPassword })).cookie;
      const inbox = (await request(feedbackStaff, "/api/admin/feedback")).data;
      assert.equal(inbox.entries[0].feedback.reply.message, privateReply);
      assert.equal((await request(await guest(), "/api/orders/feedback?orderId=" + feedbackOrder.id)).status, 404);
    });
    await check("cart snapshot guards reject stale quantity, add, removal and clearing without overwriting newer intent", async () => {
      const owner = await guest();
      const menuItem = (await request(owner, "/api/menu")).data.items[0];
      const header = signature => ({ "X-KFC-Cart-Signature": signature });
      const first = await request(owner, "/api/cart", "POST", { menuItemId: menuItem.id, quantity: 1 }, header("empty"));
      assert.equal(first.status, 201); assert.match(first.data.cart.revision, /^[a-f0-9-]{36}$/);
      const old = first.data;
      const changed = await request(owner, "/api/cart", "PATCH", { itemId: old.items[0].id, quantity: 2 }, header(old.signature));
      assert.equal(changed.status, 200); assert.notEqual(changed.data.signature, old.signature);
      assert.notEqual(changed.data.cart.revision, old.cart.revision);
      for (const [route, method, body] of [
        ["/api/cart", "PATCH", { itemId: old.items[0].id, quantity: 1 }],
        ["/api/cart", "POST", { menuItemId: menuItem.id, quantity: 1 }],
        ["/api/cart?itemId=" + old.items[0].id, "DELETE", undefined],
        ["/api/cart", "DELETE", undefined],
      ]) {
        const stale = await request(owner, route, method, body, header(old.signature));
        assert.equal(stale.status, 409); assert.equal(stale.data.code, "CART_CHANGED");
      }
      const invalid = await request(owner, "/api/cart", "DELETE", undefined, header("not-a-signature"));
      assert.equal(invalid.status, 400); assert.equal(invalid.data.code, "INVALID_CART_SNAPSHOT");
      assert.equal((await request(owner, "/api/cart")).data.items[0].quantity, 2);
      const sameIntent = await Promise.all([1, 2].map(() => request(owner, "/api/cart", "POST", { menuItemId: menuItem.id, quantity: 1 }, header(changed.data.signature))));
      assert.deepEqual(sameIntent.map(result => result.status).sort(), [201, 409]);
      const current = (await request(owner, "/api/cart")).data;
      assert.equal(current.items[0].quantity, 3);
      const cleared = await request(owner, "/api/cart", "DELETE", undefined, header(current.signature));
      assert.equal(cleared.status, 200); assert.equal(cleared.data.items.length, 0); assert.equal(cleared.data.cart.total, 0);
      assert.equal((await request(owner, "/api/cart", "POST", { menuItemId: menuItem.id, quantity: 1 }, header("empty"))).status, 409);
      assert.equal((await request(owner, "/api/cart", "POST", { menuItemId: menuItem.id, quantity: 1 }, header(cleared.data.signature))).status, 201);
    });
    await check("a lost cart acknowledgement cannot be replayed against the old snapshot and revisions survive restart", async () => {
      const owner = await guest();
      const menuItem = (await request(owner, "/api/menu")).data.items[0];
      const body = { menuItemId: menuItem.id, quantity: 1 };
      const original = await request(owner, "/api/cart", "POST", body, { "X-KFC-Cart-Signature": "empty" });
      assert.equal(original.status, 201);
      const retry = await request(owner, "/api/cart", "POST", body, { "X-KFC-Cart-Signature": "empty" });
      assert.equal(retry.status, 409); assert.equal(retry.data.code, "CART_CHANGED");
      await stop(); await start();
      const restored = (await request(owner, "/api/cart")).data;
      assert.equal(restored.cart.revision, original.data.cart.revision);
      assert.equal(restored.signature, original.data.signature); assert.deepEqual(restored.items, original.data.items);
      const forged = await request(owner, "/api/cart", "POST", body, { "X-KFC-Cart-Signature": restored.signature, "X-KFC-Owner": "wrong-owner" });
      assert.equal(forged.status, 409); assert.equal(forged.data.code, "IDENTITY_CHANGED");
      assert.equal((await request(owner, "/api/cart")).data.items[0].quantity, 1);
      const explicit = await request(owner, "/api/cart", "POST", body, { "X-KFC-Cart-Signature": restored.signature });
      assert.equal(explicit.status, 201); assert.equal(explicit.data.items[0].quantity, 2);
    });
    let editorStaff, editedMenu, editedCategory;
    await check("staff catalog revisions reject stale editors, accept exact replay and preserve legacy PATCH callers", async () => {
      editorStaff = (await request("", "/api/admin/auth", "POST", { password: adminPassword })).cookie;
      const catalog = (await request(editorStaff, "/api/admin/menu")).data;
      const item = catalog.items[0];
      const fields = { itemId: item.id, name: item.name, description: item.description ?? "", categoryId: item.categoryId,
        price: item.price + 1000, isActive: item.isActive, isAvailable: item.isAvailable, imageUrl: item.imageUrl.replace(/\.png$/, ".svg") };
      const headers = { "X-KFC-Catalog-Revision": item.catalogRevision };
      assert.match(item.catalogRevision, /^[a-f0-9]{64}$/);
      const saved = await request(editorStaff, "/api/admin/menu", "PATCH", fields, headers);
      assert.equal(saved.status, 200);
      const auditCount = (await request(editorStaff, "/api/admin/catalog-audit")).data.entries.length;
      const replay = await request(editorStaff, "/api/admin/menu", "PATCH", fields, headers);
      assert.deepEqual(replay, saved);
      assert.equal((await request(editorStaff, "/api/admin/catalog-audit")).data.entries.length, auditCount);
      const stale = await request(editorStaff, "/api/admin/menu", "PATCH", { ...fields, price: item.price, description: "Old editor draft" }, headers);
      assert.equal(stale.status, 409); assert.equal(stale.data.code, "CATALOG_CHANGED");
      assert.equal((await request(editorStaff, "/api/admin/menu")).data.items.find(entry => entry.id === item.id).price, fields.price);
      assert.equal((await request(editorStaff, "/api/admin/catalog-audit")).data.entries.length, auditCount);
      for (const invalid of ["", "bad", "A".repeat(64)]) {
        const bad = await request(editorStaff, "/api/admin/menu", "PATCH", fields, { "X-KFC-Catalog-Revision": invalid });
        assert.equal(bad.status, 400); assert.equal(bad.data.code, "INVALID_CATALOG_REVISION");
      }
      const crossEntity = await request(editorStaff, "/api/admin/menu", "PATCH", { ...fields, price: fields.price + 1000 }, { "X-KFC-Catalog-Revision": catalog.categories[0].catalogRevision });
      assert.equal(crossEntity.status, 409);
      const legacy = await request(editorStaff, "/api/admin/menu", "PATCH", { ...fields, description: "Legacy API update without header" });
      assert.equal(legacy.status, 200);
      editedMenu = (await request(editorStaff, "/api/admin/menu")).data.items.find(entry => entry.id === item.id);
      const category = catalog.categories[0];
      const alternatives = ["First category editor", "Second category editor"].map(name => ({ categoryId: category.id, name, description: category.description ?? "", displayOrder: category.displayOrder, isActive: category.isActive }));
      const outcomes = await Promise.all(alternatives.map(body => request(editorStaff, "/api/admin/categories", "PATCH", body, { "X-KFC-Catalog-Revision": category.catalogRevision })));
      assert.deepEqual(outcomes.map(result => result.status).sort(), [200, 409]);
      const winner = outcomes.findIndex(result => result.status === 200);
      const count = (await request(editorStaff, "/api/admin/catalog-audit")).data.entries.length;
      assert.equal((await request(editorStaff, "/api/admin/categories", "PATCH", alternatives[winner], { "X-KFC-Catalog-Revision": category.catalogRevision })).status, 200);
      assert.equal((await request(editorStaff, "/api/admin/catalog-audit")).data.entries.length, count);
      editedCategory = (await request(editorStaff, "/api/admin/categories")).data.categories.find(entry => entry.id === category.id);
      assert.equal(editedCategory.name, alternatives[winner].name);
      assert.notEqual(editedCategory.catalogRevision, category.catalogRevision);
      assert.equal((await request("", "/api/admin/menu", "PATCH", fields, headers)).status, 401);
    });
    await check("catalog versions are reproducible after restart and staff reads do not persist DTO revision fields", async () => {
      await stop(); await start();
      const login = await request("", "/api/admin/auth", "POST", { password: adminPassword });
      assert.equal(login.status, 200);
      editorStaff = login.cookie;
      const fs = require("node:fs");
      const source = path.join(dataDirectory, "store.json");
      const before = fs.readFileSync(source);
      const catalog = (await request(editorStaff, "/api/admin/menu")).data;
      const categories = (await request(editorStaff, "/api/admin/categories")).data.categories;
      assert.equal(catalog.items.find(item => item.id === editedMenu.id).catalogRevision, editedMenu.catalogRevision);
      assert.equal(categories.find(category => category.id === editedCategory.id).catalogRevision, editedCategory.catalogRevision);
      assert.ok(before.equals(fs.readFileSync(source)));
      assert.ok(!before.toString("utf8").includes('"catalogRevision"'));
    });
    await check("HTTPS reverse-proxy headers preserve secure cookies and same-origin writes on a forwarded CloudFront host", async () => {
      // Raw HTTP preserves Host exactly as Nginx does. Node fetch may rewrite it.
      const proxy = (route, method = "GET", body, cookie, origin = "https://dsynthetic.cloudfront.net") => new Promise((resolve, reject) => {
        const outgoing = require("node:http").request({ hostname: "localhost", port: 3197, path: route, method,
          headers: { Host: "dsynthetic.cloudfront.net", "X-Forwarded-Proto": "https", Origin: origin,
            "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) } }, response => {
          let text = "";
          response.on("data", chunk => text += chunk);
          response.on("end", () => {
            try { resolve({ status: response.statusCode, data: JSON.parse(text), cookie: response.headers["set-cookie"]?.[0] }); }
            catch (error) { reject(error); }
          });
        });
        outgoing.on("error", reject);
        if (body) outgoing.write(JSON.stringify(body));
        outgoing.end();
      });
      const guest = await proxy("/api/session");
      assert.equal(guest.status, 200); assert.match(guest.cookie, /; Secure/i);
      const cookie = guest.cookie.split(";")[0];
      const available = (await request(cookie, "/api/menu")).data.items[0];
      assert.equal((await proxy("/api/cart", "POST", { menuItemId: available.id, quantity: 1 }, cookie)).status, 201);
      assert.equal((await proxy("/api/cart", "DELETE", undefined, cookie, "https://different.invalid")).status, 403);
      const staff = await proxy("/api/admin/auth", "POST", { password: adminPassword });
      assert.equal(staff.status, 200); assert.match(staff.cookie, /; Secure/i);
    });
    console.log(
      `${checks} HTTP integration checks passed, including local persistence across restart. No AWS calls. Data: ${dataDirectory}`,
    );
  } finally {
    await stop();
  }
}
main().catch((error) => {
  console.error(error);
  console.error(output);
  process.exitCode = 1;
});
