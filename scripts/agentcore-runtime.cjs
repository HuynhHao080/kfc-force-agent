/* eslint-disable @typescript-eslint/no-require-imports -- Entry point for the AgentCore Runtime container and for local emulation. */
// Serves the agent with the Amazon Bedrock AgentCore Runtime HTTP contract
// (GET /ping, POST /invocations on 0.0.0.0:8080). Reads .env / .env.local when present.
//   npm run agentcore:dev
//   curl -s localhost:8080/ping
//   curl -s -X POST localhost:8080/invocations -H "content-type: application/json" \
//        -d '{"userId":"demo-user","message":"cho mình xem menu"}'
// Nothing here deploys or calls AWS by itself; the provider comes from AI_PROVIDER.
const path = require("node:path");
require("@next/env").loadEnvConfig(path.resolve(__dirname, ".."));
require("./register-typescript.cjs");
const { startAgentRuntime } = require("../src/agentcore/server.ts");

startAgentRuntime().then((server) => {
  const { port } = server.address();
  console.log(`AgentCore runtime on http://0.0.0.0:${port} | AI_PROVIDER=${process.env.AI_PROVIDER || "mock"} | PERSISTENCE_DRIVER=${process.env.PERSISTENCE_DRIVER || "local"} | AGENTCORE_DEPLOYED=${process.env.AGENTCORE_DEPLOYED || "0"}`);
}).catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
