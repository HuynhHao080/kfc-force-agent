import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { assertRuntimePersistence, handleInvocation } from "./invocation";

/**
 * HTTP server implementing the AgentCore Runtime HTTP protocol contract:
 *   GET  /ping         -> 200 {"status":"Healthy"}
 *   POST /invocations  -> JSON in, JSON out
 * Host 0.0.0.0, port 8080 by default (AgentCore requires an ARM64 image).
 * Uses node:http only, so the runtime adds no dependency to the project.
 */
const MAX_BODY_BYTES = 16 * 1024; // a chat turn is at most 1000 characters

function send(response: ServerResponse, status: number, body: unknown) {
  const text = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(text),
    "cache-control": "no-store",
  });
  response.end(text);
}

function readBody(request: IncomingMessage): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let overflow = false;
    request.on("data", (chunk: Buffer) => {
      if (overflow) return; // keep draining so the 413 reply can be delivered
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        overflow = true;
        chunks.length = 0;
        resolve(null);
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => { if (!overflow) resolve(Buffer.concat(chunks).toString("utf8")); });
    request.on("error", reject);
  });
}

export function createAgentRuntimeServer(): Server {
  assertRuntimePersistence();
  return createServer(async (request, response) => {
    const path = (request.url ?? "/").split("?")[0];
    try {
      if (path === "/ping") {
        if (request.method !== "GET") return send(response, 405, { status: "error", error: "method_not_allowed" });
        // No time_of_last_update: the platform tracks status changes itself.
        return send(response, 200, { status: "Healthy" });
      }
      if (path === "/invocations") {
        if (request.method !== "POST") return send(response, 405, { status: "error", error: "method_not_allowed" });
        if (!/^application\/json\b/i.test(request.headers["content-type"] ?? ""))
          return send(response, 415, { status: "error", error: "unsupported_media_type", message: "Content-Type phải là application/json." });
        const text = await readBody(request);
        if (text === null) return send(response, 413, { status: "error", error: "payload_too_large" });
        let payload: unknown;
        try {
          payload = JSON.parse(text);
        } catch {
          return send(response, 400, { status: "error", error: "validation_error", message: "JSON không hợp lệ." });
        }
        const result = await handleInvocation(payload);
        return send(response, result.status, result.body);
      }
      return send(response, 404, { status: "error", error: "not_found" });
    } catch (failure) {
      console.error("agentcore_server_error", failure instanceof Error ? failure.name : "unknown");
      if (!response.headersSent) send(response, 500, { status: "error", error: "internal_error" });
    }
  });
}

export function startAgentRuntime(port = Number(process.env.PORT ?? 8080), host = "0.0.0.0"): Promise<Server> {
  const server = createAgentRuntimeServer();
  const stop = () => server.close(() => process.exit(0));
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
  return new Promise((resolve) => server.listen(port, host, () => resolve(server)));
}
