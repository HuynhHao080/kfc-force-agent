/* eslint-disable @typescript-eslint/no-require-imports -- Offline AgentCore Runtime contract tests: loopback HTTP only, mock provider, in-memory persistence. */
process.env.AI_PROVIDER = "mock";
process.env.PERSISTENCE_DRIVER = "mock";
process.env.SESSION_SECRET ??= "synthetic-agentcore-contract-signing-secret-2026";
delete process.env.AGENTCORE_DEPLOYED;
require("./register-typescript.cjs");
const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { createAgentRuntimeServer } = require("../src/agentcore/server.ts");
const { assertRuntimePersistence, handleInvocation } = require("../src/agentcore/invocation.ts");

const server = createAgentRuntimeServer();
const ready = new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
after(() => server.close());

async function call(method, path, body, headers = {}) {
  await ready;
  const { port } = server.address();
  return new Promise((resolve, reject) => {
    const request = http.request({ host: "127.0.0.1", port, method, path, headers }, (response) => {
      let text = "";
      response.on("data", (chunk) => (text += chunk));
      response.on("end", () => resolve({ status: response.statusCode, headers: response.headers, body: text ? JSON.parse(text) : null }));
    });
    request.on("error", reject);
    if (body !== undefined) request.end(typeof body === "string" ? body : JSON.stringify(body));
    else request.end();
  });
}
const json = { "content-type": "application/json" };
const user = "agentcore-" + crypto.randomUUID();

test("01 GET /ping follows the AgentCore health contract", async () => {
  const r = await call("GET", "/ping");
  assert.equal(r.status, 200);
  assert.match(r.headers["content-type"], /application\/json/);
  assert.deepEqual(r.body, { status: "Healthy" });
  assert.equal((await call("POST", "/ping", {}, json)).status, 405);
});

test("02 POST /invocations runs the same pipeline as the web chat route", async () => {
  const r = await call("POST", "/invocations", { userId: user, message: "cho mình xem thực đơn" }, json);
  assert.equal(r.status, 200);
  assert.equal(r.body.status, "success");
  assert.equal(typeof r.body.reply, "string");
  assert.equal(r.body.sessionId.length > 0, true);
  assert.ok(Array.isArray(r.body.execution));
});

test("03 cart changes still require explicit confirmation through the runtime", async () => {
  // PERSISTENCE_DRIVER=mock serves the synthetic demo seed, so pick a real seed item.
  const { services } = require("../src/lib/agent/agent-core.ts");
  const item = (await services.menuService.getAvailableMenuItems())[0];
  const proposal = await call("POST", "/invocations", { userId: user, message: `Thêm 2 ${item.name}` }, json);
  assert.equal(proposal.status, 200);
  assert.equal(proposal.body.requiresConfirmation, true);
  assert.ok(proposal.body.pendingConfirmation?.id);
  const blocked = await call("POST", "/invocations", { userId: user, message: "ok" }, json);
  assert.equal(blocked.body.requiresConfirmation, true, "the word ok never executes");
  const confirmed = await call("POST", "/invocations", {
    userId: user, message: "Xác nhận", confirm: true, confirmationId: proposal.body.pendingConfirmation.id,
  }, json);
  assert.equal(confirmed.status, 200);
  assert.ok(confirmed.body.execution.some((row) => row.executed), "confirmed proposal executes");
});

test("04 invalid input is rejected without leaking internals", async () => {
  assert.equal((await call("POST", "/invocations", "{not json", json)).status, 400);
  assert.equal((await call("POST", "/invocations", { userId: user, message: "x" }, { "content-type": "text/plain" })).status, 415);
  assert.equal((await call("POST", "/invocations", { message: "no user" }, json)).status, 400);
  assert.equal((await call("POST", "/invocations", { userId: user, message: "x", extra: 1 }, json)).status, 400);
  const long = await call("POST", "/invocations", { userId: user, message: "a".repeat(1001) }, json);
  assert.equal(long.status, 400);
  assert.match(long.body.message, /1000/);
  assert.equal((await call("POST", "/invocations", { userId: user, message: "x".repeat(20000) }, json)).status, 413);
  assert.equal((await call("GET", "/other")).status, 404);
  assert.equal((await call("GET", "/invocations")).status, 405);
});

test("05 handleInvocation never throws and never echoes error details", async () => {
  const r = await handleInvocation({ userId: user, message: "" });
  assert.equal(r.status, 400);
  assert.ok(!JSON.stringify(r.body).includes("stack"));
});

test("06 deployment guard refuses local JSON persistence on AgentCore", () => {
  assert.throws(() => assertRuntimePersistence({ AGENTCORE_DEPLOYED: "1", PERSISTENCE_DRIVER: "local" }), /dynamodb/);
  assert.throws(() => assertRuntimePersistence({ AGENTCORE_DEPLOYED: "1" }), /dynamodb/);
  assert.doesNotThrow(() => assertRuntimePersistence({ AGENTCORE_DEPLOYED: "1", PERSISTENCE_DRIVER: "dynamodb" }));
  assert.doesNotThrow(() => assertRuntimePersistence({ PERSISTENCE_DRIVER: "local" }));
});
