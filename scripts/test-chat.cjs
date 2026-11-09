/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS loader is needed to transpile and resolve app aliases in this offline test process. */
// Transpile the application in memory using the installed TypeScript compiler.
// This keeps the regression suite offline and uses the real mock services/tools.
require("./register-typescript.cjs");
const assert = require("node:assert/strict");
process.env.AI_PROVIDER = "mock";
process.env.PERSISTENCE_DRIVER = "mock";
process.env.SESSION_SECRET =
  "synthetic-reorder-unit-signing-key-no-real-data-2026";
const { services } = require("../src/lib/agent/agent-core.ts");
let count = 0;
async function check(label, run) {
  await run();
  console.log(`PASS ${++count}: ${label}`);
}
async function main() {
  const userId = `regression_${crypto.randomUUID()}`;
  const seen = new Map();
  const send = async (message, confirm = false, user = userId) => {
    const reply = await services.chatService.processChat({
      platform: "web",
      userId: user,
      sessionId: "regression",
      message,
      confirm,
      confirmationId: confirm
        ? (seen.get(user) ?? crypto.randomUUID())
        : undefined,
    });
    if (reply.pendingConfirmation) seen.set(user, reply.pendingConfirmation.id);
    return reply;
  };
  const menu = await services.menuService.getAvailableMenuItems();
  assert.ok(menu.length > 0);
  const item =
    menu.find((entry) => entry.name.toLowerCase().includes("pepsi")) ?? menu[0];
  let sessionId;
  await check(
    "menu replies include authoritative names and prices",
    async () => {
      const reply = await send("Cho mình xem thực đơn");
      assert.ok(reply.reply.includes(item.name));
      assert.ok(reply.reply.includes("₫"));
      sessionId = reply.sessionId;
    },
  );
  await check(
    "proposal does not mutate cart and resolves a concrete item ID",
    async () => {
      const reply = await send(`Thêm 2 ${item.name} vào giỏ hàng`);
      assert.equal(reply.requiresConfirmation, true);
      assert.equal(reply.actions[0].parameters.itemId, item.id);
      assert.equal(await services.cartService.getCartView(userId), null);
    },
  );
  await check(
    "confirmation executes the stored proposal, ignoring new message content",
    async () => {
      const reply = await send("Thêm 99 món khác vào giỏ hàng", true);
      assert.equal(reply.requiresConfirmation, false);
      assert.ok(reply.execution[0].executed);
      const view = await services.cartService.getCartView(userId);
      assert.equal(view.items[0].quantity, 2);
      assert.equal(view.items[0].menuItemId, item.id);
      assert.equal(view.cart.total, item.price * 2);
    },
  );
  await check(
    "sequential duplicate confirmation cannot replay a mutation",
    async () => {
      const reply = await send("Xác nhận", true);
      assert.equal(reply.execution.length, 0);
      assert.equal(
        (await services.cartService.getCartView(userId)).items[0].quantity,
        2,
      );
    },
  );
  await check("cart reply shows line items and total", async () => {
    const reply = await send("Xem giỏ hàng");
    assert.ok(reply.reply.includes(item.name));
    assert.ok(reply.reply.includes("Tổng cộng"));
  });
  await check("unknown item and excessive quantity are blocked", async () => {
    for (const message of [
      "Thêm 2 xyznonexistent vào giỏ hàng",
      `Thêm 101 ${item.name} vào giỏ hàng`,
    ]) {
      const reply = await send(message);
      assert.equal(reply.requiresConfirmation, false);
      assert.ok(reply.execution.every((entry) => !entry.executed));
    }
  });
  await check(
    "another customer cannot confirm this customer's proposal",
    async () => {
      await send(`Thêm 1 ${item.name} vào giỏ hàng`);
      const reply = await send("Xác nhận", true, `${userId}_other`);
      assert.equal(reply.execution.length, 0);
      assert.equal(
        await services.cartService.getCartView(`${userId}_other`),
        null,
      );
    },
  );
  await check("a new request invalidates an earlier proposal", async () => {
    await send("Xem giỏ hàng");
    const reply = await send("Xác nhận", true);
    assert.equal(reply.execution.length, 0);
  });
  await check(
    "remove by name resolves the cart line and requires confirmation",
    async () => {
      const reply = await send(`Xoá ${item.name} khỏi giỏ hàng`);
      assert.equal(reply.requiresConfirmation, true);
      const result = await send("Xác nhận", true);
      assert.ok(result.execution[0].executed);
      assert.equal(
        (await services.cartService.getCartView(userId)).items.length,
        0,
      );
    },
  );
  await check(
    "clear entire cart maps to CLEAR_CART, then clears after confirmation",
    async () => {
      await send(`Thêm 1 ${item.name} vào giỏ hàng`);
      await send("Xác nhận", true);
      const reply = await send("Xoá toàn bộ giỏ hàng");
      assert.equal(reply.actions[0].type, "CLEAR_CART");
      assert.equal(reply.requiresConfirmation, true);
      await send("Xác nhận", true);
      assert.equal(
        (await services.cartService.getCartView(userId)).items.length,
        0,
      );
    },
  );
  await check(
    "conversation history accumulates and stays within ten turns",
    async () => {
      const saved =
        await services.sessionService.getConversationContext(sessionId);
      assert.equal(saved.context.turns.length, 10);
      assert.ok(
        saved.context.turns.some((turn) => turn.content.includes("toàn bộ")),
      );
    },
  );
  await check(
    "menu price changes refresh the basket and reject an outdated checkout",
    async () => {
      await services.cartService.addMenuItem(userId, item, 1);
      const previous = await services.cartService.getCartView(userId);
      const originalPrice = item.price;
      try {
        item.price = originalPrice + 1000;
        const updated = await services.cartService.getCartView(userId);
        assert.equal(updated.cart.total, item.price);
        assert.notEqual(previous.signature, updated.signature);
        const input = {
          cartId: previous.cart.id,
          cartSignature: previous.signature,
          customerName: "Khách Test",
          phone: "0901234567",
          fulfillment: "pickup",
          address: "",
          note: "",
          idempotencyKey: crypto.randomUUID(),
          expectedTotal: originalPrice,
          confirm: true,
        };
        await assert.rejects(
          () => services.checkoutService.checkout(userId, input),
          (error) => error.code === "CART_CHANGED",
        );
        const order = await services.checkoutService.checkout(userId, {
          ...input,
          cartSignature: updated.signature,
          expectedTotal: item.price,
        });
        assert.equal(order.total, item.price);
        assert.equal(
          (await services.checkoutService.detail(userId, order.id)).items[0]
            .unitPrice,
          item.price,
        );
      } finally {
        item.price = originalPrice;
      }
    },
  );
  const naturalUser = `natural_${crypto.randomUUID()}`;
  const natural = (message, confirm = false) =>
    send(message, confirm, naturalUser);
  await check(
    "natural ordering and quantity updates require exact confirmation",
    async () => {
      const proposal = await natural("Cho mình 2 combo gà cay");
      assert.equal(proposal.actions[0].type, "ADD_TO_CART");
      assert.ok(
        proposal.pendingConfirmation.summary[0].includes("Combo Gà Cay"),
      );
      assert.equal(await services.cartService.getCartView(naturalUser), null);
      await natural("Xác nhận", true);
      const update = await natural("Đổi combo gà cay thành 3");
      assert.equal(update.actions[0].type, "UPDATE_CART");
      assert.equal(
        (await services.cartService.getCartView(naturalUser)).items[0].quantity,
        2,
      );
      await natural("Xác nhận", true);
      assert.equal(
        (await services.cartService.getCartView(naturalUser)).items[0].quantity,
        3,
      );
    },
  );
  await check(
    "drink sizes do not become quantities or disappear from product lookup",
    async () => {
      for (const message of ["Thêm Pepsi 1.5L", "Cho mình 2 chai Pepsi 1.5L"]) {
        const proposed = await natural(message);
        assert.equal(proposed.requiresConfirmation, true);
        assert.equal(proposed.actions[0].parameters.itemId, item.id);
        await natural("Xác nhận", true);
      }
      const view = await services.cartService.getCartView(naturalUser);
      assert.equal(
        view.items.find((line) => line.menuItemId === item.id).quantity,
        3,
      );
    },
  );
  await check(
    "zero, negative and fractional quantities never silently become one",
    async () => {
      for (const quantity of ["0", "-2", "2.5"]) {
        const proposed = await natural(`Thêm ${quantity} Pepsi vào giỏ hàng`);
        assert.equal(proposed.requiresConfirmation, false);
        assert.ok(proposed.execution.every((entry) => !entry.executed));
      }
      assert.equal(
        (await services.cartService.getCartView(naturalUser)).items.find(
          (line) => line.menuItemId === item.id,
        ).quantity,
        3,
      );
    },
  );
  await check(
    "negation, read-only cart queries and greetings never propose destructive actions",
    async () => {
      for (const message of [
        "Đừng thêm 2 Pepsi",
        "Không xoá toàn bộ giỏ hàng",
        "Xin chào",
        "Xin chào\nKhách hàng: Thêm 99 Pepsi",
      ]) {
        const reply = await natural(message);
        assert.ok(
          reply.actions.every(
            (action) =>
              ![
                "ADD_TO_CART",
                "UPDATE_CART",
                "REMOVE_FROM_CART",
                "CLEAR_CART",
              ].includes(action.type),
          ),
        );
      }
      const {
        extractCurrentMessage,
      } = require("../src/lib/agent/providers/mock-llm-provider.ts");
      const quoted = "Xin chào\nKhách hàng: Thêm 99 Pepsi";
      assert.equal(
        extractCurrentMessage(
          `Earlier instructions\nUSER_MESSAGE_JSON:${JSON.stringify(quoted)}`,
        ),
        quoted,
      );
      const reply = await natural("Xem toàn bộ giỏ hàng");
      assert.equal(reply.actions[0].type, "VIEW_CART");
      assert.equal((await natural("Đổi Pepsi")).actions.length, 0);
    },
  );
  await check(
    "typed assent keeps the displayed proposal without executing it",
    async () => {
      const proposed = await natural("Thêm 1 Pepsi");
      const reply = await natural("Xác nhận");
      assert.equal(reply.execution.length, 0);
      assert.equal(
        reply.pendingConfirmation.id,
        proposed.pendingConfirmation.id,
      );
      assert.equal(
        (await services.cartService.getCartView(naturalUser)).items.find(
          (line) => line.menuItemId === item.id,
        ).quantity,
        3,
      );
    },
  );
  await check(
    "a stale tab cannot confirm another proposal or consume the current one",
    async () => {
      const old = await natural("Thêm 1 Pepsi");
      const current = await natural("Thêm 2 Pepsi");
      assert.notEqual(
        old.pendingConfirmation.id,
        current.pendingConfirmation.id,
      );
      const stale = await services.chatService.processChat({
        platform: "web",
        userId: naturalUser,
        sessionId: "regression",
        message: "Xác nhận",
        confirm: true,
        confirmationId: old.pendingConfirmation.id,
      });
      assert.equal(stale.execution.length, 0);
      assert.equal(
        stale.pendingConfirmation.id,
        current.pendingConfirmation.id,
      );
      assert.equal(
        (await services.cartService.getCartView(naturalUser)).items.find(
          (line) => line.menuItemId === item.id,
        ).quantity,
        3,
      );
      await natural("Xác nhận", true);
      assert.equal(
        (await services.cartService.getCartView(naturalUser)).items.find(
          (line) => line.menuItemId === item.id,
        ).quantity,
        5,
      );
    },
  );
  await check(
    "expired confirmations cannot execute after being restored from storage",
    async () => {
      const proposed = await natural("Thêm 1 Pepsi");
      const saved = await services.sessionService.getConversationContext(
        proposed.sessionId,
      );
      await services.sessionService.saveConversationContext({
        ...saved,
        context: {
          ...saved.context,
          pendingConfirmation: {
            ...saved.context.pendingConfirmation,
            expiresAt: new Date(Date.now() - 1).toISOString(),
          },
        },
      });
      const reply = await natural("Xác nhận", true);
      assert.equal(reply.requiresConfirmation, false);
      assert.equal(reply.execution.length, 0);
    },
  );
  await check(
    "confirmation is invalidated if menu prices changed since the preview",
    async () => {
      await natural("Thêm 1 Pepsi");
      const originalPrice = item.price;
      try {
        item.price += 1000;
        const reply = await natural("Xác nhận", true);
        assert.equal(reply.requiresConfirmation, false);
        assert.equal(reply.execution.length, 0);
        assert.ok(reply.reply.includes("giá đã thay đổi"));
        assert.equal(
          (await services.cartService.getCartView(naturalUser)).items.find(
            (line) => line.menuItemId === item.id,
          ).quantity,
          5,
        );
      } finally {
        item.price = originalPrice;
      }
    },
  );
  await check(
    "network, timeout and non-JSON responses have useful customer messages",
    async () => {
      const originalFetch = global.fetch;
      const { api } = require("../src/lib/storefront-types.ts");
      try {
        global.fetch = async () =>
          new Response("<html>Unavailable</html>", { status: 502 });
        await assert.rejects(() => api("/test"), /Máy chủ tạm thời/);
        global.fetch = async () => {
          throw new TypeError("fetch failed");
        };
        await assert.rejects(() => api("/test"), /kiểm tra mạng/);
        global.fetch = async () => {
          throw Object.assign(new Error("slow"), { name: "TimeoutError" });
        };
        await assert.rejects(() => api("/test"), /kiểm tra lịch sử/);
        global.fetch = async () =>
          Response.json({ error: "Thông báo từ server" }, { status: 400 });
        await assert.rejects(() => api("/test"), /Thông báo từ server/);
      } finally {
        global.fetch = originalFetch;
      }
    },
  );
  await check(
    "partial removals require clarification and absolute increases use UPDATE_CART",
    async () => {
      const partial = await natural("Xoá 2 Pepsi khỏi giỏ hàng");
      assert.equal(partial.actions.length, 0);
      const increase = await natural("Tăng Pepsi lên 6");
      assert.equal(increase.actions[0].type, "UPDATE_CART");
      assert.equal(increase.actions[0].parameters.quantity, 6);
      assert.equal(increase.requiresConfirmation, true);
    },
  );
  await check(
    "a full cart can merge an existing line while rejecting a new one",
    async () => {
      const {
        MockCartRepository,
      } = require("../src/lib/db/repositories/implementations/mock-repository.ts");
      const { CartService } = require("../src/lib/services/cart-service.ts");
      const repository = new MockCartRepository();
      const carts = new CartService(repository);
      const owner = `limit_${crypto.randomUUID()}`;
      for (let index = 0; index < 50; index++)
        await carts.addMenuItem(owner, { ...item, id: `fixture_${index}` }, 1);
      const merged = await carts.addMenuItem(
        owner,
        { ...item, id: "fixture_0" },
        1,
      );
      assert.equal(merged.items.length, 50);
      assert.equal(
        merged.items.find((line) => line.menuItemId === "fixture_0").quantity,
        2,
      );
      await assert.rejects(
        () => carts.addMenuItem(owner, { ...item, id: "fixture_50" }, 1),
        (error) => error.code === "CART_LIMIT",
      );
    },
  );
  const { BedrockService } = require("../src/lib/aws/bedrock.ts");
  const {
    BedrockLLMProvider,
  } = require("../src/lib/agent/providers/bedrock-llm-provider.ts");
  const encodedReply = (content) => ({
    body: new TextEncoder().encode(
      JSON.stringify({
        content: [{ type: "text", text: content }],
        usage: { input_tokens: 10, output_tokens: 5 },
      }),
    ),
  });
  await check(
    "Bedrock refuses missing configuration without invoking a transport or fake success",
    async () => {
      let calls = 0;
      const client = {
        send: async () => {
          calls++;
          return encodedReply("fake");
        },
      };
      const service = new BedrockService({ modelId: "mock-model" }, client);
      const result = await service.generateResponse("system", "message");
      assert.equal(result.success, false);
      assert.equal(result.error.type, "validation_error");
      assert.equal(calls, 0);
    },
  );
  await check(
    "Bedrock protocol preserves zero settings, history, usage and an abort signal",
    async () => {
      let sent;
      const client = {
        send: async (command, options) => {
          sent = { command, options };
          return encodedReply("model text");
        },
      };
      const service = new BedrockService(
        {
          modelId: "anthropic.transport-fixture",
          temperature: 0,
          topP: 0,
          maxTokens: 64,
        },
        client,
      );
      const result = await service.generateResponse("system", "latest", [
        { role: "system", content: "not a customer turn" },
        { role: "user", content: "older" },
        { role: "assistant", content: "previous" },
      ]);
      assert.equal(result.success, true);
      assert.equal(result.response.usage.inputTokens, 10);
      const body = JSON.parse(sent.command.input.body);
      assert.equal(body.temperature, 0);
      assert.equal(body.top_p, 0);
      assert.equal(body.messages.length, 3);
      assert.equal(body.messages.at(-1).content[0].text, "latest");
      assert.ok(sent.options.abortSignal);
    },
  );
  await check(
    "Bedrock transport or malformed replies fail without a mock fallback",
    async () => {
      for (const client of [
        {
          send: async () => {
            throw new Error("fixture transport failed");
          },
        },
        { send: async () => ({ body: new TextEncoder().encode("not-json") }) },
        { send: async () => encodedReply("") },
      ]) {
        const result = await new BedrockService(
          { modelId: "anthropic.transport-fixture" },
          client,
        ).generateResponse("", "message");
        assert.equal(result.success, false);
      }
      const provider = new BedrockLLMProvider(
        new BedrockService(
          { modelId: "anthropic.transport-fixture" },
          {
            send: async () =>
              encodedReply("Đã thêm 99 món và thanh toán thành công"),
          },
        ),
      );
      const reply = await provider.generateResponse("", "message");
      assert.equal(reply.success, true);
      assert.equal(reply.response.actions.length, 0);
      assert.ok(!reply.response.message.includes("thanh toán thành công"));
    },
  );
  await check(
    "model success claims and invented prices never replace tool outcomes",
    async () => {
      const original = services.llmProvider;
      try {
        services.llmProvider = {
          generateResponse: async () => ({
            success: true,
            response: {
              message: "Đã thanh toán thành công",
              intent: "ADD_TO_CART",
              actions: [
                {
                  id: "fixture_add",
                  type: "ADD_TO_CART",
                  parameters: { itemId: item.id, quantity: 1 },
                  requiresConfirmation: false,
                },
              ],
              requiresConfirmation: false,
            },
          }),
        };
        const owner = `grounding_${crypto.randomUUID()}`;
        const proposal = await services.chatService.processChat({
          platform: "web",
          userId: owner,
          sessionId: "fixture",
          message: "test",
        });
        assert.equal(proposal.requiresConfirmation, true);
        assert.ok(!proposal.reply.includes("Đã thanh toán"));
        assert.equal(await services.cartService.getCartView(owner), null);
        services.llmProvider = {
          generateResponse: async () => ({
            success: true,
            response: {
              message: "Pepsi chỉ có giá 1 đồng",
              intent: "GET_MENU_ITEM",
              actions: [
                {
                  id: "fixture_get",
                  type: "GET_MENU_ITEM",
                  parameters: { itemId: item.id },
                  requiresConfirmation: false,
                },
              ],
              requiresConfirmation: false,
            },
          }),
        };
        const reply = await services.chatService.processChat({
          platform: "web",
          userId: owner,
          sessionId: "fixture",
          message: "test",
        });
        assert.ok(reply.reply.includes(item.name));
        assert.ok(!reply.reply.includes("1 đồng"));
        assert.ok(reply.reply.includes("₫"));
      } finally {
        services.llmProvider = original;
      }
    },
  );
  await check(
    "a new item's preview is invalidated by price or name changes even without a cart",
    async () => {
      for (const field of ["price", "name"]) {
        const owner = "preview_" + crypto.randomUUID();
        const proposed = await services.chatService.processChat({
          platform: "web",
          userId: owner,
          sessionId: "fixture",
          message: "Thêm 1 Pepsi",
        });
        assert.ok(proposed.pendingConfirmation);
        assert.equal(await services.cartService.getCartView(owner), null);
        const previous = item[field];
        try {
          item[field] = field === "price" ? previous + 1000 : previous + " mới";
          const reply = await services.chatService.processChat({
            platform: "web",
            userId: owner,
            sessionId: proposed.sessionId,
            message: "Xác nhận",
            confirm: true,
            confirmationId: proposed.pendingConfirmation.id,
          });
          assert.equal(reply.execution.length, 0);
          assert.equal(reply.requiresConfirmation, false);
          assert.equal(await services.cartService.getCartView(owner), null);
        } finally {
          item[field] = previous;
        }
      }
    },
  );
  await check(
    "structured model replies without supported actions cannot claim payment or order success",
    async () => {
      for (const actions of [
        [],
        [{ id: "unknown", type: "UNKNOWN", parameters: {} }],
      ]) {
        const provider = new BedrockLLMProvider(
          new BedrockService(
            { modelId: "anthropic.transport-fixture" },
            {
              send: async () =>
                encodedReply(
                  JSON.stringify({
                    message: "Đã thanh toán và đặt đơn thành công",
                    intent: "SUCCESS",
                    actions,
                    requiresConfirmation: false,
                  }),
                ),
            },
          ),
        );
        const response = await provider.generateResponse("", "test");
        assert.equal(response.success, true);
        assert.ok(!response.response.message.includes("thành công"));
        assert.equal(response.response.actions.length, 0);
        assert.equal(response.response.requiresConfirmation, false);
      }
    },
  );
  await check(
    "runtime system prompt matches its canonical Markdown and tool allowlist",
    async () => {
      const fs = require("node:fs");
      const path = require("node:path");
      const {
        systemPrompt,
      } = require("../src/lib/agent/prompts/system-prompt.ts");
      const canonicalPrompt = fs
        .readFileSync(
          path.join(__dirname, "../src/lib/agent/prompts/system-prompt.md"),
          "utf8",
        )
        .replace(/\r\n?/g, "\n");
      assert.equal(
        systemPrompt.replace(/\r\n?/g, "\n"),
        canonicalPrompt,
      );
      assert.ok(!systemPrompt.includes("CREATE_ORDER"));
    },
  );
  await check(
    "JSON limits count UTF-8 bytes, stop a chunked stream early and reject malformed input",
    async () => {
      const {
        readBoundedJson,
        MAX_JSON_BYTES,
      } = require("../src/lib/server/bounded-json.ts");
      const request = (body, headers) =>
        new Request("http://localhost/test", {
          method: "POST",
          body,
          headers,
          duplex: "half",
        });
      assert.equal(
        (
          await readBoundedJson(
            request('"' + "a".repeat(MAX_JSON_BYTES - 2) + '"'),
          )
        ).length,
        MAX_JSON_BYTES - 2,
      );
      await assert.rejects(
        () =>
          readBoundedJson(
            request(JSON.stringify({ message: "ế".repeat(6000) })),
          ),
        (error) => error.status === 413,
      );
      let reads = 0;
      let cancelled = false;
      const stream = new ReadableStream(
        {
          pull(controller) {
            reads++;
            controller.enqueue(new Uint8Array(8000));
          },
          cancel() {
            cancelled = true;
          },
        },
        { highWaterMark: 0 },
      );
      await assert.rejects(
        () => readBoundedJson(request(stream)),
        (error) => error.status === 413,
      );
      assert.equal(reads, 3);
      assert.equal(cancelled, true);
      await assert.rejects(
        () => readBoundedJson(request(new Uint8Array([0x22, 0xff, 0x22]))),
        (error) => error.status === 400,
      );
      await assert.rejects(
        () => readBoundedJson(request("{} trailing")),
        (error) => error.status === 400,
      );
      await assert.rejects(
        () => readBoundedJson(request("{}", { "Content-Length": "16001" })),
        (error) => error.status === 413,
      );
    },
  );
  await check(
    "order filters use inclusive Vietnam dates, normalized search and intersect all fields",
    async () => {
      const {
        filterOrders,
        orderDay,
        invalidDateRange,
      } = require("../src/lib/order-reporting.ts");
      const orders = [
        {
          id: "order_a",
          customerName: "Nguyễn Đăng",
          phone: "0901000001",
          status: "COMPLETED",
          fulfillment: "pickup",
          createdAt: "2026-11-05T17:00:00.000Z",
        },
        {
          id: "order_b",
          customerName: "Khách B",
          phone: "0901000002",
          status: "CANCELLED",
          fulfillment: "delivery",
          createdAt: "2026-11-05T16:59:59.999Z",
        },
        {
          id: "order_c",
          customerName: "Khách C",
          phone: "0901000003",
          status: "CONFIRMED",
          fulfillment: "pickup",
          createdAt: "2026-11-06T17:00:00.000Z",
        },
      ];
      const filters = {
        status: "all",
        fulfillment: "all",
        search: "",
        from: "2026-11-06",
        to: "2026-11-06",
      };
      assert.equal(orderDay(orders[0].createdAt), "2026-11-06");
      assert.deepEqual(
        filterOrders(orders, filters).map((order) => order.id),
        ["order_a"],
      );
      assert.equal(
        filterOrders(orders, {
          ...filters,
          search: "nguyen dang",
          status: "COMPLETED",
          fulfillment: "pickup",
        }).length,
        1,
      );
      assert.equal(
        filterOrders(orders, { ...filters, fulfillment: "delivery" }).length,
        0,
      );
      assert.equal(invalidDateRange({ from: "2026-11-31", to: "" }), true);
      assert.equal(
        invalidDateRange({ from: "2026-11-07", to: "2026-11-06" }),
        true,
      );
      assert.equal(filterOrders(orders, { ...filters, from: "bad" }).length, 0);
      assert.equal(orders.length, 3);
    },
  );
  await check(
    "filtered statistics count completed value only and keep the last fourteen populated days",
    async () => {
      const { summarizeOrders } = require("../src/lib/order-reporting.ts");
      const orders = Array.from({ length: 16 }, (_, index) => ({
        id: "order_" + index,
        createdAt:
          "2026-10-" + String(index + 1).padStart(2, "0") + "T05:00:00Z",
        status:
          index === 0 ? "CANCELLED" : index === 1 ? "CONFIRMED" : "COMPLETED",
        total: 10000,
      }));
      const stats = summarizeOrders(orders);
      assert.equal(stats.totalOrders, 16);
      assert.equal(stats.completedOrders, 14);
      assert.equal(stats.activeOrders, 1);
      assert.equal(stats.cancelledOrders, 1);
      assert.equal(stats.completedValue, 140000);
      assert.equal(stats.daily.length, 14);
      assert.equal(stats.daily[0].date, "2026-10-03");
      assert.equal(summarizeOrders([]).completedValue, 0);
    },
  );
  await check(
    "CSV contains only selected machine-owned fields and no customer contact or notes",
    async () => {
      const { ordersCsv } = require("../src/lib/order-reporting.ts");
      const csv = ordersCsv([
        {
          id: "order_selected",
          createdAt: "2026-11-06T05:00:00Z",
          status: "COMPLETED",
          fulfillment: "pickup",
          subtotal: 25000,
          discount: 5000,
          deliveryFee: 0,
          total: 20000,
          customerName: "=PRIVATE NAME",
          phone: "SECRET_PHONE",
          shippingAddress: { address: "SECRET_ADDRESS" },
          note: "SECRET_NOTE",
        },
      ]);
      assert.equal(csv.charCodeAt(0), 0xfeff);
      assert.equal(csv.split("\r\n").length, 2);
      assert.ok(csv.includes("order_selected"));
      assert.ok(csv.includes('"discount_vnd"'));
      assert.ok(csv.includes('"25000","5000","0","20000"'));
      for (const secret of [
        "PRIVATE NAME",
        "SECRET_PHONE",
        "SECRET_ADDRESS",
        "SECRET_NOTE",
      ])
        assert.ok(!csv.includes(secret));
      assert.equal(ordersCsv([]).split("\r\n").length, 1);
    },
  );
  await check(
    "category create/edit preserves identity, rejects normalized duplicates and respects display order",
    async () => {
      const {
        MockMenuRepository,
        MockOrderRepository,
        MockCartRepository,
      } = require("../src/lib/db/repositories/implementations/mock-repository.ts");
      const { AdminService } = require("../src/lib/services/admin-service.ts");
      const { adminCategorySchema } = require("../src/lib/validation/admin.ts");
      const menu = new MockMenuRepository();
      const admin = new AdminService(
        new MockOrderRepository(new MockCartRepository()),
        menu,
      );
      const fields = {
        name: "Nhóm món mới",
        description: "Demo",
        displayOrder: 0,
        isActive: true,
      };
      const created = await admin.saveCategory(
        adminCategorySchema.parse(fields),
      );
      assert.equal((await menu.getActiveCategories())[0].id, created.id);
      await assert.rejects(
        () => admin.saveCategory({ ...fields, name: "nhom mon moi" }),
        (error) => error.code === "DUPLICATE_CATEGORY",
      );
      const changed = await admin.saveCategory(
        { ...fields, name: "Tên cập nhật", displayOrder: 999 },
        created.id,
      );
      assert.equal(changed.id, created.id);
      assert.equal(changed.createdAt, created.createdAt);
      assert.equal((await menu.getCategories()).at(-1).id, created.id);
      assert.equal(
        adminCategorySchema.safeParse({ ...fields, displayOrder: -1 }).success,
        false,
      );
      assert.equal(
        adminCategorySchema.safeParse({ ...fields, role: "admin" }).success,
        false,
      );
      await assert.rejects(
        () => admin.saveCategory(fields, "missing"),
        (error) => error.code === "CATEGORY_NOT_FOUND",
      );
    },
  );
  await check(
    "categories with hidden items cannot be disabled; moved items release the category",
    async () => {
      const {
        MockMenuRepository,
        MockOrderRepository,
        MockCartRepository,
      } = require("../src/lib/db/repositories/implementations/mock-repository.ts");
      const { AdminService } = require("../src/lib/services/admin-service.ts");
      const menu = new MockMenuRepository();
      const admin = new AdminService(
        new MockOrderRepository(new MockCartRepository()),
        menu,
      );
      const fields = {
        name: "Nhóm kiểm thử",
        description: "",
        displayOrder: 0,
        isActive: true,
      };
      const created = await admin.saveCategory(fields);
      const item = {
        name: "Món kiểm thử danh mục",
        description: "",
        price: 25000,
        categoryId: created.id,
        imageUrl: "/images/burger.svg",
        isActive: false,
        isAvailable: false,
      };
      const saved = await admin.saveMenu(item);
      await assert.rejects(
        () => admin.saveCategory({ ...fields, isActive: false }, created.id),
        (error) => error.code === "CATEGORY_IN_USE",
      );
      assert.equal((await menu.getCategoryById(created.id)).isActive, true);
      const other = (await menu.getActiveCategories()).find(
        (category) => category.id !== created.id,
      );
      await admin.saveMenu({ ...item, categoryId: other.id }, saved.id);
      await admin.saveCategory({ ...fields, isActive: false }, created.id);
      assert.ok(
        !(await menu.getActiveCategories()).some(
          (category) => category.id === created.id,
        ),
      );
      await assert.rejects(
        () => admin.saveMenu({ ...item, name: "Món mới khác" }),
        (error) => error.code === "CATEGORY_INVALID",
      );
    },
  );
  await check(
    "client API preserves Headers objects and structured conflict codes",
    async () => {
      const { api } = require("../src/lib/storefront-types.ts");
      const original = global.fetch;
      try {
        global.fetch = async (url, options) => {
          assert.equal(options.headers.get("x-kfc-owner"), "guest_expected");
          assert.equal(options.headers.get("content-type"), "application/json");
          return Response.json(
            { error: "Changed", code: "IDENTITY_CHANGED" },
            { status: 409 },
          );
        };
        await assert.rejects(
          () =>
            api("/fixture", {
              headers: new Headers({ "X-KFC-Owner": "guest_expected" }),
            }),
          (error) => error.status === 409 && error.code === "IDENTITY_CHANGED",
        );
      } finally {
        global.fetch = original;
      }
    },
  );
  await check(
    "renaming an existing cart item invalidates its quantity preview",
    async () => {
      const owner = "rename_" + crypto.randomUUID();
      await services.cartService.addMenuItem(owner, item, 1);
      const proposed = await services.chatService.processChat({
        platform: "web",
        userId: owner,
        sessionId: "fixture",
        message: "Đổi Pepsi thành 2",
      });
      assert.ok(proposed.pendingConfirmation);
      const previous = item.name;
      try {
        item.name = previous + " đổi tên";
        const result = await services.chatService.processChat({
          platform: "web",
          userId: owner,
          sessionId: proposed.sessionId,
          message: "Xác nhận",
          confirm: true,
          confirmationId: proposed.pendingConfirmation.id,
        });
        assert.equal(result.execution.length, 0);
        assert.equal(
          (await services.cartService.getCartView(owner)).items[0].quantity,
          1,
        );
      } finally {
        item.name = previous;
      }
    },
  );
  await check(
    "catalog audit records real changes only and includes category before/after values",
    async () => {
      const {
        MockMenuRepository,
        MockOrderRepository,
        MockCartRepository,
      } = require("../src/lib/db/repositories/implementations/mock-repository.ts");
      const { AdminService } = require("../src/lib/services/admin-service.ts");
      const menu = new MockMenuRepository();
      const admin = new AdminService(
        new MockOrderRepository(new MockCartRepository()),
        menu,
      );
      const fields = {
        name: "Nhật ký danh mục",
        description: "",
        displayOrder: 0,
        isActive: true,
      };
      const created = await admin.saveCategory(fields);
      await admin.saveCategory(fields, created.id);
      assert.equal((await admin.catalogHistory()).length, 1);
      await admin.saveCategory({ ...fields, displayOrder: 4 }, created.id);
      const history = await admin.catalogHistory();
      assert.equal(history.length, 2);
      const update = history.find(
        (entry) => entry.action === "CATEGORY_UPDATED",
      );
      assert.deepEqual(update.changes, [
        { field: "displayOrder", before: 0, after: 4 },
      ]);
      await assert.rejects(
        () => admin.saveCategory(fields),
        (error) => error.code === "DUPLICATE_CATEGORY",
      );
      assert.equal((await admin.catalogHistory()).length, 2);
    },
  );
  await check(
    "catalog audit excludes noncatalog secrets and duplicate audit IDs leave both data and history unchanged",
    async () => {
      const {
        MockMenuRepository,
      } = require("../src/lib/db/repositories/implementations/mock-repository.ts");
      const { catalogAudit } = require("../src/lib/services/catalog-audit.ts");
      const menu = new MockMenuRepository();
      const item = (await menu.getMenuItems())[0];
      const changed = {
        ...item,
        price: item.price + 1000,
        passwordHash: "PRIVATE_SECRET",
        phone: "PRIVATE_PHONE",
      };
      const audit = catalogAudit("menu", changed, item);
      assert.deepEqual(audit.changes, [
        { field: "price", before: item.price, after: item.price + 1000 },
      ]);
      assert.ok(!JSON.stringify(audit).includes("PRIVATE_"));
      await menu.saveMenuItem(changed, audit);
      await assert.rejects(
        () => menu.saveMenuItem({ ...changed, price: 1 }, audit),
        (error) => error.code === "AUDIT_CONFLICT",
      );
      assert.equal((await menu.getMenuItemById(item.id)).price, changed.price);
      assert.equal((await menu.getCatalogAudit(200)).length, 1);
    },
  );
  await check(
    "address books enforce one default, five entries and private owner-scoped edits",
    async () => {
      const {
        MockUserRepository,
      } = require("../src/lib/db/repositories/implementations/mock-repository.ts");
      const {
        AddressService,
      } = require("../src/lib/services/address-service.ts");
      const service = new AddressService(new MockUserRepository());
      const fields = {
        label: "Nhà",
        recipientName: "Khách demo",
        phone: "0901234567",
        addressLine: "123 Đường Mẫu, Thành phố Demo",
        isDefault: false,
      };
      let book = await service.book("owner-a");
      book = await service.save("owner-a", fields, book.revision);
      const firstId = book.addresses[0].id;
      assert.equal(book.addresses[0].isDefault, true);
      book = await service.save(
        "owner-a",
        { ...fields, label: "Công ty", isDefault: true },
        book.revision,
      );
      assert.equal(book.addresses.filter((entry) => entry.isDefault).length, 1);
      assert.notEqual(
        book.addresses.find((entry) => entry.isDefault).id,
        firstId,
      );
      const foreign = await service.book("owner-b");
      await assert.rejects(
        () => service.save("owner-b", fields, foreign.revision, firstId),
        (error) => error.code === "ADDRESS_NOT_FOUND",
      );
      for (let index = 0; index < 3; index++)
        book = await service.save(
          "owner-a",
          { ...fields, label: "Nhà " + index },
          book.revision,
        );
      await assert.rejects(
        () => service.save("owner-a", fields, book.revision),
        (error) => error.code === "ADDRESS_LIMIT",
      );
      const defaultId = book.addresses.find((entry) => entry.isDefault).id;
      book = await service.remove("owner-a", defaultId, book.revision);
      assert.equal(book.addresses.length, 4);
      assert.equal(book.addresses.filter((entry) => entry.isDefault).length, 1);
    },
  );
  await check(
    "stale and concurrent address edits cannot overwrite a newer book",
    async () => {
      const {
        MockUserRepository,
      } = require("../src/lib/db/repositories/implementations/mock-repository.ts");
      const {
        AddressService,
      } = require("../src/lib/services/address-service.ts");
      const {
        createAddressSchema,
      } = require("../src/lib/validation/address.ts");
      const service = new AddressService(new MockUserRepository());
      const empty = await service.book("concurrent-owner");
      const fields = {
        label: "Nhà",
        recipientName: "Khách demo",
        phone: "0901234567",
        addressLine: "123 Đường Mẫu, Thành phố Demo",
        isDefault: false,
      };
      const results = await Promise.allSettled([
        service.save("concurrent-owner", fields, empty.revision),
        service.save("concurrent-owner", fields, empty.revision),
      ]);
      assert.equal(
        results.filter((entry) => entry.status === "fulfilled").length,
        1,
      );
      assert.equal(
        results.find((entry) => entry.status === "rejected").reason.code,
        "ADDRESS_BOOK_CHANGED",
      );
      await assert.rejects(
        () => service.save("concurrent-owner", fields, empty.revision),
        (error) => error.code === "ADDRESS_BOOK_CHANGED",
      );
      const current = await service.book("concurrent-owner");
      assert.equal(current.addresses.length, 1);
      assert.equal(
        createAddressSchema.safeParse({
          ...fields,
          revision: current.revision,
          userId: "another-owner",
        }).success,
        false,
      );
      assert.equal(
        createAddressSchema.safeParse({
          ...fields,
          revision: current.revision,
          phone: "invalid",
        }).success,
        false,
      );
    },
  );
  await check(
    "profile updates preserve identity and reject stale password versions",
    async () => {
      const {
        MockAccountRepository,
      } = require("../src/lib/db/repositories/implementations/mock-repository.ts");
      const {
        AccountService,
      } = require("../src/lib/services/account-service.ts");
      const {
        profileSchema,
        passwordChangeSchema,
      } = require("../src/lib/validation/account.ts");
      const repository = new MockAccountRepository();
      const accounts = new AccountService(repository);
      const account = await accounts.register({
        email: "profile-" + crypto.randomUUID() + "@example.test",
        fullName: "Tên ban đầu",
        password: crypto.randomUUID(),
      });
      const profile = await accounts.updateProfile(account, "  Tên cập nhật  ");
      assert.deepEqual(Object.keys(profile).sort(), [
        "email",
        "fullName",
        "id",
      ]);
      assert.equal(profile.fullName, "Tên cập nhật");
      const updated = await accounts.getById(account.id);
      assert.equal(updated.email, account.email);
      assert.equal(updated.passwordHash, account.passwordHash);
      assert.equal(
        profileSchema.safeParse({ fullName: "Test", role: "admin" }).success,
        false,
      );
      assert.equal(
        passwordChangeSchema.safeParse({
          currentPassword: "old",
          newPassword: "new-password-123",
          confirmPassword: "different",
        }).success,
        false,
      );
      await repository.updateAccount(
        account.id,
        { passwordHash: "new-version", updatedAt: new Date().toISOString() },
        account.passwordHash,
      );
      await assert.rejects(
        () => accounts.updateProfile(account, "Tên cũ"),
        (error) => error.code === "ACCOUNT_CHANGED",
      );
      assert.equal(
        (await accounts.getById(account.id)).fullName,
        "Tên cập nhật",
      );
    },
  );
  await check(
    "password changes require the old secret and concurrent changes have one winner",
    async () => {
      const {
        MockAccountRepository,
      } = require("../src/lib/db/repositories/implementations/mock-repository.ts");
      const {
        AccountService,
        accountVersion,
      } = require("../src/lib/services/account-service.ts");
      const accounts = new AccountService(new MockAccountRepository());
      const password = crypto.randomUUID();
      const account = await accounts.register({
        email: "password-" + crypto.randomUUID() + "@example.test",
        fullName: "Test Account",
        password,
      });
      await assert.rejects(
        () => accounts.changePassword(account, "wrong", crypto.randomUUID()),
        (error) => error.code === "PASSWORD_INCORRECT",
      );
      assert.equal(
        (await accounts.getById(account.id)).passwordHash,
        account.passwordHash,
      );
      const options = [crypto.randomUUID(), crypto.randomUUID()];
      const outcomes = await Promise.allSettled(
        options.map((next) => accounts.changePassword(account, password, next)),
      );
      assert.equal(
        outcomes.filter((result) => result.status === "fulfilled").length,
        1,
      );
      assert.equal(
        outcomes.find((result) => result.status === "rejected").reason.code,
        "ACCOUNT_CHANGED",
      );
      const next =
        options[outcomes.findIndex((result) => result.status === "fulfilled")];
      const changed = await accounts.login(account.email, next);
      assert.notEqual(changed.passwordSalt, account.passwordSalt);
      assert.notEqual(accountVersion(changed), accountVersion(account));
      await assert.rejects(
        () => accounts.login(account.email, password),
        (error) => error.code === "LOGIN_FAILED",
      );
      assert.ok(!JSON.stringify(changed).includes(next));
    },
  );
  const {
    PromotionService,
  } = require("../src/lib/services/promotion-service.ts");
  const {
    MockMenuRepository,
    MockCartRepository,
    MockOrderRepository,
  } = require("../src/lib/db/repositories/implementations/mock-repository.ts");
  const {
    createPromotionSchema,
  } = require("../src/lib/validation/promotion.ts");
  const promotionFields = {
    code: "DEMO20",
    title: "Ưu đãi test",
    discountType: "percent",
    value: 20,
    minimumSubtotal: 10000,
    maxDiscount: 5000,
    startsAt: "2020-01-01T00:00:00.000Z",
    endsAt: "2099-01-01T00:00:00.000Z",
    isActive: true,
  };
  await check(
    "promotion arithmetic respects caps, minimums, boundaries and inactive codes",
    async () => {
      const promo = new PromotionService(new MockMenuRepository());
      const entry = await promo.save(promotionFields);
      assert.equal((await promo.evaluate(" demo20 ", 12345)).discount, 2469);
      assert.equal((await promo.evaluate(entry.code, 100000)).discount, 5000);
      assert.equal(
        (await promo.evaluate(entry.code, 10000, Date.parse(entry.startsAt)))
          .discount,
        2000,
      );
      await assert.rejects(
        () => promo.evaluate(entry.code, 9999),
        (e) => e.code === "PROMOTION_MINIMUM",
      );
      await assert.rejects(
        () => promo.evaluate(entry.code, 10000, Date.parse(entry.startsAt) - 1),
        (e) => e.code === "PROMOTION_UNAVAILABLE",
      );
      await assert.rejects(
        () => promo.evaluate(entry.code, 10000, Date.parse(entry.endsAt)),
        (e) => e.code === "PROMOTION_UNAVAILABLE",
      );
      await promo.save({ ...promotionFields, isActive: false }, entry.revision);
      await assert.rejects(
        () => promo.evaluate(entry.code, 10000),
        (e) => e.code === "PROMOTION_UNAVAILABLE",
      );
    },
  );
  await check(
    "promotion schema and repository CAS reject invalid rules and competing writes",
    async () => {
      for (const extra of [
        { value: 101 },
        { discountType: "fixed", maxDiscount: 1 },
        { endsAt: promotionFields.startsAt },
        { userId: "forged" },
        { value: 2.5 },
      ])
        assert.equal(
          createPromotionSchema.safeParse({ ...promotionFields, ...extra })
            .success,
          false,
        );
      const promo = new PromotionService(new MockMenuRepository());
      const created = await Promise.allSettled([
        promo.save(promotionFields),
        promo.save(promotionFields),
      ]);
      assert.equal(created.filter((r) => r.status === "fulfilled").length, 1);
      const entry = created.find((r) => r.status === "fulfilled").value;
      const edits = await Promise.allSettled(
        [10, 15].map((value) =>
          promo.save({ ...promotionFields, value }, entry.revision),
        ),
      );
      assert.equal(edits.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(
        edits.find((r) => r.status === "rejected").reason.code,
        "PROMOTION_CHANGED",
      );
    },
  );
  await check(
    "checkout revalidates promotions and keeps discounts stable across edits and retries",
    async () => {
      const { MenuService } = require("../src/lib/services/menu-service.ts");
      const { CartService } = require("../src/lib/services/cart-service.ts");
      const {
        CheckoutService,
      } = require("../src/lib/services/checkout-service.ts");
      const repo = new MockMenuRepository(),
        menu = new MenuService(repo),
        cartRepo = new MockCartRepository();
      const carts = new CartService(cartRepo, menu),
        orders = new MockOrderRepository(cartRepo),
        promo = new PromotionService(repo);
      const checkout = new CheckoutService(orders, carts, menu, promo);
      const item = (await menu.getAvailableMenuItems())[0];
      const basket = await carts.addMenuItem("promo-owner", item, 1);
      const fields = {
        ...promotionFields,
        discountType: "fixed",
        value: 20000,
        minimumSubtotal: 0,
        maxDiscount: 0,
      };
      const entry = await promo.save(fields);
      const quoteInput = {
        cartId: basket.cart.id,
        cartSignature: basket.signature,
        fulfillment: "delivery",
        promotionCode: entry.code,
      };
      const oldQuote = await checkout.quote("promo-owner", quoteInput);
      const input = {
        ...quoteInput,
        customerName: "Demo Promo",
        phone: "0901234567",
        address: "123 Đường Demo, Thành phố Demo",
        note: "",
        expectedTotal: oldQuote.total,
        idempotencyKey: crypto.randomUUID(),
        promotionRevision: entry.revision,
        confirm: true,
      };
      await promo.save({ ...fields, value: 10000 }, entry.revision);
      await assert.rejects(
        () => checkout.checkout("promo-owner", input),
        (e) => e.code === "PROMOTION_CHANGED",
      );
      const quote = await checkout.quote("promo-owner", quoteInput);
      const current = {
        ...input,
        expectedTotal: quote.total,
        promotionRevision: quote.promotion.revision,
      };
      await assert.rejects(
        () =>
          checkout.checkout("promo-owner", { ...current, expectedTotal: 1 }),
        (e) => e.code === "PRICE_CHANGED",
      );
      const order = await checkout.checkout("promo-owner", current);
      assert.equal(order.discount, 10000);
      assert.equal(order.deliveryFee, 15000);
      assert.equal(order.total, basket.cart.subtotal - 10000 + 15000);
      await promo.save(
        { ...fields, isActive: false },
        quote.promotion.revision,
      );
      assert.deepEqual(await checkout.checkout("promo-owner", current), order);
      assert.equal(
        (await orders.getOrderById(order.id)).promotion.discount,
        10000,
      );
      assert.equal(await carts.getCartView("promo-owner"), null);
    },
  );
  await check(
    "full discounts never consume delivery fees or make a total negative",
    async () => {
      const promo = new PromotionService(new MockMenuRepository());
      await promo.save({
        ...promotionFields,
        discountType: "fixed",
        value: 1000000,
        minimumSubtotal: 0,
        maxDiscount: 0,
      });
      assert.equal(
        (await promo.evaluate(promotionFields.code, 25000)).discount,
        25000,
      );
      const schema =
        require("../src/lib/validation/order.ts").createOrderSchema;
      assert.equal(
        schema.safeParse({
          cartId: "test",
          cartSignature: "a".repeat(64),
          customerName: "Demo",
          phone: "0901234567",
          fulfillment: "pickup",
          address: "",
          note: "",
          idempotencyKey: crypto.randomUUID(),
          expectedTotal: 0,
          confirm: true,
          promotionCode: "DEMO20",
          promotionRevision: crypto.randomUUID(),
        }).success,
        true,
      );
    },
  );
  async function reorderFixture() {
    const { MenuService } = require("../src/lib/services/menu-service.ts");
    const { CartService } = require("../src/lib/services/cart-service.ts");
    const {
      CheckoutService,
    } = require("../src/lib/services/checkout-service.ts");
    const {
      ReorderService,
    } = require("../src/lib/services/reorder-service.ts");
    const menuRepo = new MockMenuRepository(),
      menu = new MenuService(menuRepo),
      cartRepo = new MockCartRepository(),
      carts = new CartService(cartRepo, menu),
      orders = new MockOrderRepository(cartRepo);
    const checkout = new CheckoutService(orders, carts, menu);
    const reorder = new ReorderService(orders, cartRepo, carts, menu);
    const item = (await menu.getAvailableMenuItems())[0],
      owner = "reorder_" + crypto.randomUUID();
    const basket = await carts.addMenuItem(owner, item, 2);
    const input = {
      cartId: basket.cart.id,
      cartSignature: basket.signature,
      customerName: "Synthetic private recipient",
      phone: "0901234567",
      fulfillment: "delivery",
      address: "123 Synthetic private address",
      note: "PRIVATE_NOTE_MARKER",
      expectedTotal: basket.cart.subtotal + 15000,
      idempotencyKey: crypto.randomUUID(),
      confirm: true,
    };
    const order = await checkout.checkout(owner, input);
    return {
      menuRepo,
      menu,
      cartRepo,
      carts,
      orders,
      checkout,
      reorder,
      item,
      owner,
      order,
      input,
    };
  }
  await check("checkout retries bind the committed payload and reject altered contact, cart, totals and coupon", async () => {
    const f = await reorderFixture();
    assert.equal((await f.checkout.checkout(f.owner, { ...f.input })).id, f.order.id);
    for (const change of [
      { customerName: "Changed recipient" }, { phone: "0909999999" },
      { address: "456 Changed address" }, { note: "Changed note" },
      { fulfillment: "pickup" }, { expectedTotal: f.input.expectedTotal + 1 },
      { cartId: "other-cart" }, { cartSignature: "a".repeat(64) },
      { promotionCode: "NEWCODE", promotionRevision: crypto.randomUUID() },
    ]) {
      await assert.rejects(() => f.checkout.checkout(f.owner, { ...f.input, ...change }),
        e => e.code === "IDEMPOTENCY_CONFLICT" && e.status === 409);
    }
    assert.equal((await f.checkout.detail(f.owner, f.order.id)).phone, f.input.phone);
    assert.equal(await f.carts.getCartView(f.owner), null);
    const cart = await f.carts.getCartById(f.order.cartId);
    assert.match(cart.checkoutRequestHash, /^[a-f0-9]{64}$/);
    // Simulate an old local backup without the optional hash, without rewriting orders.
    delete cart.checkoutRequestHash;
    await f.cartRepo.updateCart(cart);
    assert.equal((await f.checkout.checkout(f.owner, f.input)).id, f.order.id);
    await assert.rejects(() => f.checkout.checkout(f.owner, { ...f.input, phone: "0909999999" }),
      e => e.code === "IDEMPOTENCY_CONFLICT");
  });
  await check("checkout status reads only the owner's matching attempt without creating or changing orders", async () => {
    const f = await reorderFixture();
    const attempt = { idempotencyKey: f.input.idempotencyKey, cartId: f.input.cartId };
    const before = await f.checkout.detail(f.owner, f.order.id);
    assert.deepEqual(await f.checkout.findAttempt(f.owner, attempt), before);
    for (const input of [{ ...attempt, cartId: "other-cart" }, { ...attempt, idempotencyKey: crypto.randomUUID() }])
      assert.equal(await f.checkout.findAttempt(f.owner, input), null);
    assert.equal(await f.checkout.findAttempt("other-owner", attempt), null);
    assert.deepEqual(await f.checkout.detail(f.owner, f.order.id), before);
    assert.equal(await f.carts.getCartView(f.owner), null);
  });
  await check(
    "reorder previews are owner-private, use current prices and do not create a cart or copy contact",
    async () => {
      const f = await reorderFixture();
      await f.menuRepo.saveMenuItem({
        ...f.item,
        price: f.item.price + 1000,
        name: f.item.name + " mới",
      });
      const preview = await f.reorder.preview(f.owner, f.order.id);
      assert.equal(preview.items[0].unitPrice, f.item.price + 1000);
      assert.equal(preview.items[0].previousUnitPrice, f.item.price);
      assert.equal(preview.subtotal, (f.item.price + 1000) * 2);
      assert.equal(await f.carts.getCartView(f.owner), null);
      const serialized = JSON.stringify(preview);
      assert.ok(!serialized.includes("PRIVATE_NOTE_MARKER"));
      assert.ok(!serialized.includes("private recipient"));
      assert.ok(!serialized.includes("0901234567"));
      await assert.rejects(
        () => f.reorder.preview("other-owner", f.order.id),
        (e) => e.code === "ORDER_NOT_FOUND",
      );
    },
  );
  await check(
    "reorder rejects changed prices and unavailable or unsupported lines without partial cart writes",
    async () => {
      const f = await reorderFixture(),
        preview = await f.reorder.preview(f.owner, f.order.id);
      await f.menuRepo.saveMenuItem({ ...f.item, price: f.item.price + 1000 });
      await assert.rejects(
        () => f.reorder.confirm(f.owner, preview.confirmationToken),
        (e) => e.code === "REORDER_CHANGED",
      );
      assert.equal(await f.carts.getCartView(f.owner), null);
      await f.menuRepo.saveMenuItem({ ...f.item, isAvailable: false });
      await assert.rejects(
        () => f.reorder.preview(f.owner, f.order.id),
        (e) => e.code === "REORDER_UNAVAILABLE",
      );
      assert.equal(await f.carts.getCartView(f.owner), null);
      await f.menuRepo.saveMenuItem(f.item);
      const lines = await f.orders.getOrderItems(f.order.id);
      lines[0].options = { size: "large" };
      await assert.rejects(
        () => f.reorder.preview(f.owner, f.order.id),
        (e) => e.code === "REORDER_INVALID",
      );
      assert.equal(await f.carts.getCartView(f.owner), null);
    },
  );
  await check(
    "reorder tokens reject tampering, expiry and other owners, preserving nonempty or replaced carts",
    async () => {
      const {
        issueToken,
        readToken,
      } = require("../src/lib/server/session-token.ts");
      const f = await reorderFixture(),
        preview = await f.reorder.preview(f.owner, f.order.id),
        token = preview.confirmationToken;
      for (const candidate of [
        token.slice(0, -1) + (token.endsWith("A") ? "B" : "A"),
        issueToken("reorder", readToken("reorder", token), -1),
      ])
        await assert.rejects(
          () => f.reorder.confirm(f.owner, candidate),
          (e) => e.code === "REORDER_EXPIRED",
        );
      await assert.rejects(
        () => f.reorder.confirm("other-owner", token),
        (e) => e.code === "REORDER_EXPIRED",
      );
      const basket = await f.carts.addMenuItem(f.owner, f.item, 1);
      await assert.rejects(
        () => f.reorder.preview(f.owner, f.order.id),
        (e) => e.code === "REORDER_CART_NOT_EMPTY",
      );
      await assert.rejects(
        () => f.reorder.confirm(f.owner, token),
        (e) => e.code === "REORDER_CART_NOT_EMPTY",
      );
      assert.equal((await f.carts.getCartView(f.owner)).items[0].quantity, 1);
      await f.carts.clearCart(f.owner);
      await assert.rejects(
        () => f.reorder.confirm(f.owner, token),
        (e) => e.code === "REORDER_CHANGED",
      );
      const next = await f.reorder.preview(f.owner, f.order.id),
        applied = await f.reorder.confirm(f.owner, next.confirmationToken);
      assert.notEqual(applied.cart.id, basket.cart.id);
      assert.equal(
        (await f.cartRepo.getCartById(basket.cart.id)).status,
        "ABANDONED",
      );
    },
  );
  await check(
    "reorder confirms once across concurrency and retries without undoing later edits or reopening checked-out carts",
    async () => {
      const f = await reorderFixture(),
        preview = await f.reorder.preview(f.owner, f.order.id);
      const results = await Promise.all([
        f.reorder.confirm(f.owner, preview.confirmationToken),
        f.reorder.confirm(f.owner, preview.confirmationToken),
      ]);
      assert.equal(results[0].cart.id, results[1].cart.id);
      assert.equal(results.filter((r) => !r.replayed).length, 1);
      assert.equal(results[0].cart.discount, 0);
      assert.equal(results[0].cart.deliveryFee, 0);
      assert.equal((await f.orders.getUserOrders(f.owner)).length, 1);
      const edited = await f.carts.addMenuItem(f.owner, f.item, 1),
        retried = await f.reorder.confirm(f.owner, preview.confirmationToken);
      assert.equal(retried.replayed, true);
      assert.equal(retried.items[0].quantity, 3);
      await f.checkout.checkout(f.owner, {
        ...f.input,
        cartId: edited.cart.id,
        cartSignature: edited.signature,
        expectedTotal: edited.cart.subtotal + 15000,
        idempotencyKey: crypto.randomUUID(),
      });
      await assert.rejects(
        () => f.reorder.confirm(f.owner, preview.confirmationToken),
        (e) => e.code === "REORDER_ALREADY_USED",
      );
      assert.equal(await f.carts.getCartView(f.owner), null);
    },
  );
  await check(
    "competing reorder plans cannot replace a cart that the first plan already populated",
    async () => {
      const f = await reorderFixture(),
        first = await f.reorder.preview(f.owner, f.order.id),
        second = await f.reorder.preview(f.owner, f.order.id);
      const outcomes = await Promise.allSettled([
        f.reorder.confirm(f.owner, first.confirmationToken),
        f.reorder.confirm(f.owner, second.confirmationToken),
      ]);
      assert.equal(outcomes.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal((await f.carts.getCartView(f.owner)).items[0].quantity, 2);
      const active = await f.carts.getCartView(f.owner);
      await assert.rejects(
        () =>
          f.cartRepo.completeReorder(
            { ...active.cart, id: "forged-new-cart" },
            active.items,
            null,
          ),
        (e) => e.code === "REORDER_CHANGED",
      );
      assert.equal(
        (await f.carts.getCartView(f.owner)).cart.id,
        active.cart.id,
      );
    },
  );
  const {
    MockLLMProvider,
  } = require("../src/lib/agent/providers/mock-llm-provider.ts");
  const languageProvider = new MockLLMProvider();
  const parseLanguage = async (message) =>
    (
      await languageProvider.generateResponse(
        "",
        "USER_MESSAGE_JSON:" + JSON.stringify(message),
      )
    ).response;
  await check(
    "Vietnamese number words preserve quantities, including compound tens and the hundred boundary",
    async () => {
      for (const [word, quantity] of [
        ["một", 1],
        ["hai", 2],
        ["ba", 3],
        ["bốn", 4],
        ["năm", 5],
        ["sáu", 6],
        ["bảy", 7],
        ["tám", 8],
        ["chín", 9],
        ["mười", 10],
        ["mười một", 11],
        ["mười lăm", 15],
        ["hai mươi", 20],
        ["hai mươi mốt", 21],
        ["hai mươi tư", 24],
        ["ba mươi lăm", 35],
        ["chín mươi chín", 99],
        ["một trăm", 100],
      ]) {
        const r = await parseLanguage("Thêm " + word + " Pepsi");
        assert.equal(r.actions[0]?.type, "ADD_TO_CART", word);
        assert.equal(r.actions[0]?.parameters.quantity, quantity, word);
      }
    },
  );
  await check(
    "language safety corpus checks provider intent plus real policy previews without changing seeded carts",
    async () => {
      const fs = require("node:fs"),
        path = require("node:path"),
        cryptoNode = require("node:crypto");
      const dataset = fs.readFileSync(
          path.join(__dirname, "../tests/data/language-safety.vi.json"),
        ),
        rows = JSON.parse(dataset),
        results = [];
      const available = await services.menuService.getAvailableMenuItems(),
        pepsi =
          available.find((i) => i.id === "item_pepsi_001") ??
          available.find((i) => i.name.toLowerCase().includes("pepsi")),
        other = available.find((i) => i.id !== pepsi.id);
      const state = async (owner) => {
        const v = await services.cartService.getCartView(owner);
        return {
          id: v?.cart.id ?? null,
          lines: (v?.items ?? []).map((i) => [
            i.id,
            i.menuItemId,
            i.quantity,
            i.unitPrice,
          ]),
        };
      };
      for (const row of rows) {
        const raw = await parseLanguage(row.message),
          first = raw.actions[0];
        assert.equal(
          first?.type ?? "NONE",
          row.expectedAction,
          row.id + " provider intent",
        );
        if (row.expectedQuantity !== undefined)
          assert.equal(
            first?.parameters.quantity,
            row.expectedQuantity,
            row.id + " quantity",
          );
        const owner = "language_" + crypto.randomUUID();
        if (row.expectedAction !== "ADD_TO_CART" || !row.expectedPreview) {
          await services.cartService.addMenuItem(owner, pepsi, 3);
          await services.cartService.addMenuItem(owner, other, 1);
        }
        const before = await state(owner),
          result = await services.chatService.processChat({
            userId: owner,
            sessionId: "language",
            platform: "web",
            message: row.message,
          });
        assert.equal(
          result.requiresConfirmation,
          row.expectedPreview,
          row.id + " policy preview",
        );
        assert.deepEqual(
          await state(owner),
          before,
          row.id + " unexpected cart write",
        );
        results.push({
          id: row.id,
          message: row.message,
          expectedAction: row.expectedAction,
          actualAction: first?.type ?? "NONE",
          expectedQuantity: row.expectedQuantity,
          actualQuantity: first?.parameters.quantity,
          expectedPreview: row.expectedPreview,
          actualPreview: result.requiresConfirmation,
          cartUnchanged: true,
          passed: true,
        });
      }
      const hash = (b) =>
        cryptoNode.createHash("sha256").update(b).digest("hex");
      const parserSources = [
        "src/lib/agent/providers/mock-llm-provider.ts",
        "src/lib/agent/providers/mock-message.ts",
        "src/lib/services/menu-service.ts",
      ].map((file) => ({
        path: file,
        sha256: hash(fs.readFileSync(path.join(__dirname, "..", file))),
      }));
      fs.mkdirSync(path.join(__dirname, "../output/evaluation"), {
        recursive: true,
      });
      fs.writeFileSync(
        path.join(
          __dirname,
          "../output/evaluation/language-safety-report.json",
        ),
        JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            scope:
              "Synthetic development regressions; not independent evaluation or Bedrock acceptance",
            total: rows.length,
            passed: rows.length,
            datasetSha256: hash(dataset),
            parserSources,
            results,
          },
          null,
          2,
        ) + "\n",
      );
    },
  );
  await check(
    "number words reach the cart only after confirmation and absolute changes preserve the requested final count",
    async () => {
      const owner = "written_commit_" + crypto.randomUUID();
      let confirmation;
      const talk = async (message, confirm = false) => {
        const r = await services.chatService.processChat({
          userId: owner,
          sessionId: "written",
          platform: "web",
          message,
          confirm,
          confirmationId: confirm ? confirmation : undefined,
        });
        if (r.pendingConfirmation) confirmation = r.pendingConfirmation.id;
        return r;
      };
      const add = await talk("Cho mình hai chai Pepsi 1,5 lít");
      assert.equal(add.requiresConfirmation, true);
      assert.equal(await services.cartService.getCartView(owner), null);
      await talk("Xác nhận", true);
      assert.equal(
        (await services.cartService.getCartView(owner)).items[0].quantity,
        2,
      );
      const update = await talk("Tăng Pepsi lên mười hai");
      assert.equal(update.actions[0].parameters.quantity, 12);
      assert.equal(
        (await services.cartService.getCartView(owner)).items[0].quantity,
        2,
      );
      await talk("Xác nhận", true);
      assert.equal(
        (await services.cartService.getCartView(owner)).items[0].quantity,
        12,
      );
    },
  );
  await check(
    "inside-cart wording removes one named line while whole-cart requests require their own explicit confirmation",
    async () => {
      const owner = "remove_scope_" + crypto.randomUUID(),
        available = await services.menuService.getAvailableMenuItems(),
        pepsi = available.find((i) => i.name.toLowerCase().includes("pepsi")),
        other = available.find((i) => i.id !== pepsi.id);
      await services.cartService.addMenuItem(owner, pepsi, 3);
      await services.cartService.addMenuItem(owner, other, 1);
      const remove = await services.chatService.processChat({
        userId: owner,
        sessionId: "scope",
        platform: "web",
        message: "Xoá Pepsi trong giỏ hàng",
      });
      assert.equal(remove.actions[0].type, "REMOVE_FROM_CART");
      assert.equal(
        (await services.cartService.getCartView(owner)).items.length,
        2,
      );
      await services.chatService.processChat({
        userId: owner,
        sessionId: "scope",
        platform: "web",
        message: "Xác nhận",
        confirm: true,
        confirmationId: remove.pendingConfirmation.id,
      });
      assert.equal(
        (await services.cartService.getCartView(owner)).items[0].menuItemId,
        other.id,
      );
      const clear = await services.chatService.processChat({
        userId: owner,
        sessionId: "scope",
        platform: "web",
        message: "Hãy bỏ toàn bộ món trong giỏ",
      });
      assert.equal(clear.actions[0].type, "CLEAR_CART");
      assert.equal(
        (await services.cartService.getCartView(owner)).items.length,
        1,
      );
      await services.chatService.processChat({
        userId: owner,
        sessionId: "scope",
        platform: "web",
        message: "Xác nhận",
        confirm: true,
        confirmationId: clear.pendingConfirmation.id,
      });
      assert.equal(
        (await services.cartService.getCartView(owner)).items.length,
        0,
      );
    },
  );
  await check(
    "product names with accented number-like words and beverage sizes stay in the authoritative lookup query",
    async () => {
      const { MenuService } = require("../src/lib/services/menu-service.ts"),
        { CartService } = require("../src/lib/services/cart-service.ts"),
        { PolicyEngine } = require("../src/lib/policy/policy-engine.ts");
      const repo = new MockMenuRepository(),
        menu = new MenuService(repo),
        carts = new CartService(new MockCartRepository(), menu),
        policy = new PolicyEngine(carts, menu);
      const template = (await menu.getAvailableMenuItems())[0];
      await repo.saveMenuItem({
        ...template,
        id: "item_mushroom_test",
        name: "Gà Sốt Nấm",
        description: "Món nấm kiểm tra",
        tags: [],
      });
      const named = await parseLanguage("Thêm gà sốt nấm");
      assert.equal(named.actions[0].parameters.quantity, 1);
      assert.equal(
        (await policy.findMenuMatches(named.actions[0].parameters.query))[0].id,
        "item_mushroom_test",
      );
      const size = await parseLanguage("Thêm hai chai Pepsi 1,5 lít");
      assert.equal(size.actions[0].parameters.quantity, 2);
      assert.equal(
        (await policy.findMenuMatches(size.actions[0].parameters.query))[0].id,
        (await menu.getAvailableMenuItems()).find((i) =>
          i.name.toLowerCase().includes("pepsi"),
        ).id,
      );
      const unknown = await parseLanguage("Thêm hai chai Pepsi 500ml");
      assert.equal(
        (await policy.findMenuMatches(unknown.actions[0].parameters.query))
          .length,
        0,
      );
    },
  );
  const {
    aggregateSales,
    productSalesCsv,
  } = require("../src/lib/sales-reporting.ts");
  function salesRow(id, qty, price, extra = {}, itemExtra = {}) {
    const subtotal = qty * price;
    return {
      order: {
        id,
        userId: "synthetic",
        cartId: "cart",
        status: "COMPLETED",
        subtotal,
        discount: 0,
        deliveryFee: 0,
        total: subtotal,
        currency: "VND",
        createdAt: "2026-11-07T01:00:00.000Z",
        updatedAt: "2026-11-07T01:00:00.000Z",
        customerName: "PRIVATE_CUSTOMER",
        phone: "PRIVATE_PHONE",
        note: "PRIVATE_NOTE",
        ...extra,
      },
      items: [
        {
          id: "line_" + id,
          orderId: id,
          menuItemId: "sku",
          nameSnapshot: "Tên cũ",
          quantity: qty,
          unitPrice: price,
          subtotal,
          createdAt: "2026-11-07T01:00:00.000Z",
          updatedAt: "2026-11-07T01:00:00.000Z",
          ...itemExtra,
        },
      ],
    };
  }
  await check(
    "product sales group immutable SKU snapshots across prices and names, excluding uncompleted orders",
    async () => {
      const first = salesRow("one", 2, 25000),
        second = salesRow(
          "two",
          1,
          30000,
          { createdAt: "2026-11-07T02:00:00.000Z" },
          { nameSnapshot: "Tên mới" },
        );
      const canceled = salesRow("canceled", 99, 30000, { status: "CANCELLED" });
      const result = aggregateSales([second, canceled, first]);
      assert.equal(result.completedOrders, 2);
      assert.equal(result.units, 3);
      assert.equal(result.gross, 80000);
      assert.equal(result.products.length, 1);
      assert.equal(result.products[0].name, "Tên mới");
      assert.equal(result.products[0].orderCount, 2);
      assert.deepEqual(aggregateSales([first, second, canceled]), result);
    },
  );
  await check(
    "sales reconciliation excludes inconsistent completed records and keeps full-discount delivery fees",
    async () => {
      const valid = salesRow("valid", 2, 25000, {
        discount: 10000,
        deliveryFee: 15000,
        total: 55000,
      });
      const free = salesRow("free", 1, 25000, {
        discount: 25000,
        deliveryFee: 15000,
        total: 15000,
      });
      const invalidTotal = salesRow("bad_total", 1, 25000, { total: 1 }),
        missing = salesRow("missing", 1, 25000);
      missing.items = [];
      const foreign = salesRow("foreign", 1, 25000, {}, { orderId: "other" });
      const result = aggregateSales([
        valid,
        free,
        invalidTotal,
        missing,
        foreign,
      ]);
      assert.equal(result.completedOrders, 2);
      assert.equal(result.excludedOrders, 3);
      assert.equal(result.gross, 75000);
      assert.equal(result.discount, 35000);
      assert.equal(result.deliveryFee, 30000);
      assert.equal(result.net, 70000);
      assert.equal(
        result.net,
        result.gross - result.discount + result.deliveryFee,
      );
    },
  );
  await check(
    "top products use deterministic ties and retain all-product totals outside the top ten",
    async () => {
      const rows = Array.from({ length: 12 }, (_, i) =>
        salesRow(
          "order_" + i,
          1,
          1000,
          {},
          { menuItemId: "sku_" + String(i).padStart(2, "0") },
        ),
      );
      const report = aggregateSales(rows);
      assert.equal(report.products.length, 10);
      assert.equal(report.units, 12);
      assert.equal(report.gross, 12000);
      assert.equal(report.products[0].menuItemId, "sku_00");
      assert.deepEqual(aggregateSales([...rows].reverse()), report);
      const duplicate = salesRow("duplicate", 2, 1000);
      duplicate.items = [
        { ...duplicate.items[0], quantity: 1, subtotal: 1000 },
        { ...duplicate.items[0], id: "line_2", quantity: 1, subtotal: 1000 },
      ];
      assert.equal(aggregateSales([duplicate]).products[0].orderCount, 1);
    },
  );
  await check(
    "sales exports neutralize spreadsheet formulas and preserve source-window provenance without contacts",
    async () => {
      const {
        orderWindowRevision,
      } = require("../src/lib/server/order-window.ts");
      const a = salesRow("a", 1, 1000),
        b = salesRow("b", 1, 2000);
      const revision = orderWindowRevision([a.order, b.order]);
      assert.equal(revision, orderWindowRevision([b.order, a.order]));
      assert.notEqual(
        revision,
        orderWindowRevision([{ ...a.order, status: "CANCELLED" }, b.order]),
      );
      for (const name of [
        '=HYPERLINK("demo")',
        " +SUM(1,2)",
        "\t-CMD",
        "\u200B@CMD",
      ]) {
        const row = salesRow("csv", 1, 1000, {}, { nameSnapshot: name });
        const report = {
          generatedAt: "2026-11-07T00:00:00Z",
          basisRevision: revision,
          sampleLimit: 200,
          sampledOrders: 1,
          matchedOrders: 1,
          ...aggregateSales([row]),
        };
        const csv = productSalesCsv(report);
        assert.equal(csv.charCodeAt(0), 0xfeff);
        assert.ok(csv.includes("source_revision"));
        assert.ok(csv.includes(revision));
        assert.ok(csv.includes("'"));
        for (const marker of [
          "PRIVATE_CUSTOMER",
          "PRIVATE_PHONE",
          "PRIVATE_NOTE",
        ])
          assert.ok(!csv.includes(marker));
      }
    },
  );
  await check(
    "queued staff operations recheck authentication after the lock and never execute a revoked session",
    async () => {
      const session = require("../src/lib/server/admin-session.ts"),
        { adminApi } = require("../src/lib/server/admin-api.ts"),
        { withUserLock } = require("../src/lib/server/user-lock.ts");
      const original = session.adminAuthenticated;
      let valid = true,
        release,
        observed,
        executed = false;
      const seen = new Promise((resolve) => (observed = resolve)),
        gate = new Promise((resolve) => (release = resolve));
      session.adminAuthenticated = async () => {
        observed();
        return valid;
      };
      const blocker = withUserLock("__admin__", () => gate);
      try {
        const waiting = adminApi(
          new Request("http://localhost/api/admin/sales"),
          async () => {
            executed = true;
            return new Response("private");
          },
        );
        await seen;
        valid = false;
        release();
        await blocker;
        const response = await waiting;
        assert.equal(response.status, 401);
        assert.equal(executed, false);
        assert.match(response.headers.get("cache-control"), /no-store/);
      } finally {
        release();
        session.adminAuthenticated = original;
      }
    },
  );
  await check("staff cancellation requires an explicit public reason and rejects unrelated or extra fields", async () => {
    const { orderTransitionSchema } = require("../src/lib/validation/admin.ts");
    const base = { orderId: "synthetic", expectedStatus: "CONFIRMED", nextStatus: "CANCELLED" };
    for (const change of [{}, { cancellationReason: "    " }, { cancellationReason: "abc" },
      { cancellationReason: "x".repeat(301) }, { cancellationReason: "Valid reason", extra: true },
      { cancellationReason: "Valid reason", nextStatus: "PREPARING" }])
      assert.equal(orderTransitionSchema.safeParse({ ...base, ...change }).success, false);
    assert.equal(orderTransitionSchema.parse({ ...base, cancellationReason: "  Cửa hàng tạm nghỉ  " }).cancellationReason, "Cửa hàng tạm nghỉ");
  });
  await check("staff cancellation persists the reason once and rejects changed retries, customer cancellations and prepared orders", async () => {
    const { AdminService } = require("../src/lib/services/admin-service.ts");
    const f = await reorderFixture(), admin = new AdminService(f.orders, f.menuRepo);
    await assert.rejects(() => admin.transition(f.order.id, "CONFIRMED", "CANCELLED"), e => e.code === "CANCEL_REASON_REQUIRED");
    assert.equal((await f.orders.getOrderEvents(f.order.id)).length, 1);
    const first = await admin.transition(f.order.id, "CONFIRMED", "CANCELLED", "  Cửa hàng tạm nghỉ  ");
    assert.equal(first.events.at(-1).metadata.cancellationReason, "Cửa hàng tạm nghỉ");
    assert.equal(first.events.at(-1).metadata.actor, "admin");
    assert.deepEqual(await admin.transition(f.order.id, "CONFIRMED", "CANCELLED", "Cửa hàng tạm nghỉ"), first);
    await assert.rejects(() => admin.transition(f.order.id, "CONFIRMED", "CANCELLED", "Lý do đã thay đổi"), e => e.code === "ORDER_CONFLICT");
    assert.equal((await f.orders.getOrderEvents(f.order.id)).length, 2);
    const g = await reorderFixture(), admin2 = new AdminService(g.orders, g.menuRepo);
    await g.checkout.cancel(g.owner, g.order.id);
    await assert.rejects(() => admin2.transition(g.order.id, "CONFIRMED", "CANCELLED", "Cửa hàng tạm nghỉ"), e => e.code === "ORDER_CONFLICT");
    const h = await reorderFixture(), admin3 = new AdminService(h.orders, h.menuRepo);
    await admin3.transition(h.order.id, "CONFIRMED", "PREPARING");
    await assert.rejects(() => admin3.transition(h.order.id, "PREPARING", "CANCELLED", "Cửa hàng tạm nghỉ"), e => e.code === "INVALID_TRANSITION");
  });
  await check("staff order writes recheck authentication after waiting for the customer lock", async () => {
    const session = require("../src/lib/server/admin-session.ts");
    const { withUserLock } = require("../src/lib/server/user-lock.ts");
    const route = require("../src/app/api/admin/orders/route.ts");
    const originalAuth = session.adminAuthenticated, originalDetail = services.adminService.detail,
      originalTransition = services.adminService.transition;
    const owner = "queued-order-owner-" + crypto.randomUUID();
    let valid = true, release, observed, executed = false;
    const gate = new Promise(resolve => release = resolve), seen = new Promise(resolve => observed = resolve);
    session.adminAuthenticated = async () => valid;
    services.adminService.detail = async () => { observed(); return { userId: owner }; };
    services.adminService.transition = async () => { executed = true; return {}; };
    const blocker = withUserLock(owner, () => gate);
    try {
      const pending = route.PATCH(new Request("http://localhost/api/admin/orders", { method: "PATCH",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: "synthetic", expectedStatus: "CONFIRMED", nextStatus: "PREPARING" }) }));
      await seen;
      valid = false;
      release();
      await blocker;
      const response = await pending;
      assert.equal(response.status, 401);
      assert.match(response.headers.get("cache-control"), /no-store/);
      assert.equal(executed, false);
    } finally {
      release();
      session.adminAuthenticated = originalAuth;
      services.adminService.detail = originalDetail;
      services.adminService.transition = originalTransition;
    }
  });
  const { buildKitchenBoard } = require("../src/lib/kitchen-board.ts");
  const kitchenRow = (id, status, fulfillment, qty = 1, changes = {}, item = {}) =>
    salesRow(id, qty, 1000, { status, fulfillment, ...changes }, item);
  await check("kitchen cards use active immutable snapshots, fulfillment lanes and an explicit contact-free DTO", async () => {
    const rows = [kitchenRow("a", "CONFIRMED", "pickup", 2), kitchenRow("b", "PREPARING", "delivery", 3),
      kitchenRow("c", "READY", "pickup", 4), kitchenRow("d", "DELIVERING", "delivery", 5),
      kitchenRow("e", "COMPLETED", "pickup"), kitchenRow("f", "CANCELLED", "delivery")];
    const board = buildKitchenBoard(rows);
    assert.deepEqual(board.counts, { CONFIRMED: 1, PREPARING: 1, READY: 1, DELIVERING: 1 });
    assert.equal(board.preparation[0].total, 5);
    assert.equal(board.preparation[0].waiting, 2);
    assert.equal(board.preparation[0].preparing, 3);
    assert.equal(buildKitchenBoard(rows, "delivery").cards.length, 2);
    assert.equal(board.cards[0].note, "PRIVATE_NOTE"); // Operational note is intentional; contact fields are not.
    for (const card of board.cards) assert.deepEqual(Object.keys(card).sort(), ["id", "status", "fulfillment", "createdAt", "updatedAt", "note", "items"].sort());
    assert.ok(!JSON.stringify(board).includes("PRIVATE_CUSTOMER"));
    assert.ok(!JSON.stringify(board).includes("PRIVATE_PHONE"));
    assert.ok(!JSON.stringify(board).includes("unitPrice"));
  });
  await check("kitchen excludes malformed active records without discarding valid work", async () => {
    const duplicate = kitchenRow("duplicate", "CONFIRMED", "pickup");
    duplicate.items.push({ ...duplicate.items[0], id: "duplicate-line" });
    const empty = kitchenRow("empty", "CONFIRMED", "pickup"); empty.items = [];
    const bad = [duplicate, empty, kitchenRow("fraction", "PREPARING", "pickup", 1.5),
      kitchenRow("wrong-lane", "READY", "delivery"), kitchenRow("date", "CONFIRMED", "pickup", 1, { createdAt: "bad-date" }),
      kitchenRow("foreign-line", "CONFIRMED", "pickup", 1, {}, { orderId: "other-order" }),
      kitchenRow("options", "CONFIRMED", "pickup", 1, {}, { options: { size: "custom" } }),
      kitchenRow("unknown", "CONFIRMED", undefined)];
    const result = buildKitchenBoard([...bad, kitchenRow("valid", "PREPARING", "pickup", 100)]);
    assert.equal(result.excludedActiveOrders, bad.length);
    assert.equal(result.matchedActiveOrders, bad.length + 1);
    assert.equal(result.cards.length, 1);
    assert.equal(result.preparation[0].total, 100);
  });
  await check("kitchen is oldest-first, summarizes only unfinished preparation and never mutates its source", async () => {
    const old = kitchenRow("a", "CONFIRMED", "pickup", 2),
      recent = kitchenRow("b", "PREPARING", "pickup", 3, { createdAt: "2026-11-07T02:00:00Z" }, { nameSnapshot: "Tên mới" }),
      ready = kitchenRow("c", "READY", "pickup", 100);
    const source = [recent, ready, old], before = structuredClone(source);
    const result = buildKitchenBoard(source);
    assert.deepEqual(result.cards.map(card => card.id), ["a", "c", "b"]);
    assert.equal(result.preparation[0].name, "Tên mới");
    assert.equal(result.preparation[0].total, 5);
    assert.deepEqual(buildKitchenBoard([...source].reverse()), result);
    assert.deepEqual(source, before);
  });
  await check("kitchen service bounds the source window and reads details only for matching active orders", async () => {
    const { AdminService } = require("../src/lib/services/admin-service.ts");
    const rows = [kitchenRow("active", "PREPARING", "pickup", 2), kitchenRow("delivery", "CONFIRMED", "delivery"),
      kitchenRow("done", "COMPLETED", "pickup")], reads = [];
    const repo = { getRecentOrders: async limit => { assert.equal(limit, 200); return rows.map(row => row.order); },
      getOrderItems: async id => { reads.push(id); return rows.find(row => row.order.id === id).items; } };
    const result = await new AdminService(repo, {}).kitchen("pickup");
    assert.deepEqual(reads, ["active"]);
    assert.equal(result.sampleLimit, 200);
    assert.equal(result.sampledOrders, 3);
    assert.equal(result.fulfillment, "pickup");
    assert.equal(result.cards[0].items[0].quantity, 2);
    assert.ok(Number.isFinite(Date.parse(result.generatedAt)));
  });
  const { defaultShopSettings, shopAvailability } = require("../src/lib/shop-settings.ts"),
    { ShopService, SHOP_ORDER_GATE } = require("../src/lib/services/shop-service.ts"),
    { updateShopSchema } = require("../src/lib/validation/shop.ts");
  const shopInput = (changes = {}) => { const value = defaultShopSettings(); delete value.updatedAt; return { ...value, ...changes }; };
  await check("shop settings validate a complete week, money, public contact and same-day hours", async () => {
    const base = shopInput();
    assert.equal(updateShopSchema.safeParse(base).success, true);
    for (const changed of [{ deliveryFee: -1 }, { deliveryFee: 1.5 }, { minimumSubtotal: 10000001 }, { phone: "bad" },
      { hours: base.hours.slice(1) }, { hours: base.hours.map(day => ({ ...day, day: 0 })) },
      { hours: base.hours.map(day => ({ ...day, opensAt: "22:00", closesAt: "08:00" })) }, { secret: "not-allowed" }])
      assert.equal(updateShopSchema.safeParse({ ...base, ...changed }).success, false);
    assert.equal(updateShopSchema.safeParse({ ...base, hours: base.hours.map(day => ({ ...day, opensAt: "00:00", closesAt: "24:00" })) }).success, true);
  });
  await check("shop hours use Vietnam day boundaries with inclusive opening, exclusive closing and manual channel overrides", async () => {
    const settings = { ...defaultShopSettings(), scheduleEnabled: true };
    assert.equal(shopAvailability(settings, Date.parse("2026-11-07T00:59:59Z")).open, false);
    assert.equal(shopAvailability(settings, Date.parse("2026-11-07T01:00:00Z")).open, true);
    assert.equal(shopAvailability(settings, Date.parse("2026-11-07T15:00:00Z")).open, false);
    settings.hours[0] = { day: 0, closed: true, opensAt: "00:00", closesAt: "24:00" };
    assert.equal(shopAvailability(settings, Date.parse("2026-11-07T17:00:00Z")).open, false);
    settings.scheduleEnabled = false; settings.pickupEnabled = false;
    assert.equal(shopAvailability(settings, Date.parse("2026-11-07T17:00:00Z")).canDelivery, true);
    assert.equal(shopAvailability(settings, Date.parse("2026-11-07T17:00:00Z")).canPickup, false);
    settings.acceptingOrders = false;
    assert.equal(shopAvailability(settings, Date.parse("2026-11-07T02:00:00Z")).canDelivery, false);
  });
  await check("shop defaults preserve legacy data while competing revisions and corrupt records fail safely", async () => {
    const repo = new MockMenuRepository(), shop = new ShopService(repo);
    assert.equal((await shop.view()).configured, false);
    const results = await Promise.allSettled([shop.save(shopInput({ name: "Store A" })), shop.save(shopInput({ name: "Store B" }))]);
    assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
    assert.equal(results.find(result => result.status === "rejected").reason.code, "SHOP_CHANGED");
    const current = await shop.view();
    await repo.saveShopSettings({ ...current.settings, hours: [] }, current.settings.revision);
    await assert.rejects(() => shop.view(), e => e.code === "SHOP_UNAVAILABLE" && e.status === 503);
  });
  await check("checkout enforces current shop terms, snapshots fees and preserves committed retries after closure", async () => {
    const f = await reorderFixture(), shop = new ShopService(f.menuRepo);
    const saved = await shop.save(shopInput({ address: "123 Snapshot shop", deliveryFee: 23000, minimumSubtotal: f.item.price * 2 }));
    const { CheckoutService } = require("../src/lib/services/checkout-service.ts");
    const checkout = new CheckoutService(f.orders, f.carts, f.menu, undefined, shop);
    let basket = await f.carts.addMenuItem(f.owner, f.item, 1);
    let input = { ...f.input, cartId: basket.cart.id, cartSignature: basket.signature, expectedTotal: basket.cart.subtotal + 23000,
      idempotencyKey: crypto.randomUUID(), shopRevision: saved.settings.revision };
    await assert.rejects(() => checkout.checkout(f.owner, input), e => e.code === "MINIMUM_ORDER");
    basket = await f.carts.addMenuItem(f.owner, f.item, 1);
    input = { ...input, cartSignature: basket.signature, expectedTotal: basket.cart.subtotal + 23000 };
    await assert.rejects(() => checkout.checkout(f.owner, { ...input, shopRevision: "default" }), e => e.code === "SHOP_CHANGED");
    const order = await checkout.checkout(f.owner, input);
    assert.equal(order.deliveryFee, 23000); assert.equal(order.store.address, "123 Snapshot shop");
    const { updatedAt, ...fields } = saved.settings; void updatedAt;
    await shop.save({ ...fields, acceptingOrders: false, address: "456 New shop address" });
    assert.deepEqual(await checkout.checkout(f.owner, input), order);
    assert.equal((await checkout.detail(f.owner, order.id)).store.address, "123 Snapshot shop");
  });
  await check("shop pause and checkout serialize at the acceptance gate without claiming a failed request key", async () => {
    const { withUserLock } = require("../src/lib/server/user-lock.ts"), { CheckoutService } = require("../src/lib/services/checkout-service.ts");
    const f = await reorderFixture(), shop = new ShopService(f.menuRepo), checkout = new CheckoutService(f.orders, f.carts, f.menu, undefined, shop);
    const basket = await f.carts.addMenuItem(f.owner, f.item, 1), input = { ...f.input, cartId: basket.cart.id, cartSignature: basket.signature,
      expectedTotal: basket.cart.subtotal + 15000, idempotencyKey: crypto.randomUUID(), shopRevision: "default" };
    let release;
    const gate = new Promise(resolve => release = resolve), blocker = withUserLock(SHOP_ORDER_GATE, () => gate);
    const pausing = shop.save(shopInput({ acceptingOrders: false }));
    const pending = checkout.checkout(f.owner, input);
    release(); await blocker; const paused = await pausing;
    await assert.rejects(() => pending, e => e.code === "SHOP_CHANGED");
    assert.equal((await f.carts.getCartView(f.owner)).items.length, 1);
    const { updatedAt, ...fields } = paused.settings; void updatedAt;
    const opened = await shop.save({ ...fields, acceptingOrders: true });
    const order = await checkout.checkout(f.owner, { ...input, shopRevision: opened.settings.revision });
    assert.equal(order.status, "CONFIRMED");
  });
  await check("queued shop saves and checkouts honor post-gate authorization before any write", async () => {
    const { withUserLock } = require("../src/lib/server/user-lock.ts"), { DomainError } = require("../src/lib/domain-error.ts"),
      { CheckoutService } = require("../src/lib/services/checkout-service.ts");
    const f = await reorderFixture(), shop = new ShopService(f.menuRepo), checkout = new CheckoutService(f.orders, f.carts, f.menu, undefined, shop);
    const basket = await f.carts.addMenuItem(f.owner, f.item, 1);
    let release, valid = true;
    const gate = new Promise(resolve => release = resolve), blocker = withUserLock(SHOP_ORDER_GATE, () => gate);
    const guard = async () => { if (!valid) throw new DomainError("EXPIRED", "expired", 401); };
    const saving = shop.save(shopInput({ acceptingOrders: false }), guard);
    const ordering = checkout.checkout(f.owner, { ...f.input, cartId: basket.cart.id, cartSignature: basket.signature,
      expectedTotal: basket.cart.subtotal + 15000, idempotencyKey: crypto.randomUUID() }, guard);
    const outcomes = Promise.allSettled([saving, ordering]);
    valid = false; release(); await blocker;
    for (const outcome of await outcomes) { assert.equal(outcome.status, "rejected"); assert.equal(outcome.reason.status, 401); }
    assert.equal((await shop.view()).configured, false);
    assert.equal((await f.carts.getCartView(f.owner)).items.length, 1);
  });
  const { FeedbackService } = require("../src/lib/services/feedback-service.ts"),
    { customerFeedbackSchema, feedbackReplySchema } = require("../src/lib/validation/feedback.ts");
  async function completedFeedbackFixture() {
    const f = await reorderFixture();
    const { AdminService } = require("../src/lib/services/admin-service.ts");
    const admin = new AdminService(f.orders, f.menuRepo);
    await admin.transition(f.order.id, "CONFIRMED", "PREPARING");
    await admin.transition(f.order.id, "PREPARING", "DELIVERING");
    await admin.transition(f.order.id, "DELIVERING", "COMPLETED");
    return { ...f, feedback: new FeedbackService(f.orders) };
  }
  await check("private feedback schemas reject invalid ratings, oversized text and forged fields", async () => {
    for (const fields of [{ rating: 0 }, { rating: 6 }, { rating: 1.5 }, { rating: 5, comment: "x".repeat(1001) },
      { rating: 5, userId: "forged" }, { rating: 5, revision: "bad" }])
      assert.equal(customerFeedbackSchema.safeParse({ orderId: "demo", ...fields }).success, false);
    assert.equal(customerFeedbackSchema.parse({ orderId: "demo", rating: 5, comment: "  good  " }).comment, "good");
    assert.equal(feedbackReplySchema.safeParse({ orderId: "demo", revision: crypto.randomUUID(), message: "   " }).success, false);
  });
  await check("feedback is owner-private and only completed orders are eligible", async () => {
    const f = await reorderFixture(), feedback = new FeedbackService(f.orders);
    assert.deepEqual(await feedback.view(f.owner, f.order.id), { eligible: false, feedback: null });
    await assert.rejects(() => feedback.save(f.owner, { orderId: f.order.id, rating: 5, comment: "good" }), e => e.code === "FEEDBACK_NOT_READY");
    await assert.rejects(() => feedback.view("other-owner", f.order.id), e => e.code === "ORDER_NOT_FOUND");
    await assert.rejects(() => feedback.save("other-owner", { orderId: f.order.id, rating: 5, comment: "good" }), e => e.code === "ORDER_NOT_FOUND");
    assert.equal((await f.orders.getOrderEvents(f.order.id)).length, 1);
  });
  await check("feedback retries preserve one record, edits require revision and replies freeze the exchange", async () => {
    const f = await completedFeedbackFixture(), input = { orderId: f.order.id, rating: 5, comment: "Món ngon" };
    const first = await f.feedback.save(f.owner, input);
    assert.deepEqual(await f.feedback.save(f.owner, input), first);
    await assert.rejects(() => f.feedback.save(f.owner, { ...input, rating: 4 }), e => e.code === "FEEDBACK_CHANGED");
    const edited = await f.feedback.save(f.owner, { ...input, rating: 4, revision: first.revision });
    assert.equal(edited.createdAt, first.createdAt); assert.notEqual(edited.revision, first.revision);
    await assert.rejects(() => f.feedback.reply({ orderId: f.order.id, revision: first.revision, message: "Cảm ơn bạn đã góp ý." }), e => e.code === "FEEDBACK_CHANGED");
    const replied = await f.feedback.reply({ orderId: f.order.id, revision: edited.revision, message: "Cảm ơn bạn đã góp ý." });
    assert.deepEqual(await f.feedback.reply({ orderId: f.order.id, revision: edited.revision, message: "Cảm ơn bạn đã góp ý." }), replied);
    await assert.rejects(() => f.feedback.reply({ orderId: f.order.id, revision: replied.revision, message: "Nội dung khác" }), e => e.code === "FEEDBACK_REPLIED");
    await assert.rejects(() => f.feedback.save(f.owner, { ...input, rating: 3, revision: replied.revision }), e => e.code === "FEEDBACK_LOCKED");
    assert.deepEqual(await f.feedback.save(f.owner, { ...input, rating: 4 }), replied);
    const detail = await f.checkout.detail(f.owner, f.order.id);
    assert.equal(detail.events.length, 4); assert.equal(detail.total, f.order.total); assert.equal(detail.status, "COMPLETED");
  });
  await check("concurrent customer edit and merchant reply have one CAS winner with no mixed context", async () => {
    const f = await completedFeedbackFixture(), first = await f.feedback.save(f.owner, { orderId: f.order.id, rating: 4, comment: "Original" });
    const outcomes = await Promise.allSettled([
      f.feedback.save(f.owner, { orderId: f.order.id, rating: 3, comment: "Edited", revision: first.revision }),
      f.feedback.reply({ orderId: f.order.id, revision: first.revision, message: "Reply to original" }),
    ]);
    assert.equal(outcomes.filter(result => result.status === "fulfilled").length, 1);
    const result = (await f.feedback.view(f.owner, f.order.id)).feedback;
    assert.ok((result.comment === "Edited" && !result.reply) || (result.comment === "Original" && result.reply.message === "Reply to original"));
  });
  await check("feedback inbox includes new feedback on old orders and exposes filtered summaries without order contacts or CSV text", async () => {
    const repo = new MockOrderRepository(new MockCartRepository()), feedback = new FeedbackService(repo);
    const old = salesRow("old-feedback-order", 1, 1000, { createdAt: "2020-01-01T00:00:00Z", fulfillment: "pickup" }).order;
    await repo.createOrder(old);
    for (let i = 0; i < 201; i++) await repo.createOrder(salesRow("later_" + i, 1, 1000).order);
    await feedback.save("synthetic", { orderId: old.id, rating: 5, comment: "PRIVATE_FEEDBACK_MARKER" });
    assert.ok(!(await repo.getRecentOrders(200)).some(order => order.id === old.id));
    const other = salesRow("other-feedback", 1, 1000, { fulfillment: "delivery" }).order; await repo.createOrder(other);
    const entry = await feedback.save("synthetic", { orderId: other.id, rating: 1, comment: "" });
    await feedback.reply({ orderId: other.id, revision: entry.revision, message: "Cảm ơn phản hồi" });
    const inbox = await feedback.inbox({ rating: "all", response: "all" });
    assert.equal(inbox.entries.length, 2); assert.equal(inbox.averageRating, 3); assert.equal(inbox.unanswered, 1);
    assert.deepEqual(Object.keys(inbox.entries[0]).sort(), ["orderId", "fulfillment", "feedback"].sort());
    assert.ok(!JSON.stringify(inbox).includes("PRIVATE_CUSTOMER")); assert.ok(!JSON.stringify(inbox).includes("PRIVATE_PHONE"));
    assert.equal((await feedback.inbox({ rating: "1", response: "pending" })).entries.length, 0);
    const { ordersCsv } = require("../src/lib/order-reporting.ts");
    assert.ok(!ordersCsv([await repo.getOrderById(old.id)]).includes("PRIVATE_FEEDBACK_MARKER"));
  });
  await check("merchant feedback replies recheck authentication after the owner lock", async () => {
    const session = require("../src/lib/server/admin-session.ts"), { withUserLock } = require("../src/lib/server/user-lock.ts"),
      route = require("../src/app/api/admin/feedback/route.ts");
    const originalAuth = session.adminAuthenticated, originalDetail = services.adminService.detail, originalReply = services.feedbackService.reply;
    const owner = "feedback-queued-" + crypto.randomUUID();
    let release, observed, valid = true, executed = false;
    const gate = new Promise(resolve => release = resolve), seen = new Promise(resolve => observed = resolve);
    session.adminAuthenticated = async () => valid;
    services.adminService.detail = async () => { observed(); return { userId: owner }; };
    services.feedbackService.reply = async () => { executed = true; return {}; };
    const blocker = withUserLock(owner, () => gate);
    try {
      const waiting = route.POST(new Request("http://localhost/api/admin/feedback", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: "fake", revision: crypto.randomUUID(), message: "Synthetic reply" }) }));
      await seen; valid = false; release(); await blocker;
      const response = await waiting; assert.equal(response.status, 401); assert.equal(executed, false);
      assert.match(response.headers.get("cache-control"), /no-store/);
    } finally { release(); session.adminAuthenticated = originalAuth; services.adminService.detail = originalDetail; services.feedbackService.reply = originalReply; }
  });
  await check("cart mutations and repricing use one full-view commit and failures never modify live line arrays", async () => {
    const { MenuService } = require("../src/lib/services/menu-service.ts"), { CartService } = require("../src/lib/services/cart-service.ts");
    const repo = new MockCartRepository(), menuRepo = new MockMenuRepository(), menu = new MenuService(menuRepo), carts = new CartService(repo, menu);
    const item = (await menu.getAvailableMenuItems())[0]; let writes = 0;
    const original = repo.saveCartView.bind(repo);
    repo.saveCartView = async (...args) => { writes++; return original(...args); };
    for (const name of ["createCart", "updateCart", "addItem", "updateItem", "removeItem", "clearCart"])
      repo[name] = async () => { throw new Error("Legacy multi-write path used: " + name); };
    let basket = await carts.addMenuItem("atomic-owner", item, 1); assert.equal(writes, 1);
    basket = await carts.updateItemQuantity("atomic-owner", basket.items[0].id, 2); assert.equal(writes, 2);
    await menuRepo.saveMenuItem({ ...item, price: item.price + 1000 });
    basket = await carts.getCartView("atomic-owner"); assert.equal(writes, 3); assert.equal(basket.cart.total, (item.price + 1000) * 2);
    const before = structuredClone({ cart: await repo.getCartById(basket.cart.id), items: await repo.getCartItems(basket.cart.id) });
    repo.saveCartView = async () => { throw new Error("Synthetic commit failure"); };
    for (const action of [() => carts.addMenuItem("atomic-owner", item, 1), () => carts.updateItemQuantity("atomic-owner", basket.items[0].id, 5),
      () => carts.removeItem("atomic-owner", basket.items[0].id), () => carts.clearCart("atomic-owner"), () => carts.addMenuItem("new-atomic-owner", item, 1)])
      await assert.rejects(action, /Synthetic commit failure/);
    assert.deepEqual({ cart: await repo.getCartById(basket.cart.id), items: await repo.getCartItems(basket.cart.id) }, before);
    assert.equal(await repo.getActiveCart("new-atomic-owner"), null);
  });
  await check("concurrent cart creators and editors have a revision winner instead of silent lost updates", async () => {
    const { MenuService } = require("../src/lib/services/menu-service.ts"), { CartService } = require("../src/lib/services/cart-service.ts");
    const repo = new MockCartRepository(), menu = new MenuService(new MockMenuRepository()), carts = new CartService(repo, menu), item = (await menu.getAvailableMenuItems())[0];
    const first = await Promise.allSettled([carts.addMenuItem("cart-race", item, 1), carts.addMenuItem("cart-race", item, 1)]);
    assert.equal(first.filter(result => result.status === "fulfilled").length, 1);
    assert.equal(first.find(result => result.status === "rejected").reason.code, "CART_CHANGED");
    const second = await Promise.allSettled([carts.addMenuItem("cart-race", item, 1), carts.addMenuItem("cart-race", item, 1)]);
    assert.equal(second.filter(result => result.status === "fulfilled").length, 1);
    const basket = await carts.getCartView("cart-race"); assert.equal(basket.items[0].quantity, 2);
    assert.equal(basket.cart.total, item.price * 2);
  });
  await check("legacy carts upgrade on commit and invalid payloads, foreign owners and stale revisions cannot overwrite", async () => {
    const { MenuService } = require("../src/lib/services/menu-service.ts"), { CartService } = require("../src/lib/services/cart-service.ts");
    const repo = new MockCartRepository(), menu = new MenuService(new MockMenuRepository()), carts = new CartService(repo, menu), item = (await menu.getAvailableMenuItems())[0];
    let basket = await carts.addMenuItem("legacy-owner", item, 1);
    const legacy = { ...basket.cart }; delete legacy.revision; await repo.updateCart(legacy);
    basket = await carts.updateItemQuantity("legacy-owner", basket.items[0].id, 2);
    assert.match(basket.cart.revision, /^[a-f0-9-]{36}$/);
    await assert.rejects(() => repo.saveCartView({ ...basket.cart, revision: crypto.randomUUID() }, basket.items, "legacy"), e => e.code === "CART_CHANGED");
    for (const change of [{ total: 1 }, { status: "CHECKED_OUT" }, { revision: undefined }])
      await assert.rejects(() => repo.saveCartView({ ...basket.cart, ...change }, basket.items, basket.cart.revision), e => e.code === "INVALID_CART");
    await assert.rejects(() => repo.saveCartView({ ...basket.cart, userId: "other-owner", revision: crypto.randomUUID() }, basket.items, basket.cart.revision), e => e.code === "CART_CHANGED");
    const original = repo.getActiveCart; repo.getActiveCart = async () => basket.cart;
    await assert.rejects(() => carts.getCartView("wrong-owner"), e => e.code === "CART_FORBIDDEN"); repo.getActiveCart = original;
  });
  await check("checkout rejects an outdated cart revision and a closed cart cannot be reopened by commit", async () => {
    const f = await reorderFixture();
    const before = await f.carts.addMenuItem(f.owner, f.item, 1);
    const fresh = await f.carts.updateItemQuantity(f.owner, before.items[0].id, 3);
    const id = "stale-order-" + crypto.randomUUID();
    await assert.rejects(() => f.orders.completeCheckout({ ...f.order, id, cartId: before.cart.id }, [], { id: crypto.randomUUID(), orderId: id, type: "CONFIRMED", createdAt: new Date().toISOString() }, { ...before.cart, status: "CHECKED_OUT" }), e => e.code === "CART_CHANGED");
    assert.equal(await f.orders.getOrderById(id), null); assert.equal((await f.carts.getCartView(f.owner)).items[0].quantity, 3);
    const order = await f.checkout.checkout(f.owner, { ...f.input, cartId: fresh.cart.id, cartSignature: fresh.signature, idempotencyKey: crypto.randomUUID(), expectedTotal: fresh.cart.subtotal + 15000 });
    await assert.rejects(() => f.cartRepo.saveCartView({ ...fresh.cart, revision: crypto.randomUUID() }, fresh.items, fresh.cart.revision), e => e.code === "CART_CHANGED");
    assert.equal((await f.carts.getCartById(order.cartId)).status, "CHECKED_OUT");
  });
  await check("Dynamo cart command contract uses one transaction, revision conditions and consistent reads without AWS", async () => {
    const aws = require("../src/lib/aws/dynamodb.ts"), { DynamoDBCartRepository } = require("../src/lib/db/repositories/implementations/dynamodb-repository.ts");
    const original = aws.getDynamoDBDocumentClient; const calls = []; let pointer, stored, storedItems = [], reject = false;
    aws.getDynamoDBDocumentClient = () => ({ send: async command => {
      calls.push(command);
      if (command.constructor.name === "GetCommand") return { Item: command.input.Key.PK.startsWith("USER#") ? pointer : stored };
      if (command.constructor.name === "QueryCommand") return { Items: storedItems };
      if (reject) { const error = new Error("synthetic condition failure"); error.name = "TransactionCanceledException"; throw error; }
      return {};
    }});
    try {
      const { CartService } = require("../src/lib/services/cart-service.ts"), { MenuService } = require("../src/lib/services/menu-service.ts");
      const mock = new MockCartRepository(), menu = new MenuService(new MockMenuRepository()), cart = new CartService(mock, menu), item = (await menu.getAvailableMenuItems())[0];
      const basket = await cart.addMenuItem("sdk-owner", item, 1), repo = new DynamoDBCartRepository();
      await repo.saveCartView(basket.cart, basket.items, null);
      assert.equal(calls.filter(call => call.constructor.name === "TransactWriteCommand").length, 1);
      pointer = { cartId: basket.cart.id }; stored = { ...basket.cart, PK: "CART#" + basket.cart.id, SK: "ACTIVE" }; storedItems = basket.items;
      calls.length = 0; reject = true;
      await assert.rejects(() => repo.saveCartView({ ...basket.cart, revision: crypto.randomUUID() }, basket.items, basket.cart.revision), e => e.code === "CART_CHANGED");
      const tx = calls.find(call => call.constructor.name === "TransactWriteCommand").input.TransactItems;
      assert.equal(tx.length, 2); assert.ok(tx[0].Put.ConditionExpression.includes("#revision = :expected"));
      assert.ok(tx[1].ConditionCheck); assert.ok(calls.filter(call => ["GetCommand", "QueryCommand"].includes(call.constructor.name)).every(call => call.input.ConsistentRead));
      reject = false; stored = { ...stored, status: "CHECKED_OUT" };
      assert.equal(await repo.getActiveCart("sdk-owner"), null);
    } finally { aws.getDynamoDBDocumentClient = original; }
  });
  console.log(`${count} chat regression checks passed (mock only).`);
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
