// Production entry point for AgentCore Runtime direct code deployment
// (bundled to a single JS file by scripts/build-agentcore.cjs; runtime NODE_22).
// Environment comes from the runtime configuration, never from a .env file.
import { startAgentRuntime } from "./server";

startAgentRuntime()
  .then((server) => {
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : "?";
    console.log(`agentcore_runtime_started port=${port} deployed=${process.env.AGENTCORE_DEPLOYED ?? "0"}`);
  })
  .catch((error) => {
    console.error("agentcore_runtime_failed", error instanceof Error ? error.message : "unknown");
    process.exit(1);
  });
